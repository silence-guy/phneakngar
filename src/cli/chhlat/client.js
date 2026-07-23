import { PollResponseSchema, RegisterResponseSchema, } from "@phneakngar/shared";
export const TASK_ALREADY_TERMINAL_CODE = "TASK_ALREADY_TERMINAL";
export class ChhlatHttpError extends Error {
    status;
    code;
    constructor(status, message, code) {
        super(`HTTP ${status}: ${message}`);
        this.status = status;
        this.code = code;
        this.name = "ChhlatHttpError";
    }
}
export function isTaskAlreadyTerminalError(error) {
    return error instanceof ChhlatHttpError
        && error.status === 409
        && error.code === TASK_ALREADY_TERMINAL_CODE;
}
async function createHttpError(response) {
    const raw = await response.text();
    let message = raw || response.statusText || "request failed";
    let code;
    try {
        const body = JSON.parse(raw);
        if (typeof body.error === "string")
            message = body.error;
        if (typeof body.code === "string")
            code = body.code;
    }
    catch {
        // Preserve plain-text response bodies for actionable diagnostics.
    }
    return new ChhlatHttpError(response.status, message, code);
}
export class ChhlatClient {
    baseURL;
    constructor(baseURL) {
        this.baseURL = baseURL;
    }
    async request(method, path, token, body) {
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 500;
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await fetch(this.baseURL + path, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                });
                if (!res.ok)
                    throw await createHttpError(res);
                if (res.status === 204)
                    return undefined;
                return res.json();
            }
            catch (e) {
                if (e instanceof TypeError) {
                    lastError = e;
                    if (attempt < MAX_RETRIES) {
                        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
                        continue;
                    }
                }
                throw e;
            }
        }
        throw lastError;
    }
    async register(token, body) {
        const raw = await this.request("POST", "/api/chhlat/register", token, body);
        return RegisterResponseSchema.parse(raw);
    }
    async wsTicket(token, chhlatId) {
        const raw = await this.request("GET", `/api/ws/token?chhlat_id=${encodeURIComponent(chhlatId)}`, token);
        if (typeof raw !== "object" ||
            raw === null ||
            typeof raw.ticket !== "string" ||
            typeof raw.workspaceId !== "string" ||
            typeof raw.expiresAt !== "string") {
            throw new Error("invalid websocket ticket response");
        }
        return raw;
    }
    heartbeat(token, chhlatId) {
        return this.request("POST", "/api/chhlat/heartbeat", token, {
            chhlat_id: chhlatId,
        });
    }
    sweep(token, chhlatId) {
        return this.request("POST", "/api/chhlat/sweep", token, {
            chhlat_id: chhlatId,
        });
    }
    deregister(token, chhlatId) {
        return this.request("POST", "/api/chhlat/deregister", token, {
            chhlat_id: chhlatId,
        });
    }
    async poll(token, chhlatId, maxTasks, cliVersion) {
        const raw = await this.request("POST", "/api/chhlat/tasks/poll", token, { chhlat_id: chhlatId, max_tasks: maxTasks, ...(cliVersion && { cli_version: cliVersion }) });
        const resp = PollResponseSchema.parse(raw);
        return {
            tasks: resp.tasks,
            evicted: resp.evicted ?? false,
            pending_update: resp.pending_update,
            pending_rescan: resp.pending_rescan,
            file_requests: resp.file_requests,
            meetings: resp.meetings,
        };
    }
    startTask(token, taskId) {
        return this.request("POST", `/api/chhlat/tasks/${taskId}/start`, token);
    }
    completeTask(token, taskId, body) {
        return this.request("POST", `/api/chhlat/tasks/${taskId}/complete`, token, body);
    }
    failTask(token, taskId, error) {
        return this.request("POST", `/api/chhlat/tasks/${taskId}/fail`, token, {
            error,
        });
    }
    supersedeTask(token, taskId) {
        return this.request("POST", `/api/chhlat/tasks/${taskId}/supersede`, token);
    }
    async getArtifactMeta(token, artifactId, workspaceId) {
        return this.request("GET", `/api/artifacts/${artifactId}?workspace_id=${encodeURIComponent(workspaceId)}`, token);
    }
    async downloadArtifact(token, artifactId, workspaceId) {
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 500;
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await fetch(`${this.baseURL}/api/artifacts/${artifactId}/content?workspace_id=${encodeURIComponent(workspaceId)}`, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) {
                    throw new Error(`artifact download failed: HTTP ${res.status}`);
                }
                return res.arrayBuffer();
            }
            catch (e) {
                if (e instanceof TypeError) {
                    lastError = e;
                    if (attempt < MAX_RETRIES) {
                        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
                        continue;
                    }
                }
                throw e;
            }
        }
        throw lastError;
    }
    reportMessages(token, taskId, messages) {
        return this.request("POST", `/api/chhlat/tasks/${taskId}/messages`, token, { messages });
    }
    reportFileData(token, body) {
        return this.request("POST", "/api/chhlat/workspace/report", token, body);
    }
    syncSkills(token, body) {
        return this.request("POST", "/api/chhlat/skills/sync", token, body);
    }
    /**
     * Create a durable tool_action approval via machine-auth chhlat bridge.
     * Used by the CLI control_request gate (deny + approval id pointer).
     */
    createToolApproval(token, body) {
        return this.request("POST", "/api/chhlat/approvals", token, body);
    }
    /**
     * Poll a durable approval status (machine-auth hold/resume).
     */
    getToolApproval(token, approvalId) {
        return this.request("GET", `/api/chhlat/approvals/${encodeURIComponent(approvalId)}`, token);
    }
}
/**
 * Build a ToolActionApprovalCreator that POSTs through ChhlatClient.
 * Kept next to the client so tool-gate stays free of HTTP details.
 */
export function makeClientToolActionApprovalCreator(opts) {
    return async (input) => {
        const res = await opts.client.createToolApproval(opts.token, {
            chhlat_id: opts.chhlatId,
            agent_id: opts.agentId ?? null,
            tool_name: input.toolName,
            tool_class: input.toolClass,
            request_id: input.requestId,
            title: input.toolName
                ? `Tool: ${input.toolName}`
                : `Tool class: ${input.toolClass}`,
            summary: input.policyReason,
            input: input.input,
            policy_reason: input.policyReason,
            kind: "tool_action",
        });
        const id = res?.approval?.id;
        if (typeof id === "string" && id.trim()) {
            return { approvalId: id.trim() };
        }
        return null;
    };
}
