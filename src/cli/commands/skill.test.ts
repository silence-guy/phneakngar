import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const getJSONMock = vi.fn();
const postJSONMock = vi.fn();

vi.mock("../lib/client.js", () => ({
  APIClient: class {
    getJSON(...a: unknown[]) {
      return getJSONMock(...a);
    }
    postJSON(...a: unknown[]) {
      return postJSONMock(...a);
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

import { skillCommand } from "./skill";

describe("skillCommand", () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), "skill-cmd-"));
    delete process.env.PHNEAKNGAR_AGENT_ID;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("registers export and import subcommands", () => {
    const names = skillCommand().commands.map((c) => c.name());
    expect(names).toContain("export");
    expect(names).toContain("import");
  });

  it("export writes API skills pack when agent resolves", async () => {
    process.env.PHNEAKNGAR_AGENT_ID = "ag1";
    getJSONMock.mockResolvedValue({
      skills: [
        { name: "s1", description: "one", isGlobal: false },
        { name: "s2", description: "two", isGlobal: true },
      ],
    });
    const out = join(dir, "pack.json");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await skillCommand().parseAsync([
      "node",
      "phneakngar",
      "export",
      "--agent_id",
      "ag1",
      "--out",
      out,
    ]);
    const pack = JSON.parse(readFileSync(out, "utf-8"));
    expect(pack.version).toBe(1);
    expect(pack.skills).toEqual([
      { name: "s1", description: "one", isGlobal: false },
      { name: "s2", description: "two", isGlobal: true },
    ]);
    expect(getJSONMock).toHaveBeenCalledWith("/api/agents/ag1/skills");
    log.mockRestore();
  });

  it("import merges by name idempotently (local)", async () => {
    const file = join(dir, "incoming.json");
    const out = join(dir, "skill-pack.json");
    writeFileSync(
      file,
      JSON.stringify({ version: 1, skills: [{ name: "a", description: "A" }] }),
    );
    writeFileSync(
      out,
      JSON.stringify({ version: 1, skills: [{ name: "a", description: "old" }, { name: "b", description: "B" }] }),
    );

    // No agent_id → local pack merge only
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await skillCommand().parseAsync([
      "node",
      "phneakngar",
      "import",
      "--file",
      file,
      "--out",
      out,
    ]);

    const pack = JSON.parse(readFileSync(out, "utf-8"));
    expect(pack.skills).toEqual([
      { name: "a", description: "A" },
      { name: "b", description: "B" },
    ]);
    expect(postJSONMock).not.toHaveBeenCalled();

    // Second import stays idempotent
    await skillCommand().parseAsync([
      "node",
      "phneakngar",
      "import",
      "--file",
      file,
      "--out",
      out,
    ]);
    const again = JSON.parse(readFileSync(out, "utf-8"));
    expect(again.skills).toEqual(pack.skills);

    log.mockRestore();
  });

  it("import --dry-run does not write", async () => {
    const file = join(dir, "incoming.json");
    const out = join(dir, "skill-pack.json");
    writeFileSync(
      file,
      JSON.stringify({ version: 1, skills: [{ name: "z", description: "Z" }] }),
    );
    writeFileSync(out, JSON.stringify({ version: 1, skills: [] }));
    const before = readFileSync(out, "utf-8");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await skillCommand().parseAsync([
      "node",
      "phneakngar",
      "import",
      "--file",
      file,
      "--out",
      out,
      "--dry-run",
    ]);

    expect(readFileSync(out, "utf-8")).toBe(before);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Dry-run"));
    log.mockRestore();
  });
});
