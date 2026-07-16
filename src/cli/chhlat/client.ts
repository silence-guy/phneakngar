import {
  PollResponseSchema,
  RegisterResponseSchema,
  type CompleteTaskRequest,
  type FileRequestItem,
  type MessageItem,
  type PollMeetingItem,
  type PollResponse,
  type RegisterChhlatRequest,
  type RegisterResponse,
  type SkillSyncRequest,
  type TaskApi,
  type WorkspaceFileReport,
} from "@phneakngar/shared";

export const TASK_ALREADY_TERMINAL_CODE = "TASK_ALREADY_TERMINAL";

export class ChhlatHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(`HTTP ${status}: ${message}`);
    this.name = "ChhlatHttpError";
  }
}

export function isTaskAlreadyTerminalError(error: unknown): boolean {
  return error instanceof ChhlatHttpError
    && error.status === 409
    && error.code === TASK_ALREADY_TERMINAL_CODE;
}

async function createHttpError(response: Response): Promise<ChhlatHttpError> {
  const raw = await response.text();
  let message = raw || response.statusText || "request failed";
  let code: string | undefined;

  try {
    const body = JSON.parse(raw) as { error?: unknown; code?: unknown };
    if (typeof body.error === "string") message = body.error;
    if (typeof body.code === "string") code = body.code;
  } catch {
    // Preserve plain-text response bodies for actionable diagnostics.
  }

  return new ChhlatHttpError(response.status, message, code);
}

export class ChhlatClient {
  constructor(private baseURL: string) {}

  private async request<T>(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 500;
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(this.baseURL + path, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw await createHttpError(res);
        if (res.status === 204) return undefined as T;
        return res.json();
      } catch (e) {
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

  async register(
    token: string,
    body: RegisterChhlatRequest,
  ): Promise<RegisterResponse> {
    const raw = await this.request<unknown>(
      "POST",
      "/api/chhlat/register",
      token,
      body,
    );
    return RegisterResponseSchema.parse(raw);
  }

  async wsTicket(
    token: string,
    chhlatId: string,
  ): Promise<{ ticket: string; expiresAt: string; workspaceId: string; wsPort?: number }> {
    const raw = await this.request<unknown>(
      "GET",
      `/api/ws/token?chhlat_id=${encodeURIComponent(chhlatId)}`,
      token,
    );
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as { ticket?: unknown }).ticket !== "string" ||
      typeof (raw as { workspaceId?: unknown }).workspaceId !== "string" ||
      typeof (raw as { expiresAt?: unknown }).expiresAt !== "string"
    ) {
      throw new Error("invalid websocket ticket response");
    }
    return raw as { ticket: string; expiresAt: string; workspaceId: string; wsPort?: number };
  }

  heartbeat(token: string, chhlatId: string): Promise<unknown> {
    return this.request("POST", "/api/chhlat/heartbeat", token, {
      chhlat_id: chhlatId,
    });
  }

  sweep(token: string, chhlatId: string): Promise<unknown> {
    return this.request("POST", "/api/chhlat/sweep", token, {
      chhlat_id: chhlatId,
    });
  }

  deregister(token: string, chhlatId: string) {
    return this.request("POST", "/api/chhlat/deregister", token, {
      chhlat_id: chhlatId,
    });
  }

  async poll(
    token: string,
    chhlatId: string,
    maxTasks: number,
    cliVersion?: string,
  ): Promise<{
    tasks: TaskApi[];
    evicted: boolean;
    pending_update?: { version: string };
    pending_rescan?: boolean;
    file_requests?: FileRequestItem[];
    meetings?: PollMeetingItem[];
  }> {
    const raw = await this.request<unknown>(
      "POST",
      "/api/chhlat/tasks/poll",
      token,
      { chhlat_id: chhlatId, max_tasks: maxTasks, ...(cliVersion && { cli_version: cliVersion }) },
    );
    const resp: PollResponse = PollResponseSchema.parse(raw);
    return {
      tasks: resp.tasks,
      evicted: resp.evicted ?? false,
      pending_update: resp.pending_update,
      pending_rescan: resp.pending_rescan,
      file_requests: resp.file_requests,
      meetings: resp.meetings,
    };
  }

  startTask(token: string, taskId: string) {
    return this.request("POST", `/api/chhlat/tasks/${taskId}/start`, token);
  }

  completeTask(
    token: string,
    taskId: string,
    body: CompleteTaskRequest,
  ) {
    return this.request(
      "POST",
      `/api/chhlat/tasks/${taskId}/complete`,
      token,
      body,
    );
  }

  failTask(token: string, taskId: string, error: string) {
    return this.request("POST", `/api/chhlat/tasks/${taskId}/fail`, token, {
      error,
    });
  }

  supersedeTask(token: string, taskId: string) {
    return this.request("POST", `/api/chhlat/tasks/${taskId}/supersede`, token);
  }

  async getArtifactMeta(
    token: string,
    artifactId: string,
    workspaceId: string,
  ): Promise<{ id: string; filename: string; content_type: string; size: number }> {
    return this.request(
      "GET",
      `/api/artifacts/${artifactId}?workspace_id=${encodeURIComponent(workspaceId)}`,
      token,
    );
  }

  async downloadArtifact(
    token: string,
    artifactId: string,
    workspaceId: string,
  ): Promise<ArrayBuffer> {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 500;
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(
          `${this.baseURL}/api/artifacts/${artifactId}/content?workspace_id=${encodeURIComponent(workspaceId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          throw new Error(`artifact download failed: HTTP ${res.status}`);
        }
        return res.arrayBuffer();
      } catch (e) {
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

  reportMessages(
    token: string,
    taskId: string,
    messages: MessageItem[],
  ) {
    return this.request(
      "POST",
      `/api/chhlat/tasks/${taskId}/messages`,
      token,
      { messages },
    );
  }

  reportFileData(token: string, body: WorkspaceFileReport) {
    return this.request(
      "POST",
      "/api/chhlat/workspace/report",
      token,
      body,
    );
  }

  syncSkills(token: string, body: SkillSyncRequest) {
    return this.request(
      "POST",
      "/api/chhlat/skills/sync",
      token,
      body,
    );
  }

  /**
   * Create a durable tool_action approval via machine-auth chhlat bridge.
   * Used by the CLI control_request gate (deny + approval id pointer).
   */
  createToolApproval(
    token: string,
    body: CreateChhlatToolApprovalRequest,
  ): Promise<CreateChhlatToolApprovalResponse> {
    return this.request(
      "POST",
      "/api/chhlat/approvals",
      token,
      body,
    );
  }

}

/** Request body for POST /api/chhlat/approvals */
export type CreateChhlatToolApprovalRequest = {
  chhlat_id: string;
  agent_id?: string | null;
  tool_name?: string | null;
  tool_class?: string | null;
  request_id?: string | null;
  title?: string;
  summary?: string;
  input?: unknown;
  policy_reason?: string | null;
  kind?: string | null;
};

export type CreateChhlatToolApprovalResponse = {
  approval: {
    id: string;
    kind?: string;
    status?: string;
    title?: string;
    summary?: string;
    [key: string]: unknown;
  };
};

/**
 * Build a ToolActionApprovalCreator that POSTs through ChhlatClient.
 * Kept next to the client so tool-gate stays free of HTTP details.
 */
export function makeClientToolActionApprovalCreator(opts: {
  client: ChhlatClient;
  token: string;
  chhlatId: string;
  agentId?: string | null;
}): (
  input: {
    toolName: string | null;
    toolClass: string;
    requestId: string;
    input: unknown;
    policyReason: string;
  },
) => Promise<{ approvalId: string } | null> {
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
