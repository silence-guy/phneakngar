import { describe, it, expect, vi } from "vitest";
import { createLinearClient } from "../../src/integrations/linear";

describe("createLinearClient", () => {
  it("returns 401 without api key", async () => {
    const client = createLinearClient({ apiKey: "" });
    const res = await client.createIssue({ teamId: "t1", title: "x" });
    expect(res).toEqual({ ok: false, status: 401, error: "missing api key" });
  });

  it("createIssue posts GraphQL mutation via mock fetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            issueCreate: {
              success: true,
              issue: { id: "iss_1", identifier: "ENG-1", url: "https://linear.app/i/1" },
            },
          },
        }),
        { status: 200 }
      )
    );
    const client = createLinearClient({
      apiKey: "lin_key",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const res = await client.createIssue({
      teamId: "team_1",
      title: "Follow up",
      description: "body",
    });
    expect(res).toEqual({
      ok: true,
      id: "iss_1",
      identifier: "ENG-1",
      url: "https://linear.app/i/1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.app/graphql",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "lin_key" }),
      })
    );
  });

  it("commentOnIssue maps GraphQL errors", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ errors: [{ message: "not found" }] }), { status: 200 })
    );
    const client = createLinearClient({
      apiKey: "lin_key",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const res = await client.commentOnIssue({ issueId: "iss_x", body: "hi" });
    expect(res).toEqual({ ok: false, status: 400, error: "not found" });
  });
});
