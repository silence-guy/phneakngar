import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { redactCLIConfig } from "./config.js";
import type { CLIConfig } from "../lib/config.js";

/**
 * `config show` output routinely gets pasted into chat logs, issues, and CI transcripts.
 * session_token and watched_workspaces[].token are live bearer credentials.
 */

const SESSION = "sess_abcdefghijklmnop";
const MACHINE = "al_abcdefghijklmnop";

function cfg(): CLIConfig {
  return {
    server_url: "https://example.com",
    session_token: SESSION,
    watched_workspaces: [
      { id: "w1", name: "Main", token: MACHINE },
      { id: "w2", name: "Other", token: "al_zzzzzzzzzzzzzzzz" },
    ],
    default_profile: "work",
    profiles: {
      work: {
        server_url: "https://example.com",
        session_token: "sess_profilesecret1",
        watched_workspaces: [{ id: "w3", name: "P", token: "al_profiletoken12" }],
      },
    },
  };
}

describe("redactCLIConfig", () => {
  it("masks the top-level session token", () => {
    const out = redactCLIConfig(cfg());
    expect(out.session_token).not.toBe(SESSION);
    expect(out.session_token).not.toContain("abcdefghij");
    expect(JSON.stringify(out)).not.toContain(SESSION);
  });

  it("masks every watched-workspace machine token", () => {
    const out = redactCLIConfig(cfg());
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(MACHINE);
    expect(serialized).not.toContain("al_zzzzzzzzzzzzzzzz");
    expect(out.watched_workspaces![0]!.token).toMatch(/^al_…/);
  });

  it("masks per-profile tokens too, not just the top-level copies", () => {
    const out = redactCLIConfig(cfg());
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("sess_profilesecret1");
    expect(serialized).not.toContain("al_profiletoken12");
  });

  it("keeps non-secret fields intact and readable", () => {
    const out = redactCLIConfig(cfg());
    expect(out.server_url).toBe("https://example.com");
    expect(out.default_profile).toBe("work");
    expect(out.watched_workspaces![0]!.id).toBe("w1");
    expect(out.watched_workspaces![0]!.name).toBe("Main");
  });

  it("leaves a suffix so the operator can still tell tokens apart", () => {
    const out = redactCLIConfig(cfg());
    expect(out.watched_workspaces![0]!.token).toContain("mnop");
    expect(out.watched_workspaces![1]!.token).toContain("zzzz");
    expect(out.watched_workspaces![0]!.token).not.toBe(out.watched_workspaces![1]!.token);
  });

  it("does not mutate the input config", () => {
    const original = cfg();
    redactCLIConfig(original);
    expect(original.session_token).toBe(SESSION);
    expect(original.watched_workspaces![0]!.token).toBe(MACHINE);
  });

  it("handles a config with no tokens or profiles", () => {
    expect(() => redactCLIConfig({ server_url: "https://x.com" })).not.toThrow();
    const out = redactCLIConfig({ server_url: "https://x.com" });
    expect(out.server_url).toBe("https://x.com");
  });
});

describe("config show integration", () => {
  let dir: string;
  const originalRoot = process.env.PHNEAKNGAR_PROJECT_ROOT;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "phn-cfg-"));
    process.env.PHNEAKNGAR_PROJECT_ROOT = dir;
    writeFileSync(join(dir, "config.json"), JSON.stringify(cfg()));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalRoot === undefined) delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    else process.env.PHNEAKNGAR_PROJECT_ROOT = originalRoot;
  });

  it("redacts by default and reveals only with --reveal-secrets", async () => {
    const { configCommand } = await import("./config.js");
    const lines: string[] = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (msg?: unknown) => void lines.push(String(msg));
    console.error = () => {};

    try {
      await configCommand().parseAsync(["show"], { from: "user" });
      const redacted = lines.join("\n");
      expect(redacted).not.toContain(MACHINE);
      expect(redacted).not.toContain(SESSION);

      lines.length = 0;
      await configCommand().parseAsync(["show", "--reveal-secrets"], { from: "user" });
      const revealed = lines.join("\n");
      expect(revealed).toContain(MACHINE);
      expect(revealed).toContain(SESSION);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
  });
});
