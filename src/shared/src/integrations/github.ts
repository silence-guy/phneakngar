/** Thin GitHub write-back adapter. No real network — callers inject a fetch-like client. */

export type GitHubClientOptions = {
  /** Secret token or secret-ref handle resolved by the runtime. */
  token: string;
  /** Optional injected fetch for tests / workers. Defaults to global fetch. */
  fetch?: typeof fetch;
  baseUrl?: string;
};

export type CreateIssueInput = {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
};

export type CreateIssueResult = {
  ok: true;
  id: number;
  number: number;
  html_url: string;
} | {
  ok: false;
  status: number;
  error: string;
};

export type CommentOnIssueInput = {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
};

export type CommentOnIssueResult = {
  ok: true;
  id: number;
  html_url: string;
} | {
  ok: false;
  status: number;
  error: string;
};

/**
 * Mock-friendly GitHub write client. Does not perform real network calls unless
 * a real `fetch` is provided and invoked by the runtime.
 */
export function createGitHubClient(opts: GitHubClientOptions) {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const baseUrl = (opts.baseUrl ?? "https://api.github.com").replace(/\/$/, "");

  async function createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    if (!opts.token) return { ok: false, status: 401, error: "missing token" };
    if (!fetchImpl) return { ok: false, status: 500, error: "fetch unavailable" };

    const res = await fetchImpl(`${baseUrl}/repos/${input.owner}/${input.repo}/issues`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${opts.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: input.labels,
      }),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text() };
    }
    const data = (await res.json()) as { id: number; number: number; html_url: string };
    return { ok: true, id: data.id, number: data.number, html_url: data.html_url };
  }

  async function commentOnIssue(input: CommentOnIssueInput): Promise<CommentOnIssueResult> {
    if (!opts.token) return { ok: false, status: 401, error: "missing token" };
    if (!fetchImpl) return { ok: false, status: 500, error: "fetch unavailable" };

    const res = await fetchImpl(
      `${baseUrl}/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${opts.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: input.body }),
      }
    );

    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text() };
    }
    const data = (await res.json()) as { id: number; html_url: string };
    return { ok: true, id: data.id, html_url: data.html_url };
  }

  return { createIssue, commentOnIssue };
}
