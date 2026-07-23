import { spawn } from "child_process";
import { createInterface } from "readline";
import { killProcessTree } from "../kill-tree.js";
/**
 * Grok Build (xAI) headless backend.
 *
 * Auth is local-only: `grok login` (Grok subscription OAuth/device code)
 * or `XAI_API_KEY`. The control plane never holds xAI credentials.
 *
 * Protocol: `grok -p … --output-format streaming-json` emits NDJSON events
 * (`text`, `thought`, `end`, `error`, plus best-effort compaction signals).
 * v1 is per-turn only — no mid-turn stdin steering.
 */
export class GrokBackend {
    cliPath;
    name = "grok";
    lifecycle = { kind: "per_turn", inFlightWake: "coalesce_into_pending" };
    busyDeliveryMode = "none";
    supportsStdinNotification = false;
    constructor(cliPath) {
        this.cliPath = cliPath;
    }
    parseLine(line) {
        if (!line.trim())
            return [];
        let event;
        try {
            event = JSON.parse(line);
        }
        catch {
            return [{ kind: "log", content: line, level: "debug" }];
        }
        const events = [];
        const eventType = event.type;
        switch (eventType) {
            case "text": {
                const text = event.data ||
                    event.content ||
                    event.text ||
                    "";
                if (text)
                    events.push({ kind: "text", text });
                break;
            }
            case "thought":
            case "thinking": {
                const text = event.data ||
                    event.content ||
                    event.text ||
                    "";
                if (text)
                    events.push({ kind: "thinking", text });
                break;
            }
            case "end": {
                const sessionId = event.sessionId ||
                    event.session_id ||
                    "";
                if (sessionId) {
                    events.push({ kind: "session_init", sessionId });
                }
                events.push({ kind: "turn_end", sessionId: sessionId || undefined });
                break;
            }
            case "error": {
                const message = event.message ||
                    event.data ||
                    event.content ||
                    "grok error";
                events.push({ kind: "error", message });
                events.push({ kind: "turn_end" });
                break;
            }
            case "max_turns_reached": {
                events.push({
                    kind: "internal_progress",
                    source: "grok",
                    itemType: "max_turns_reached",
                    payloadBytes: line.length,
                });
                events.push({ kind: "turn_end" });
                break;
            }
            case "auto_compact_started":
            case "compaction_started": {
                events.push({ kind: "compaction_started" });
                break;
            }
            case "auto_compact_finished":
            case "compaction_finished": {
                events.push({ kind: "compaction_finished" });
                break;
            }
            case "tool_call":
            case "tool_use": {
                events.push({
                    kind: "tool_call",
                    name: event.name || event.tool || "",
                    callId: event.call_id || event.id || "",
                    input: event.input || event.args,
                });
                break;
            }
            case "tool_result":
            case "tool_output": {
                events.push({
                    kind: "tool_output",
                    callId: event.call_id || event.id || "",
                    output: event.output || event.data || event.content || "",
                });
                break;
            }
            default:
                events.push({ kind: "log", content: line, level: "debug" });
        }
        return events;
    }
    encodeStdinMessage() {
        return null;
    }
    execute(prompt, options) {
        const args = [
            "-p",
            prompt,
            "--output-format",
            "streaming-json",
            "--permission-mode",
            "bypassPermissions",
        ];
        if (options.model) {
            args.push("--model", options.model);
        }
        if (options.maxTurns) {
            args.push("--max-turns", String(options.maxTurns));
        }
        if (options.resumeSessionId) {
            args.push("--resume", options.resumeSessionId);
        }
        if (options.cwd) {
            args.push("--cwd", options.cwd);
        }
        const proc = spawn(this.cliPath, args, {
            cwd: options.cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, ...options.env },
            shell: process.platform === "win32",
            windowsHide: true,
            // POSIX: own process group so session-runner can reap CLI + tool children.
            detached: process.platform !== "win32",
        });
        if (!proc.pid) {
            const error = `Failed to start ${this.cliPath}: binary not found or not executable. Is 'grok' installed and on PATH? Authenticate with \`grok login\` (Grok subscription) or set XAI_API_KEY.`;
            const failedResult = { status: "failed", output: "", error, durationMs: 0, sessionId: "" };
            const emptyMessages = {
                [Symbol.asyncIterator]() {
                    return {
                        async next() {
                            return { value: undefined, done: true };
                        },
                    };
                },
            };
            return { pid: undefined, messages: emptyMessages, sessionId: Promise.resolve(""), result: Promise.resolve(failedResult) };
        }
        let timedOut = false;
        let timeoutTimer;
        if (options.timeout) {
            timeoutTimer = setTimeout(() => {
                timedOut = true;
                if (proc.pid !== undefined)
                    void killProcessTree(proc.pid);
            }, options.timeout);
        }
        const startTime = Date.now();
        let lastSessionId = "";
        let lastOutput = "";
        let lastError = "";
        let resultStatus = "completed";
        let resolveSessionId;
        const sessionIdPromise = new Promise((resolve) => {
            resolveSessionId = resolve;
        });
        let turnDoneTriggered = false;
        const turnDone = () => {
            if (turnDoneTriggered)
                return;
            turnDoneTriggered = true;
            try {
                proc.kill("SIGTERM");
            }
            catch {
                /* already dead */
            }
        };
        const messageQueue = [];
        let messageResolve = null;
        let messageDone = false;
        const parsedEventQueue = [];
        let parsedEventResolve = null;
        let parsedEventDone = false;
        const pushMessage = (msg) => {
            messageQueue.push(msg);
            if (messageResolve) {
                const r = messageResolve;
                messageResolve = null;
                r();
            }
        };
        const pushParsedEvent = (evt) => {
            parsedEventQueue.push(evt);
            if (parsedEventResolve) {
                const r = parsedEventResolve;
                parsedEventResolve = null;
                r();
            }
        };
        const resultPromise = new Promise((resolve) => {
            const stderrChunks = [];
            proc.stderr?.on("data", (chunk) => {
                stderrChunks.push(chunk.toString());
            });
            const rl = createInterface({ input: proc.stdout });
            rl.on("line", (line) => {
                if (!line.trim())
                    return;
                const parsed = this.parseLine(line);
                for (const pe of parsed)
                    pushParsedEvent(pe);
                let event;
                try {
                    event = JSON.parse(line);
                }
                catch {
                    pushMessage({ type: "log", content: line, level: "debug" });
                    return;
                }
                const eventType = event.type;
                switch (eventType) {
                    case "text": {
                        const text = event.data ||
                            event.content ||
                            event.text ||
                            "";
                        if (text) {
                            lastOutput = (lastOutput || "") + text;
                            pushMessage({ type: "text", content: text });
                        }
                        break;
                    }
                    case "thought":
                    case "thinking": {
                        const text = event.data ||
                            event.content ||
                            event.text ||
                            "";
                        if (text)
                            pushMessage({ type: "thinking", content: text });
                        break;
                    }
                    case "end": {
                        const sessionId = event.sessionId ||
                            event.session_id ||
                            "";
                        if (sessionId) {
                            lastSessionId = sessionId;
                            resolveSessionId(sessionId);
                        }
                        // Prefer full final text if provided on end event
                        const finalText = event.text ||
                            event.data ||
                            "";
                        if (finalText)
                            lastOutput = finalText;
                        turnDone();
                        break;
                    }
                    case "error": {
                        const content = event.message ||
                            event.data ||
                            event.content ||
                            "grok error";
                        lastError = content;
                        resultStatus = "failed";
                        pushMessage({ type: "error", content });
                        turnDone();
                        break;
                    }
                    case "max_turns_reached": {
                        resultStatus = "failed";
                        if (!lastError)
                            lastError = "max turns reached";
                        pushMessage({ type: "error", content: lastError });
                        turnDone();
                        break;
                    }
                    case "tool_call":
                    case "tool_use": {
                        pushMessage({
                            type: "tool-use",
                            tool: event.name || event.tool || "",
                            callId: event.call_id || event.id || "",
                            input: event.input || event.args,
                        });
                        break;
                    }
                    case "tool_result":
                    case "tool_output": {
                        pushMessage({
                            type: "tool-result",
                            callId: event.call_id || event.id || "",
                            output: event.output || event.data || event.content || "",
                        });
                        break;
                    }
                    default: {
                        pushMessage({ type: "log", content: line, level: "debug" });
                    }
                }
            });
            proc.on("error", (err) => {
                resultStatus = "failed";
                lastError = `spawn error: ${err.message}`;
                resolveSessionId(lastSessionId);
                messageDone = true;
                parsedEventDone = true;
                if (messageResolve) {
                    const r = messageResolve;
                    messageResolve = null;
                    r();
                }
                if (parsedEventResolve) {
                    const r = parsedEventResolve;
                    parsedEventResolve = null;
                    r();
                }
                resolve({
                    status: "failed",
                    output: "",
                    error: lastError,
                    durationMs: Date.now() - startTime,
                    sessionId: lastSessionId,
                });
            });
            proc.on("close", (code) => {
                if (timeoutTimer)
                    clearTimeout(timeoutTimer);
                if (timedOut) {
                    resultStatus = "timeout";
                }
                else if (code !== 0 && resultStatus === "completed" && !turnDoneTriggered) {
                    if (!lastOutput) {
                        resultStatus = "failed";
                    }
                }
                const stderr = stderrChunks.join("");
                if (stderr && !lastError) {
                    lastError = stderr;
                }
                resolveSessionId(lastSessionId);
                messageDone = true;
                parsedEventDone = true;
                if (messageResolve) {
                    const r = messageResolve;
                    messageResolve = null;
                    r();
                }
                if (parsedEventResolve) {
                    const r = parsedEventResolve;
                    parsedEventResolve = null;
                    r();
                }
                resolve({
                    status: resultStatus,
                    output: lastOutput,
                    error: lastError,
                    durationMs: Date.now() - startTime,
                    sessionId: lastSessionId,
                });
            });
        });
        const messages = {
            [Symbol.asyncIterator]() {
                return {
                    async next() {
                        while (messageQueue.length === 0 && !messageDone) {
                            await new Promise((resolve) => {
                                messageResolve = resolve;
                            });
                        }
                        if (messageQueue.length > 0) {
                            return { value: messageQueue.shift(), done: false };
                        }
                        return { value: undefined, done: true };
                    },
                };
            },
        };
        const parsedEvents = {
            [Symbol.asyncIterator]() {
                return {
                    async next() {
                        while (parsedEventQueue.length === 0 && !parsedEventDone) {
                            await new Promise((resolve) => {
                                parsedEventResolve = resolve;
                            });
                        }
                        if (parsedEventQueue.length > 0) {
                            return { value: parsedEventQueue.shift(), done: false };
                        }
                        return { value: undefined, done: true };
                    },
                };
            },
        };
        const send = () => {
            return { ok: false, reason: "unsupported" };
        };
        const descriptor = {
            lifecycle: this.lifecycle,
            busyDeliveryMode: this.busyDeliveryMode,
            supportsStdinNotification: this.supportsStdinNotification,
        };
        return {
            pid: proc.pid,
            messages,
            parsedEvents,
            sessionId: sessionIdPromise,
            result: resultPromise,
            send,
            descriptor,
        };
    }
}
