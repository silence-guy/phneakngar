/** Thin Linear write-back adapter. No real network — callers inject a fetch-like client. */

export type LinearClientOptions = {
  /** API key or secret-ref handle resolved by the runtime. */
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
};

export type CreateLinearIssueInput = {
  teamId: string;
  title: string;
  description?: string;
};

export type CreateLinearIssueResult = {
  ok: true;
  id: string;
  identifier: string;
  url: string;
} | {
  ok: false;
  status: number;
  error: string;
};

export type CommentOnLinearIssueInput = {
  issueId: string;
  body: string;
};

export type CommentOnLinearIssueResult = {
  ok: true;
  id: string;
} | {
  ok: false;
  status: number;
  error: string;
};

/**
 * Mock-friendly Linear GraphQL write client.
 */
export function createLinearClient(opts: LinearClientOptions) {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const baseUrl = (opts.baseUrl ?? "https://api.linear.app/graphql").replace(/\/$/, "");

  async function gql<T>(query: string, variables: Record<string, unknown>): Promise<
    | { ok: true; data: T }
    | { ok: false; status: number; error: string }
  > {
    if (!opts.apiKey) return { ok: false, status: 401, error: "missing api key" };
    if (!fetchImpl) return { ok: false, status: 500, error: "fetch unavailable" };

    const res = await fetchImpl(baseUrl, {
      method: "POST",
      headers: {
        authorization: opts.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text() };
    }
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      return { ok: false, status: 400, error: json.errors.map((e) => e.message).join("; ") };
    }
    return { ok: true, data: json.data as T };
  }

  async function createIssue(input: CreateLinearIssueInput): Promise<CreateLinearIssueResult> {
    const result = await gql<{
      issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } };
    }>(
      `mutation CreateIssue($teamId: String!, $title: String!, $description: String) {
        issueCreate(input: { teamId: $teamId, title: $title, description: $description }) {
          success
          issue { id identifier url }
        }
      }`,
      {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
      }
    );

    if (!result.ok) return result;
    const issue = result.data.issueCreate?.issue;
    if (!issue) return { ok: false, status: 500, error: "issueCreate returned no issue" };
    return { ok: true, id: issue.id, identifier: issue.identifier, url: issue.url };
  }

  async function commentOnIssue(
    input: CommentOnLinearIssueInput
  ): Promise<CommentOnLinearIssueResult> {
    const result = await gql<{
      commentCreate: { success: boolean; comment: { id: string } };
    }>(
      `mutation CreateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment { id }
        }
      }`,
      { issueId: input.issueId, body: input.body }
    );

    if (!result.ok) return result;
    const comment = result.data.commentCreate?.comment;
    if (!comment) return { ok: false, status: 500, error: "commentCreate returned no comment" };
    return { ok: true, id: comment.id };
  }

  return { createIssue, commentOnIssue };
}
