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
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
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

}
