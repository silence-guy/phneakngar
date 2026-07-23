import { spawn } from "child_process";
import { createInterface } from "readline";
import { resolveApprovalHoldEnabled } from "@phneakngar/shared";
import { killProcessTree } from "../kill-tree.js";
import { handleToolControlRequestAsync, } from "../tool-gate.js";
/** Optional hold/resume poller (registered by CLI runtime when hold is enabled). */
let approvalHoldPoller = null;
/** Optional per-task runtime_config for hold resolve (set by session-runner). */
let approvalHoldRuntimeConfig = undefined;
export function setApprovalHoldRuntimeConfig(runtimeConfig) {
    approvalHoldRuntimeConfig = runtimeConfig;
}
export function getApprovalHoldRuntimeConfig() {
    return approvalHoldRuntimeConfig;
}
export function setApprovalHoldPoller(poller) {
    approvalHoldPoller = poller;
}
export function getApprovalHoldPoller() {
    return approvalHoldPoller;
}
export class ClaudeBackend {
    cliPath;
    name = "claude";
    lifecycle = { kind: "persistent", stdin: "gated", inFlightWake: "queue" };
    busyDeliveryMode = "gated";
    supportsStdinNotification = true;
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
            case "assistant": {
                const message = event.message;
                if (!message)
                    break;
                const content = message.content;
                if (!Array.isArray(content))
                    break;
                for (const block of content) {
                    if (block.type === "text") {
                        events.push({ kind: "text", text: block.text || "" });
                    }
                    else if (block.type === "thinking") {
                        events.push({ kind: "thinking", text: block.text || "" });
                    }
                    else if (block.type === "tool_use") {
                        events.push({ kind: "tool_call", name: block.name || "", input: block.input, callId: block.id });
                    }
                }
                break;
            }
            case "result": {
                const result = event.result;
                const isError = event.is_error;
                if (isError) {
                    events.push({ kind: "error", message: result || "unknown error" });
                }
                const resultSessionId = event.session_id;
                events.push({ kind: "turn_end", sessionId: resultSessionId || undefined });
                const usage = event.usage;
                if (usage || event.total_cost_usd != null) {
                    events.push({
                        kind: "telemetry",
                        name: "token_usage",
                        source: "claude_result_usage",
                        usageKind: "per_turn",
                        attrs: {
                            inputTokens: usage?.input_tokens,
                            outputTokens: usage?.output_tokens,
                            cachedInputTokens: usage?.cache_read_input_tokens,
                            cacheCreationInputTokens: usage?.cache_creation_input_tokens,
                            totalCostUsd: event.total_cost_usd,
                            durationMs: event.duration_ms,
                            durationApiMs: event.duration_api_ms,
                            numTurns: event.num_turns,
                            resultSubtype: event.subtype,
                            resultIsError: event.is_error,
                            serviceTier: usage?.service_tier,
                        },
                    });
                }
                break;
            }
            case "tool_result": {
                const toolUseId = event.tool_use_id;
                const content = event.content;
                events.push({ kind: "tool_output", callId: toolUseId, output: content });
                break;
            }
            case "system": {
                const subtype = event.subtype;
                if (subtype === "init") {
                    const sid = event.session_id;
                    events.push({ kind: "session_init", sessionId: sid || "" });
                }
                else if (subtype === "context_pruning" || subtype === "compaction") {
                    events.push({ kind: "compaction_started" });
                }
                else if (subtype === "compaction_finished" || subtype === "context_pruning_finished") {
                    events.push({ kind: "compaction_finished" });
                }
                else if (subtype === "status" || subtype === "stream_event") {
                    events.push({
                        kind: "internal_progress",
                        source: "claude_system",
                        itemType: subtype,
                        payloadBytes: line.length,
                    });
                }
                break;
            }
            case "control_request": {
                const requestId = event.request_id;
                if (requestId) {
                    events.push({ kind: "permission_request", requestId, payload: event.payload });
                }
                break;
            }
            default: {
                events.push({ kind: "log", content: line, level: "debug" });
            }
        }
        return events;
    }
    encodeStdinMessage(text, mode, opts) {
        const msg = {
            type: "user",
            message: {
                role: "user",
                content: [{ type: "text", text }],
            },
        };
        if (opts?.sessionId) {
            msg.session_id = opts.sessionId;
        }
        return JSON.stringify(msg);
    }
    execute(prompt, options) {
        // When steering is enabled, use --input-format stream-json and deliver
        // the initial prompt via stdin JSON write instead of -p. This allows
        // mid-turn message injection on the same stdin pipe. Without steering,
        // use the normal -p flag (--input-format stream-json + -p causes a hang).
        const useStdinPrompt = options.steeringEnabled === true;
        const args = [];
        if (!useStdinPrompt) {
            args.push("-p", prompt);
        }
        args.push("--output-format", "stream-json", "--verbose", "--permission-mode", "bypassPermissions");
        if (useStdinPrompt) {
            args.push("--input-format", "stream-json");
        }
        if (options.model) {
            args.push("--model", options.model);
        }
        if (options.maxTurns) {
            args.push("--max-turns", String(options.maxTurns));
        }
        if (options.resumeSessionId) {
            args.push("--resume", options.resumeSessionId);
        }
        const proc = spawn(this.cliPath, args, {
            cwd: options.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...options.env },
            shell: process.platform === "win32",
            windowsHide: true,
            // POSIX: own process group (pgid === pid) so the session-runner can reap
            // the CLI *and* its tool/MCP subprocesses via a group kill. No unref() —
            // we keep the handle for stdio streaming and the result promise.
            detached: process.platform !== "win32",
        });
        if (!proc.pid) {
            const error = `Failed to start ${this.cliPath}: binary not found or not executable. Is 'claude' installed and on PATH?`;
            const failedResult = { status: "failed", output: "", error, durationMs: 0, sessionId: "" };
            const emptyMessages = { [Symbol.asyncIterator]() { return { async next() { return { value: undefined, done: true }; } }; } };
            return { pid: undefined, messages: emptyMessages, sessionId: Promise.resolve(""), result: Promise.resolve(failedResult) };
        }
        let timedOut = false;
        let timeoutTimer;
        if (options.timeout) {
            timeoutTimer = setTimeout(() => {
                timedOut = true;
                // Reap the whole group (CLI + tool/MCP subprocesses), not just the leader.
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
        const messageQueue = [];
        let messageResolve = null;
        let messageDone = false;
        const pushMessage = (msg) => {
            messageQueue.push(msg);
            if (messageResolve) {
                const r = messageResolve;
                messageResolve = null;
                r();
            }
        };
        // ParsedEvent queue — parallel stream for steering layer observation
        const parsedEventQueue = [];
        let parsedEventResolve = null;
        let parsedEventDone = false;
        const pushParsedEvent = (evt) => {
            parsedEventQueue.push(evt);
            if (parsedEventResolve) {
                const r = parsedEventResolve;
                parsedEventResolve = null;
                r();
            }
        };
        // Serialized stdin write queue — prevents interleaved writes
        // from concurrent control_response and steering messages.
        const stdinWriteQueue = [];
        let stdinDraining = false;
        const enqueueStdinWrite = (data) => {
            stdinWriteQueue.push(data);
            drainStdinQueue();
        };
        const drainStdinQueue = () => {
            if (stdinDraining)
                return;
            stdinDraining = true;
            while (stdinWriteQueue.length > 0) {
                const line = stdinWriteQueue.shift();
                try {
                    proc.stdin?.write(line + "\n");
                }
                catch {
                    // stdin closed
                }
            }
            stdinDraining = false;
        };
        const resultPromise = new Promise((resolve) => {
            const stderrChunks = [];
            proc.stderr?.on("data", (chunk) => {
                stderrChunks.push(chunk.toString());
            });
            const rl = createInterface({ input: proc.stdout });
            // When steering mode, deliver the initial prompt via stdin JSON
            if (useStdinPrompt) {
                const initialMsg = JSON.stringify({
                    type: "user",
                    message: {
                        role: "user",
                        content: [{ type: "text", text: prompt }],
                    },
                });
                enqueueStdinWrite(initialMsg);
            }
            rl.on("line", (line) => {
                if (!line.trim())
                    return;
                // Emit ParsedEvents for steering layer
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
                    case "assistant": {
                        const message = event.message;
                        if (!message)
                            break;
                        const content = message.content;
                        if (!Array.isArray(content))
                            break;
                        for (const block of content) {
                            if (block.type === "text") {
                                lastOutput = block.text || "";
                                pushMessage({ type: "text", content: block.text });
                            }
                            else if (block.type === "thinking") {
                                pushMessage({ type: "thinking", content: block.text });
                            }
                            else if (block.type === "tool_use") {
                                pushMessage({
                                    type: "tool-use",
                                    tool: block.name,
                                    callId: block.id,
                                    input: block.input,
                                });
                            }
                        }
                        break;
                    }
                    case "result": {
                        const result = event.result;
                        const sessionId = event.session_id;
                        if (result)
                            lastOutput = result;
                        if (sessionId)
                            lastSessionId = sessionId;
                        const isError = event.is_error;
                        if (isError) {
                            resultStatus = "failed";
                            lastError = result || "unknown error";
                        }
                        // In steering mode (--input-format stream-json), Claude keeps the
                        // process alive waiting for more stdin. Close stdin on result so the
                        // process exits and session.result resolves.
                        if (useStdinPrompt) {
                            try {
                                proc.stdin?.end();
                            }
                            catch { /* already closed */ }
                        }
                        break;
                    }
                    case "tool_result": {
                        const content = event.content;
                        const toolUseId = event.tool_use_id;
                        pushMessage({
                            type: "tool-result",
                            callId: toolUseId,
                            output: content,
                        });
                        break;
                    }
                    case "system": {
                        const subtype = event.subtype;
                        if (subtype === "init") {
                            const sid = event.session_id;
                            if (sid) {
                                lastSessionId = sid;
                                resolveSessionId(sid);
                            }
                        }
                        break;
                    }
                    case "control_request": {
                        void handleControlRequest(proc, event, enqueueStdinWrite);
                        break;
                    }
                    default: {
                        pushMessage({
                            type: "log",
                            content: line,
                            level: "debug",
                        });
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
                else if (code !== 0 && resultStatus === "completed") {
                    resultStatus = "failed";
                }
                const stderr = stderrChunks.join("");
                if (stderr && !lastError) {
                    lastError = stderr;
                }
                // Resolve sessionId promise (fallback if system/init never fired)
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
        const send = (text, mode) => {
            const encoded = this.encodeStdinMessage(text, mode, { sessionId: lastSessionId || undefined });
            if (!encoded)
                return { ok: false, reason: "encoding failed" };
            if (!proc.stdin || proc.stdin.destroyed)
                return { ok: false, reason: "stdin closed" };
            enqueueStdinWrite(encoded);
            return { ok: true };
        };
        const descriptor = {
            lifecycle: this.lifecycle,
            busyDeliveryMode: this.busyDeliveryMode,
            supportsStdinNotification: this.supportsStdinNotification,
        };
        const closeStdin = () => {
            try {
                if (proc.stdin && !proc.stdin.destroyed)
                    proc.stdin.end();
            }
            catch { /* already closed */ }
        };
        return { pid: proc.pid, messages, parsedEvents, sessionId: sessionIdPromise, result: resultPromise, send, closeStdin, descriptor };
    }
}
/**
 * Whether hold/resume is enabled. Prefer agent runtime_config.approvalHold
 * (product default on); env CHHLAT_APPROVAL_HOLD / PHNEAKNGAR_APPROVAL_HOLD
 * force on/off when set.
 */
export function approvalHoldEnabledFromEnv(env = process.env) {
    return resolveApprovalHoldEnabled({
        runtimeConfig: approvalHoldRuntimeConfig,
        env,
    });
}
async function handleControlRequest(proc, event, enqueueStdinWrite) {
    // Shared approval policy gates high-stakes tool classes; low-stakes auto-allow.
    // When a process-level creator is configured, high-stakes denies also create a
    // durable tool_action approval and include its id as a deny pointer.
    // Optional hold/resume: CHHLAT_APPROVAL_HOLD=1 + registered poller waits for web decide.
    const holdEnabled = approvalHoldEnabledFromEnv();
    const poller = approvalHoldPoller;
    const gated = await handleToolControlRequestAsync(event, {
        hold: holdEnabled && poller
            ? {
                enabled: true,
                poll: poller,
                timeoutMs: Number(process.env.CHHLAT_APPROVAL_HOLD_MS ?? 120_000) || 120_000,
                intervalMs: Number(process.env.CHHLAT_APPROVAL_HOLD_INTERVAL_MS ?? 2_000) || 2_000,
            }
            : null,
    });
    if (!gated)
        return;
    // enqueueStdinWrite already appends "\n"; direct writes must include it.
    if (enqueueStdinWrite) {
        enqueueStdinWrite(gated.line);
    }
    else {
        try {
            proc.stdin?.write(gated.line + "\n");
        }
        catch {
            // stdin may be closed
        }
    }
}
