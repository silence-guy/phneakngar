/**
 * Idempotent MCP config wiring for Codex + Claude Code.
 * Writes only managed marker blocks so user MCP servers are preserved.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const BEGIN = "# BEGIN phneakngar-managed web-brain";
const END = "# END phneakngar-managed web-brain";
const BEGIN_JSON = "/* BEGIN phneakngar-managed web-brain */";
const END_JSON = "/* END phneakngar-managed web-brain */";

export type WireResult = {
  runtime: string;
  path: string;
  action: "wrote" | "updated" | "skipped" | "removed" | "missing";
  detail: string;
};

function resolveWebBrainMcpCommand(): { command: string; args: string[] } {
  // Prefer bun/tsx-friendly path to package mcp entry via node + experimental strip types,
  // or absolute path to mcp-server source when workspace is present.
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("@phneakngar/web-brain/package.json");
    const mcpTs = join(dirname(pkgJson), "src", "mcp-server.ts");
    if (existsSync(mcpTs)) {
      return {
        command: process.execPath,
        args: ["--experimental-strip-types", mcpTs, "--mcp"],
      };
    }
  } catch {
    // fall through
  }
  // npx-style fallback for published layouts (future)
  return {
    command: process.execPath,
    args: ["--experimental-strip-types", "-e", "import('@phneakngar/web-brain').then(m=>m.runMcpStdio())"],
  };
}

function codexBlock(): string {
  const { command, args } = resolveWebBrainMcpCommand();
  const argsToml = args.map((a) => JSON.stringify(a)).join(", ");
  return [
    BEGIN,
    "[mcp_servers.phneakngar_web_brain]",
    `command = ${JSON.stringify(command)}`,
    `args = [${argsToml}]`,
    END,
    "",
  ].join("\n");
}

function stripManagedToml(content: string): string {
  const re = new RegExp(
    `${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
    "g",
  );
  return content.replace(re, "");
}

export function wireCodex(opts: { remove?: boolean } = {}): WireResult {
  const path = join(homedir(), ".codex", "config.toml");
  const block = codexBlock();
  if (opts.remove) {
    if (!existsSync(path)) {
      return { runtime: "codex", path, action: "missing", detail: "no config.toml" };
    }
    const prev = readFileSync(path, "utf-8");
    const next = stripManagedToml(prev);
    if (next === prev) {
      return { runtime: "codex", path, action: "skipped", detail: "no managed block" };
    }
    writeFileSync(path, next, { mode: 0o600 });
    return { runtime: "codex", path, action: "removed", detail: "managed block removed" };
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const prev = existsSync(path) ? readFileSync(path, "utf-8") : "";
  if (prev.includes(BEGIN) && prev.includes(block.trim())) {
    return { runtime: "codex", path, action: "skipped", detail: "already current" };
  }
  const base = stripManagedToml(prev).replace(/\s+$/, "");
  const next = (base ? base + "\n\n" : "") + block;
  writeFileSync(path, next, { mode: 0o600 });
  return {
    runtime: "codex",
    path,
    action: prev.includes(BEGIN) ? "updated" : "wrote",
    detail: "mcp_servers.phneakngar_web_brain",
  };
}

function claudeMcpJsonPath(): string {
  // Claude Code user MCP: ~/.claude.json has mcpServers in some versions;
  // also support ~/.claude/mcp.json
  const candidates = [
    join(homedir(), ".claude", "mcp.json"),
    join(homedir(), ".claude.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]!;
}

export function wireClaude(opts: { remove?: boolean } = {}): WireResult {
  const path = claudeMcpJsonPath();
  const { command, args } = resolveWebBrainMcpCommand();
  const server = {
    command,
    args,
  };

  if (opts.remove) {
    if (!existsSync(path)) {
      return { runtime: "claude", path, action: "missing", detail: "no mcp config" };
    }
    try {
      const raw = readFileSync(path, "utf-8");
      const json = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
      if (!json.mcpServers?.phneakngar_web_brain) {
        return { runtime: "claude", path, action: "skipped", detail: "not present" };
      }
      delete json.mcpServers.phneakngar_web_brain;
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n", { mode: 0o600 });
      return { runtime: "claude", path, action: "removed", detail: "entry removed" };
    } catch (e) {
      return {
        runtime: "claude",
        path,
        action: "skipped",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let json: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(path)) {
    try {
      json = JSON.parse(readFileSync(path, "utf-8")) as typeof json;
    } catch {
      // start fresh servers map if corrupt partial
      json = {};
    }
  }
  if (!json.mcpServers) json.mcpServers = {};
  const prev = JSON.stringify(json.mcpServers.phneakngar_web_brain ?? null);
  json.mcpServers.phneakngar_web_brain = server;
  const next = JSON.stringify(json.mcpServers.phneakngar_web_brain);
  if (prev === next && existsSync(path)) {
    return { runtime: "claude", path, action: "skipped", detail: "already current" };
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", { mode: 0o600 });
  return {
    runtime: "claude",
    path,
    action: prev === "null" ? "wrote" : "updated",
    detail: "mcpServers.phneakngar_web_brain",
  };
}

export function wireAll(opts: { remove?: boolean } = {}): WireResult[] {
  return [wireCodex(opts), wireClaude(opts)];
}

export function isCodexWired(): boolean {
  const path = join(homedir(), ".codex", "config.toml");
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf-8").includes("phneakngar_web_brain");
}

export function isClaudeWired(): boolean {
  const path = claudeMcpJsonPath();
  if (!existsSync(path)) return false;
  try {
    const json = JSON.parse(readFileSync(path, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };
    return Boolean(json.mcpServers?.phneakngar_web_brain);
  } catch {
    return false;
  }
}

// silence unused imports in some trees
void renameSync;
void BEGIN_JSON;
void END_JSON;
