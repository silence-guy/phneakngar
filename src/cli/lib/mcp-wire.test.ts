import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  wireCodex,
  wireClaude,
  wireGrok,
  isCodexWired,
  isClaudeWired,
} from "./mcp-wire.js";

function countTables(text: string): number {
  return (text.match(/^\[mcp_servers\.phneakngar_web_brain\]/gm) ?? []).length;
}

describe("mcp-wire", () => {
  let home: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "mcp-wire-"));
    prevHome = process.env.HOME;
    process.env.HOME = home;
    mkdirSync(join(home, ".codex"), { recursive: true });
    mkdirSync(join(home, ".claude"), { recursive: true });
    mkdirSync(join(home, ".grok"), { recursive: true });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    rmSync(home, { recursive: true, force: true });
  });

  it("wireCodex writes managed block and is idempotent", () => {
    const a = wireCodex();
    expect(["wrote", "updated", "skipped", "missing"]).toContain(a.action);
    if (a.action === "wrote" || a.action === "updated") {
      const text = readFileSync(a.path, "utf-8");
      expect(text).toContain("phneakngar_web_brain");
      expect(text).toContain("BEGIN phneakngar-managed web-brain");
      expect(countTables(text)).toBe(1);
      const b = wireCodex();
      expect(b.action).toBe("skipped");
      expect(countTables(readFileSync(a.path, "utf-8"))).toBe(1);
      const rm = wireCodex({ remove: true });
      expect(rm.action).toBe("removed");
      expect(readFileSync(a.path, "utf-8")).not.toContain("phneakngar_web_brain");
    }
  });

  it("wireCodex collapses orphan phneakngar_web_brain table into one managed block", () => {
    const path = join(home, ".codex", "config.toml");
    writeFileSync(
      path,
      [
        "[mcp_servers.other]",
        'command = "echo"',
        "args = []",
        "",
        "[mcp_servers.phneakngar_web_brain]",
        'command = "/usr/bin/node"',
        'args = ["/old/orphan/web-brain-mcp.js"]',
        "enabled = true",
        "",
      ].join("\n"),
      "utf-8",
    );

    const a = wireCodex();
    expect(["wrote", "updated"]).toContain(a.action);
    const text = readFileSync(path, "utf-8");
    expect(countTables(text)).toBe(1);
    expect(text).toContain("BEGIN phneakngar-managed web-brain");
    expect(text).toContain("END phneakngar-managed web-brain");
    expect(text).toContain("[mcp_servers.other]");
    expect(text).not.toContain("/old/orphan/web-brain-mcp.js");

    const b = wireCodex();
    expect(b.action).toBe("skipped");
    expect(countTables(readFileSync(path, "utf-8"))).toBe(1);
  });

  it("wireCodex collapses orphan + managed duplicate into one table", () => {
    const path = join(home, ".codex", "config.toml");
    writeFileSync(
      path,
      [
        "[mcp_servers.phneakngar_web_brain]",
        'command = "/usr/bin/node"',
        'args = ["/old/orphan.js"]',
        "enabled = true",
        "",
        "# BEGIN phneakngar-managed web-brain",
        "[mcp_servers.phneakngar_web_brain]",
        'command = "/usr/bin/node"',
        'args = ["/managed/old.js"]',
        "enabled = true",
        "startup_timeout_sec = 60",
        "# END phneakngar-managed web-brain",
        "",
      ].join("\n"),
      "utf-8",
    );

    expect(countTables(readFileSync(path, "utf-8"))).toBe(2);
    const a = wireCodex();
    expect(a.action).toBe("updated");
    const text = readFileSync(path, "utf-8");
    expect(countTables(text)).toBe(1);
    expect(text).not.toContain("/old/orphan.js");
  });

  it("wireCodex remove strips orphan tables without managed markers", () => {
    const path = join(home, ".codex", "config.toml");
    writeFileSync(
      path,
      [
        "[mcp_servers.keep_me]",
        'command = "true"',
        "",
        "[mcp_servers.phneakngar_web_brain]",
        'command = "node"',
        'args = ["x.js"]',
        "",
      ].join("\n"),
      "utf-8",
    );
    const rm = wireCodex({ remove: true });
    expect(rm.action).toBe("removed");
    const text = readFileSync(path, "utf-8");
    expect(text).not.toContain("phneakngar_web_brain");
    expect(text).toContain("[mcp_servers.keep_me]");
  });

  it("wireGrok uses ~/.grok/config.toml and dedupes", () => {
    const path = join(home, ".grok", "config.toml");
    writeFileSync(
      path,
      [
        "[mcp_servers.wigolo]",
        'url = "https://example.invalid/mcp"',
        "enabled = true",
        "",
        "[mcp_servers.phneakngar_web_brain]",
        'command = "node"',
        'args = ["/orphan.js"]',
        "",
      ].join("\n"),
      "utf-8",
    );
    const a = wireGrok();
    expect(["wrote", "updated"]).toContain(a.action);
    const text = readFileSync(path, "utf-8");
    expect(countTables(text)).toBe(1);
    expect(text).toContain("[mcp_servers.wigolo]");
    expect(text).toContain("example.invalid");
    expect(wireGrok().action).toBe("skipped");
  });

  it("wireClaude writes mcpServers entry", () => {
    const a = wireClaude();
    expect(["wrote", "updated", "skipped", "missing"]).toContain(a.action);
    if (existsSync(a.path) && (a.action === "wrote" || a.action === "updated")) {
      const json = JSON.parse(readFileSync(a.path, "utf-8")) as {
        mcpServers?: Record<string, unknown>;
      };
      expect(json.mcpServers?.phneakngar_web_brain).toBeTruthy();
      wireClaude({ remove: true });
    }
  });

  it("isCodexWired / isClaudeWired are boolean", () => {
    expect(typeof isCodexWired()).toBe("boolean");
    expect(typeof isClaudeWired()).toBe("boolean");
  });
});
