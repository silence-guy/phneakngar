import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const postJSONMock = vi.fn();
const patchJSONMock = vi.fn();
const getJSONMock = vi.fn();

vi.mock("../lib/client.js", () => ({
  APIClient: class {
    getJSON(...a: unknown[]) {
      return getJSONMock(...a);
    }
    postJSON(...a: unknown[]) {
      return postJSONMock(...a);
    }
    patchJSON(...a: unknown[]) {
      return patchJSONMock(...a);
    }
  },
}));

vi.mock("../lib/resolve-client.js", () => ({
  resolveClientOpts: vi.fn(() => ({
    serverUrl: "http://localhost:3000",
    token: "test-token",
    workspaceId: "ws_test",
  })),
}));

import { issueCommand } from "./issue";
import { resolveClientOpts } from "../lib/resolve-client.js";

const mockedResolve = resolveClientOpts as unknown as ReturnType<typeof vi.fn>;

describe("issueCommand", () => {
  const cmd = issueCommand();

  it("registers issue subcommands", () => {
    const names = cmd.commands.map((c) => c.name());
    expect(names).toContain("create");
    expect(names).toContain("list");
    expect(names).toContain("show");
    expect(names).toContain("update");
    expect(names).toContain("claim");
    expect(names).toContain("handback");
    expect(names).toContain("comment");
  });

  it("create requires title; --agent_id is optional (env fallback)", () => {
    const create = cmd.commands.find((c) => c.name() === "create")!;
    const opts = (create as unknown as { options: { long: string; mandatory?: boolean }[] }).options;
    const mandatory = opts.filter((o) => o.mandatory).map((o) => o.long);
    expect(mandatory).not.toContain("--agent_id");
    expect(mandatory).toContain("--title");
  });

  it("show/update/comment/claim require issue_id; --agent_id is optional (env fallback)", () => {
    for (const name of ["show", "update", "comment", "claim", "handback"]) {
      const sub = cmd.commands.find((c) => c.name() === name)!;
      const opts = (sub as unknown as { options: { long: string; mandatory?: boolean }[] }).options;
      const mandatory = opts.filter((o) => o.mandatory).map((o) => o.long);
      expect(mandatory).not.toContain("--agent_id");
      expect(mandatory).toContain("--issue_id");
    }
  });

  it("update supports status, title, description, and body-file", () => {
    const update = cmd.commands.find((c) => c.name() === "update")!;
    const opts = (update as unknown as { options: { long: string }[] }).options;
    const longs = opts.map((o) => o.long);
    expect(longs).toContain("--status");
    expect(longs).toContain("--title");
    expect(longs).toContain("--description");
    expect(longs).toContain("--body-file");
  });

  it("shows Khmer status labels in help without replacing status values", () => {
    const list = cmd.commands.find((c) => c.name() === "list")!;
    const update = cmd.commands.find((c) => c.name() === "update")!;
    const listStatus = (list as unknown as { options: { long: string; description: string }[] }).options.find(
      (o) => o.long === "--status",
    );
    const updateStatus = (update as unknown as { options: { long: string; description: string }[] }).options.find(
      (o) => o.long === "--status",
    );

    expect(listStatus?.description).toContain("todo (ត្រូវធ្វើ)");
    expect(listStatus?.description).toContain("in_progress (កំពុងដំណើរការ)");
    expect(listStatus?.description).toContain("blocked (ជាប់គាំង)");
    expect(updateStatus?.description).toContain("done (រួចរាល់)");
    expect(updateStatus?.description).toContain("failed (បរាជ័យ)");
    expect(updateStatus?.description).toContain("blocked (ជាប់គាំង)");
  });

  it("claim and handback help text describe ownership transfer", () => {
    const claim = cmd.commands.find((c) => c.name() === "claim")!;
    const handback = cmd.commands.find((c) => c.name() === "handback")!;
    expect(claim.description()).toMatch(/claim/i);
    expect(handback.description()).toMatch(/release claim|hand back|another agent/i);
  });
});

describe("issue claim/handback/update wiring", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;
  let mockExit: ReturnType<typeof vi.spyOn>;
  const prevAgent = process.env.PHNEAKNGAR_AGENT_ID;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PHNEAKNGAR_AGENT_ID;
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    mockedResolve.mockReturnValue({
      serverUrl: "http://localhost:3000",
      token: "test-token",
      workspaceId: "ws_test",
    });
  });

  afterEach(() => {
    if (prevAgent === undefined) delete process.env.PHNEAKNGAR_AGENT_ID;
    else process.env.PHNEAKNGAR_AGENT_ID = prevAgent;
    consoleSpy.mockRestore();
    consoleErrSpy.mockRestore();
    mockExit.mockRestore();
  });

  async function run(args: string[]) {
    const cmd = issueCommand();
    await cmd.parseAsync(["node", "issue", ...args]);
  }

  it("claim posts agent_id to /api/issues/:id/claim", async () => {
    postJSONMock.mockResolvedValueOnce({
      issue: {
        id: "iss_1",
        agent_id: "ag_1",
        claimed_by_agent_id: "ag_1",
        status: "in_progress",
        title: "Ship notes",
      },
    });

    await run(["claim", "--issue_id", "iss_1", "--agent_id", "ag_1"]);

    expect(postJSONMock).toHaveBeenCalledWith("/api/issues/iss_1/claim", { agent_id: "ag_1" });
    expect(mockedResolve).toHaveBeenCalledWith(expect.anything(), { agentId: "ag_1" });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Claimed iss_1 for ag_1"));
  });

  it("claim requires agent_id flag or env", async () => {
    await expect(run(["claim", "--issue_id", "iss_1"])).rejects.toThrow("process.exit(1)");
    expect(consoleErrSpy).toHaveBeenCalledWith(
      expect.stringContaining("--agent_id is required"),
    );
    expect(postJSONMock).not.toHaveBeenCalled();
  });

  it("handback posts optional agent_id to /api/issues/:id/handback", async () => {
    postJSONMock.mockResolvedValueOnce({
      issue: {
        id: "iss_1",
        agent_id: "ag_1",
        claimed_by_agent_id: null,
        status: "in_progress",
        title: "Ship notes",
      },
    });

    await run(["handback", "--issue_id", "iss_1", "--agent_id", "ag_1"]);

    expect(postJSONMock).toHaveBeenCalledWith("/api/issues/iss_1/handback", {
      agent_id: "ag_1",
    });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Handed back iss_1"));
  });

  it("handback without agent posts empty body", async () => {
    postJSONMock.mockResolvedValueOnce({
      issue: {
        id: "iss_2",
        agent_id: "ag_2",
        claimed_by_agent_id: null,
        status: "blocked",
        title: "Need info",
      },
    });

    await run(["handback", "--issue_id", "iss_2"]);

    expect(postJSONMock).toHaveBeenCalledWith("/api/issues/iss_2/handback", {});
    expect(mockedResolve).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("update accepts blocked status", async () => {
    patchJSONMock.mockResolvedValueOnce({
      id: "iss_3",
      agent_id: "ag_1",
      status: "blocked",
      title: "Waiting on design",
    });

    await run([
      "update",
      "--issue_id",
      "iss_3",
      "--agent_id",
      "ag_1",
      "--status",
      "blocked",
    ]);

    expect(patchJSONMock).toHaveBeenCalledWith(
      "/api/issues/iss_3?agentId=ag_1",
      { status: "blocked" },
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/iss_3\s+blocked\s+Waiting on design/),
    );
  });

  it("update rejects unknown status", async () => {
    await expect(
      run(["update", "--issue_id", "iss_3", "--agent_id", "ag_1", "--status", "stuck"]),
    ).rejects.toThrow("process.exit(1)");
    expect(consoleErrSpy).toHaveBeenCalledWith(expect.stringContaining('invalid status "stuck"'));
    expect(patchJSONMock).not.toHaveBeenCalled();
  });
});
