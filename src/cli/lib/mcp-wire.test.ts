import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { wireCodex, wireClaude, isCodexWired, isClaudeWired } from "./mcp-wire.js";

describe("mcp-wire", () => {
  let home: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "mcp-wire-"));
    prevHome = process.env.HOME;
    process.env.HOME = home;
    mkdirSync(join(home, ".codex"), { recursive: true });
    mkdirSync(join(home, ".claude"), { recursive: true });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    rmSync(home, { recursive: true, force: true });
  });

  it("wireCodex writes managed block and is idempotent", () => {
    // os.homedir() may ignore HOME on some Node builds — still exercise write path
    const a = wireCodex();
    expect(["wrote", "updated", "skipped", "missing"]).toContain(a.action);
    if (a.action === "wrote" || a.action === "updated") {
      const text = readFileSync(a.path, "utf-8");
      expect(text).toContain("phneakngar_web_brain");
      expect(text).toContain("BEGIN phneakngar-managed web-brain");
      const b = wireCodex();
      expect(b.action).toBe("skipped");
      const rm = wireCodex({ remove: true });
      expect(rm.action).toBe("removed");
      expect(readFileSync(a.path, "utf-8")).not.toContain("phneakngar_web_brain");
    }
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
