import { describe, it, expect, vi } from "vitest";
import { createGitHubClient } from "../../src/integrations/github";

describe("createGitHubClient", () => {
  it("returns 401 without token", async () => {
    const client = createGitHubClient({ token: "" });
    const res = await client.createIssue({
      owner: "o",
      repo: "r",
      title: "t",
    });
    expect(res).toEqual({ ok: false, status: 401, error: "missing token" });
  });

  it("createIssue posts to mock fetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 1, number: 42, html_url: "https://gh/i/42" }), {
        status: 201,
      })
    );
    const client = createGitHubClient({ token: "tok", fetch: fetchMock as unknown as typeof fetch });
    const res = await client.createIssue({
      owner: "acme",
      repo: "app",
      title: "Ship it",
      body: "details",
    });
    expect(res).toEqual({
      ok: true,
      id: 1,
      number: 42,
      html_url: "https://gh/i/42",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/app/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer tok",
        }),
      })
    );
  });

  it("commentOnIssue surfaces non-ok responses", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 403 }));
    const client = createGitHubClient({ token: "tok", fetch: fetchMock as unknown as typeof fetch });
    const res = await client.commentOnIssue({
      owner: "acme",
      repo: "app",
      issueNumber: 7,
      body: "done",
    });
    expect(res).toEqual({ ok: false, status: 403, error: "nope" });
  });
});
