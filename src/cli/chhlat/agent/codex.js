import { spawn } from "child_process";
import { createInterface } from "readline";
import { killProcessTree } from "../kill-tree.js";
const RAW_DETECTION_METHODS = new Set([
    "turn/started",
    "turn/completed",
    "thread/started",
    "item/started",
    "item/completed",
    "item/agentMessage/delta",
]);
/** Extract thread ID from a thread/start response. */
export function extractThreadID(response) {
    if (response && typeof response === "object") {
        const r = response;
        // Try nested result.thread.id first, then thread.id, then top-level id
        const thread = r.result?.thread ??
            r.thread;
        if (thread && typeof thread === "object") {
            const id = thread.id;
            if (typeof id === "string" && id)
                return id;
        }
        if (typeof r.id === "string" && r.id)
            return r.id;
    }
    return "";
}
export class CodexBackend {
    cliPath;
    name = "codex";
    lifecycle = { kind: "persistent", stdin: "direct", inFlightWake: "steer" };
    busyDeliveryMode = "direct";
    supportsStdinNotification = true;
    _rpcId = 0;
    constructor(cliPath) {
        this.cliPath = cliPath;
    }
    parseLine(line) {
        if (!line.trim())
            return [];
        let msg;
        try {
            msg = JSON.parse(line);
        }
        catch {
            return [{ kind: "log", content: line, level: "debug" }];
        }
        // Response (has id, no method) — not a parseable event
        if (msg.id !== undefined && !msg.method)
            return [];
        // Server request (has both id AND method) — not a parseable event
        if (msg.id !== undefined && msg.method)
            return [];
        // Notification (has method, no id)
        if (!msg.method)
            return [{ kind: "log", content: line, level: "debug" }];
        const method = msg.method;
        const params = msg.params || {};
        // Legacy protocol
        if (method === "codex/event") {
            return this.parseLegacyEvent(params);
        }
        // Raw protocol
        const events = [];
        switch (method) {
            case "turn/started":
                break;
            case "turn/completed": {
                const turn = params.turn;
                const status = turn?.status || params.status || "";
                if (status === "error" || status === "failed") {
                    const turnErr = turn?.error;
                    events.push({ kind: "error", message: turnErr?.message || "codex turn failed" });
                }
                events.push({ kind: "turn_end" });
                break;
            }
            case "error": {
                const errObj = params.error;
                const errMsg = errObj?.message || params.message || "";
                const willRetry = params.willRetry === true;
                if (errMsg && !willRetry) {
                    events.push({ kind: "error", message: errMsg });
                }
                break;
            }
            case "thread/status/changed": {
                const statusObj = params.status;
                const statusType = typeof statusObj === "object" && statusObj !== null
                    ? statusObj.type || ""
                    : statusObj || "";
                if (statusType === "idle") {
                    events.push({ kind: "turn_end" });
                }
                break;
            }
            case "item/started": {
                const item = params.item;
                if (!item)
                    break;
                const itemType = item.type;
                if (itemType === "commandExecution" || itemType === "fileChange") {
                    events.push({
                        kind: "tool_call",
                        name: itemType === "commandExecution" ? "exec_command" : "patch_apply",
                        callId: item.id,
                        input: item,
                    });
                }
                else if (itemType === "mcpToolCall") {
                    events.push({
                        kind: "tool_call",
                        name: `mcp_${item.name || "tool"}`,
                        callId: item.id,
                        input: item,
                    });
                }
                else if (itemType === "webSearch") {
                    events.push({
                        kind: "tool_call",
                        name: "web_search",
                        callId: item.id,
                        input: item,
                    });
                }
                else if (itemType === "collabAgentToolCall") {
                    events.push({
                        kind: "tool_call",
                        name: "collab_agent",
                        callId: item.id,
                        input: item,
                    });
                }
                else if (itemType === "contextCompaction") {
                    events.push({ kind: "compaction_started" });
                }
                break;
            }
            case "item/completed": {
                const item = params.item;
                if (!item)
                    break;
                const itemType = item.type;
                if (itemType === "commandExecution") {
                    events.push({ kind: "tool_output", callId: item.id, output: item.aggregatedOutput || "" });
                }
                else if (itemType === "fileChange") {
                    events.push({ kind: "tool_output", callId: item.id, output: "" });
                }
                else if (itemType === "mcpToolCall") {
                    events.push({ kind: "tool_output", callId: item.id, name: `mcp_${item.name || "tool"}`, output: item.output || "" });
                }
                else if (itemType === "agentMessage") {
                    const flatText = item.text;
                    if (flatText) {
                        events.push({ kind: "text", text: flatText });
                    }
                    else {
                        const content = item.content;
                        if (Array.isArray(content)) {
                            for (const block of content) {
                                if ((block.type === "output_text" || block.type === "text") && block.text) {
                                    events.push({ kind: "text", text: block.text });
                                }
                            }
                        }
                    }
                }
                else if (itemType === "reasoning") {
                    events.push({ kind: "thinking", text: item.text || "" });
                }
                else if (itemType === "contextCompaction") {
                    events.push({ kind: "compaction_finished" });
                }
                break;
            }
            case "item/agentMessage/delta": {
                const delta = params.delta;
                if (delta)
                    events.push({ kind: "text", text: delta });
                break;
            }
            default:
                events.push({ kind: "log", content: JSON.stringify(msg), level: "debug" });
        }
        return events;
    }
    parseLegacyEvent(params) {
        const eventType = params.type;
        if (!eventType)
            return [];
        const events = [];
        switch (eventType) {
            case "agent_message": {
                const text = params.text || params.message || "";
                if (text)
                    events.push({ kind: "text", text });
                break;
            }
            case "exec_command_begin":
                events.push({ kind: "tool_call", name: "exec_command", callId: params.id, input: params });
                break;
            case "exec_command_end":
                events.push({ kind: "tool_output", callId: params.id, output: params.output || "" });
                break;
            case "patch_apply_begin":
                events.push({ kind: "tool_call", name: "patch_apply", callId: params.id, input: params });
                break;
            case "patch_apply_end":
                events.push({ kind: "tool_output", callId: params.id, output: params.output || "" });
                break;
            case "task_complete":
                events.push({ kind: "turn_end" });
                break;
            case "turn_aborted":
                events.push({ kind: "turn_end" });
                break;
            default:
                break;
        }
        return events;
    }
    encodeStdinMessage(text, mode, opts) {
        const threadId = opts?.threadId;
        if (!threadId)
            return null;
        const id = opts?.requestId ?? ++this._rpcId;
        const method = mode === "busy" ? "turn/steer" : "turn/start";
        return JSON.stringify({
            jsonrpc: "2.0",
            id,
            method,
            params: {
                threadId,
                input: [{ type: "text", text }],
            },
        });
    }
    execute(prompt, options) {
        const proc = spawn(this.cliPath, ["app-server", "--listen", "stdio://", "--config", "sandbox_mode=danger-full-access"], {
            cwd: options.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...options.env },
            shell: process.platform === "win32",
            windowsHide: true,
            // POSIX: own process group (pgid === pid) so the session-runner can reap
            // the CLI *and* its spawned workers via a group kill. No unref() — we keep
            // the handle for stdio streaming and the result promise.
            detached: process.platform !== "win32",
        });
        if (!proc.pid) {
            const error = `Failed to start ${this.cliPath}: binary not found or not executable. Is 'codex' installed and on PATH?`;
            const failedResult = { status: "failed", output: "", error, durationMs: 0, sessionId: "" };
            const emptyMessages = { [Symbol.asyncIterator]() { return { async next() { return { value: undefined, done: true }; } }; } };
            return { pid: undefined, messages: emptyMessages, sessionId: Promise.resolve(""), result: Promise.resolve(failedResult) };
        }
        let timedOut = false;
        let timeoutTimer;
        if (options.timeout) {
            timeoutTimer = setTimeout(() => {
                timedOut = true;
                // Reap the whole group (CLI + spawned workers), not just the leader.
                if (proc.pid !== undefined)
                    void killProcessTree(proc.pid);
            }, options.timeout);
        }
        const startTime = Date.now();
        let requestId = 0;
        let lastOutput = "";
        let lastError = "";
        let resultStatus = "completed";
        let sessionId = "";
        let resolveSessionId;
        const sessionIdPromise = new Promise((resolve) => {
            resolveSessionId = resolve;
        });
        // Protocol detection state
        let notificationProtocol = "unknown";
        // Turn lifecycle state
        let turnStarted = false;
        let turnDoneTriggered = false;
        let turnCompletedSuccessfully = false;
        let lastCompletedTurnId = "";
        let turnError = "";
        // Pending RPC callbacks
        const pendingRequests = new Map();
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
        const writeStdin = (data) => {
            try {
                proc.stdin?.write(data + "\n");
            }
            catch {
                // stdin closed
            }
        };
        const sendRpc = (method, params) => {
            const id = ++requestId;
            const msg = { jsonrpc: "2.0", id, method, params };
            writeStdin(JSON.stringify(msg));
            return new Promise((resolve, reject) => {
                pendingRequests.set(id, { resolve, reject });
            });
        };
        const sendNotification = (method) => {
            const msg = { jsonrpc: "2.0", method };
            writeStdin(JSON.stringify(msg));
        };
        const sendResponse = (id, result) => {
            const msg = { jsonrpc: "2.0", id, result };
            writeStdin(JSON.stringify(msg));
        };
        /** Cancel all pending RPC requests. */
        const closeAllPending = (reason) => {
            for (const [, cb] of pendingRequests) {
                cb.reject(new Error(reason));
            }
            pendingRequests.clear();
        };
        const setTurnError = (msg) => {
            if (msg && !turnError)
                turnError = msg;
        };
        const steeringKeepAlive = options.steeringEnabled === true;
        const triggerTurnDone = (aborted) => {
            if (turnDoneTriggered)
                return;
            turnDoneTriggered = true;
            resultStatus = aborted ? "aborted" : "completed";
            if (!steeringKeepAlive) {
                try {
                    proc.stdin?.end();
                }
                catch { /* already closed */ }
                try {
                    proc.kill("SIGTERM");
                }
                catch { /* already dead */ }
            }
        };
        const handleServerRequest = (msg) => {
            const method = msg.method;
            const id = msg.id;
            switch (method) {
                case "item/commandExecution/requestApproval":
                case "execCommandApproval":
                case "item/fileChange/requestApproval":
                case "applyPatchApproval":
                    sendResponse(id, { decision: "accept" });
                    break;
                default:
                    sendResponse(id, {});
                    break;
            }
        };
        const handleNotification = (msg) => {
            const method = msg.method;
            const params = msg.params || {};
            // Legacy protocol detection
            if (method === "codex/event") {
                if (notificationProtocol === "raw")
                    return; // locked to raw, ignore legacy
                notificationProtocol = "legacy";
                handleLegacyEvent(params);
                return;
            }
            // Raw protocol detection — these methods trigger detection
            if (RAW_DETECTION_METHODS.has(method)) {
                if (notificationProtocol === "legacy")
                    return; // locked to legacy, ignore raw
                notificationProtocol = "raw";
            }
            // thread/status/changed and error are raw-only but NOT detection triggers
            if ((method === "thread/status/changed" || method === "error") && notificationProtocol === "legacy") {
                return;
            }
            // Subagent thread filtering: ignore notifications from threads other than ours
            const notifThreadId = params.threadId;
            if (sessionId && notifThreadId && notifThreadId !== sessionId) {
                return;
            }
            switch (method) {
                case "turn/started": {
                    turnStarted = true;
                    break;
                }
                case "turn/completed": {
                    const turn = params.turn;
                    const turnId = turn?.id || params.turnId || "";
                    if (turnId && turnId === lastCompletedTurnId)
                        return;
                    if (turnId)
                        lastCompletedTurnId = turnId;
                    const status = turn?.status || params.status || "";
                    if (status === "completed" || status === "finished") {
                        turnCompletedSuccessfully = true;
                        triggerTurnDone(false);
                    }
                    else if (status === "cancelled" || status === "aborted" || status === "interrupted") {
                        triggerTurnDone(true);
                    }
                    else if (status === "error" || status === "failed") {
                        const turnErr = turn?.error;
                        setTurnError(turnErr?.message || "codex turn failed");
                        triggerTurnDone(false);
                    }
                    break;
                }
                case "error": {
                    const errObj = params.error;
                    const errMsg = errObj?.message || params.message || "";
                    const willRetry = params.willRetry === true;
                    if (errMsg && !willRetry) {
                        setTurnError(errMsg);
                    }
                    break;
                }
                case "thread/status/changed": {
                    const statusObj = params.status;
                    const statusType = typeof statusObj === "object" && statusObj !== null
                        ? statusObj.type || ""
                        : statusObj || "";
                    if (statusType === "idle" && turnStarted) {
                        triggerTurnDone(false);
                    }
                    break;
                }
                case "item/started": {
                    const item = params.item;
                    if (!item)
                        break;
                    const itemType = item.type;
                    if (itemType === "commandExecution") {
                        pushMessage({
                            type: "tool-use",
                            tool: "exec_command",
                            callId: item.id,
                            input: item,
                        });
                    }
                    else if (itemType === "fileChange") {
                        pushMessage({
                            type: "tool-use",
                            tool: "patch_apply",
                            callId: item.id,
                            input: item,
                        });
                    }
                    break;
                }
                case "item/completed": {
                    const item = params.item;
                    if (!item)
                        break;
                    const itemType = item.type;
                    if (itemType === "commandExecution") {
                        const output = item.aggregatedOutput || "";
                        pushMessage({
                            type: "tool-result",
                            callId: item.id,
                            output,
                        });
                    }
                    else if (itemType === "fileChange") {
                        pushMessage({
                            type: "tool-result",
                            callId: item.id,
                            output: "",
                        });
                    }
                    else if (itemType === "agentMessage") {
                        const flatText = item.text;
                        if (flatText) {
                            pushMessage({ type: "text", content: flatText });
                            lastOutput = flatText;
                        }
                        else {
                            const content = item.content;
                            if (Array.isArray(content)) {
                                for (const block of content) {
                                    if (block.type === "output_text" || block.type === "text") {
                                        if (block.text) {
                                            pushMessage({ type: "text", content: block.text });
                                            lastOutput = block.text;
                                        }
                                    }
                                }
                            }
                        }
                        const phase = item.phase;
                        if (phase === "final_answer") {
                            triggerTurnDone(false);
                        }
                    }
                    break;
                }
                default: {
                    pushMessage({
                        type: "log",
                        content: JSON.stringify(msg),
                        level: "debug",
                    });
                }
            }
        };
        const handleLegacyEvent = (params) => {
            const eventType = params.type;
            if (!eventType)
                return;
            switch (eventType) {
                case "task_started":
                    break;
                case "agent_message": {
                    const text = params.text || params.message || "";
                    if (text) {
                        pushMessage({ type: "text", content: text });
                        lastOutput = text;
                    }
                    break;
                }
                case "exec_command_begin":
                    pushMessage({
                        type: "tool-use",
                        tool: "exec_command",
                        callId: params.id,
                        input: params,
                    });
                    break;
                case "exec_command_end":
                    pushMessage({
                        type: "tool-result",
                        callId: params.id,
                        output: params.output || "",
                    });
                    break;
                case "patch_apply_begin":
                    pushMessage({
                        type: "tool-use",
                        tool: "patch_apply",
                        callId: params.id,
                        input: params,
                    });
                    break;
                case "patch_apply_end":
                    pushMessage({
                        type: "tool-result",
                        callId: params.id,
                        output: params.output || "",
                    });
                    break;
                case "task_complete": {
                    const output = params.output;
                    if (output)
                        lastOutput = output;
                    triggerTurnDone(false);
                    break;
                }
                case "turn_aborted":
                    triggerTurnDone(true);
                    break;
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
                // Emit ParsedEvents for steering layer
                const parsed = this.parseLine(line);
                for (const pe of parsed)
                    pushParsedEvent(pe);
                let msg;
                try {
                    msg = JSON.parse(line);
                }
                catch {
                    pushMessage({ type: "log", content: line, level: "debug" });
                    return;
                }
                // Route: server request (has both id AND method)
                if (msg.id !== undefined && msg.method) {
                    handleServerRequest(msg);
                    return;
                }
                // Route: notification (has method, no id)
                if (msg.method && msg.id === undefined) {
                    handleNotification(msg);
                    return;
                }
                // Route: response (has id, no method) — both success and error
                if (msg.id !== undefined && !msg.method) {
                    const pending = pendingRequests.get(msg.id);
                    if (pending) {
                        pendingRequests.delete(msg.id);
                        if (msg.error) {
                            pending.reject(new Error(msg.error.message));
                        }
                        else {
                            pending.resolve(msg.result);
                        }
                    }
                    return;
                }
                // Fallback
                pushMessage({
                    type: "log",
                    content: JSON.stringify(msg),
                    level: "debug",
                });
            });
            // Handshake: initialize → initialized → thread/start → turn/start
            const startHandshake = async () => {
                try {
                    // 1. Initialize
                    await sendRpc("initialize", {
                        clientInfo: {
                            name: "phneakngar-chhlat",
                            title: "ភ្នាក់ងារ Agent SDK",
                            version: "0.1.0",
                        },
                        capabilities: { experimentalApi: true },
                    });
                    // 2. Send initialized notification
                    sendNotification("initialized");
                    // 3. Start or resume thread
                    let threadResponse;
                    if (options.resumeSessionId) {
                        // thread/resume reopens an existing thread by ID
                        threadResponse = await sendRpc("thread/resume", {
                            threadId: options.resumeSessionId,
                            ...(options.model ? { model: options.model } : {}),
                        });
                        sessionId = options.resumeSessionId;
                    }
                    else {
                        // thread/start creates a new thread
                        const threadParams = {
                            cwd: options.cwd,
                            sandboxPolicy: { type: "dangerFullAccess" },
                            approvalPolicy: "never",
                            persistExtendedHistory: true,
                            experimentalRawEvents: false,
                        };
                        if (options.model) {
                            threadParams.model = options.model;
                        }
                        threadResponse = await sendRpc("thread/start", threadParams);
                        sessionId = extractThreadID(threadResponse);
                    }
                    resolveSessionId(sessionId);
                    // 5. Send turn/start with the prompt
                    await sendRpc("turn/start", {
                        threadId: sessionId,
                        input: [{ type: "text", text: prompt }],
                        sandboxPolicy: { type: "dangerFullAccess" },
                        approvalPolicy: "never",
                    });
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : "handshake failed";
                    lastError = errMsg;
                    resultStatus = "failed";
                    pushMessage({ type: "error", content: errMsg });
                }
            };
            startHandshake();
            proc.on("error", (err) => {
                resultStatus = "failed";
                lastError = `spawn error: ${err.message}`;
                closeAllPending("spawn error");
                resolveSessionId(sessionId);
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
                    sessionId,
                });
            });
            proc.on("close", (code) => {
                if (timeoutTimer)
                    clearTimeout(timeoutTimer);
                closeAllPending("process closed");
                if (timedOut) {
                    resultStatus = "timeout";
                }
                else if (code !== 0 && resultStatus === "completed" && !turnCompletedSuccessfully) {
                    // If agent already produced output, treat as completed despite non-zero exit
                    // (e.g. MCP transport errors can crash the process after a successful response)
                    if (!lastOutput) {
                        resultStatus = "failed";
                    }
                }
                const stderr = stderrChunks.join("").replace(/\x1b\[[0-9;]*m/g, "");
                if (stderr && !lastError) {
                    lastError = stderr;
                }
                if (turnError) {
                    resultStatus = "failed";
                    lastError = turnError;
                }
                // Resolve sessionId promise (fallback if handshake never completed)
                resolveSessionId(sessionId);
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
                    sessionId,
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
            if (!proc.stdin || proc.stdin.destroyed)
                return { ok: false, reason: "stdin closed" };
            const encoded = this.encodeStdinMessage(text, mode, { threadId: sessionId, requestId: ++requestId });
            if (!encoded)
                return { ok: false, reason: "encoding failed (no threadId)" };
            writeStdin(encoded);
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
