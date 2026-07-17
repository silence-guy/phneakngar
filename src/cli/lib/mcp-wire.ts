/**
 * Idempotent MCP config wiring for Codex, Claude Code, and Grok CLI.
 * Writes only managed marker blocks so user MCP servers are preserved.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const BEGIN = "# BEGIN phneakngar-managed web-brain";
const END = "# END phneakngar-managed web-brain";

export type WireResult = {
  runtime: string;
  path: string;
  action: "wrote" | "updated" | "skipped" | "removed" | "missing";
  detail: string;
};

/**
 * Resolve how to launch the web-brain MCP stdio server.
 * Prefer bundled dist next to the CLI, then monorepo source, then package resolve.
 */
export function resolveWebBrainMcpCommand(): { command: string; args: string[] } {
  // 1) Bundled CLI sibling (global npm install of @phneakngar/cli)
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/index.js → dist/web-brain-mcp.js  OR  lib/mcp-wire.ts → ../web-brain/...
    const candidates = [
      join(here, "web-brain-mcp.js"),
      join(here, "dist", "web-brain-mcp.js"),
      join(here, "..", "dist", "web-brain-mcp.js"),
      join(here, "..", "web-brain-mcp.js"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        return { command: process.execPath, args: [p] };
      }
    }
  } catch {
    // ignore
  }

  // 2) Monorepo absolute path (dev machine)
  const mono = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "web-brain",
    "src",
    "bin-mcp.ts",
  );
  if (existsSync(mono)) {
    return {
      command: process.execPath,
      args: ["--experimental-strip-types", mono],
    };
  }

  // 3) Workspace package resolve
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("@phneakngar/web-brain/package.json");
    const mcpTs = join(dirname(pkgJson), "src", "bin-mcp.ts");
    if (existsSync(mcpTs)) {
      return {
        command: process.execPath,
        args: ["--experimental-strip-types", mcpTs],
      };
    }
  } catch {
    // fall through
  }

  return {
    command: process.execPath,
    args: [
      "--experimental-strip-types",
      "-e",
      "import('@phneakngar/web-brain').then((m)=>m.runMcpStdio())",
    ],
  };
}

function tomlServerBlock(): string {
  const { command, args } = resolveWebBrainMcpCommand();
  const argsToml = args.map((a) => JSON.stringify(a)).join(", ");
  return [
    BEGIN,
    "[mcp_servers.phneakngar_web_brain]",
    `command = ${JSON.stringify(command)}`,
    `args = [${argsToml}]`,
    "enabled = true",
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

function wireTomlFile(
  runtime: string,
  path: string,
  opts: { remove?: boolean } = {},
): WireResult {
  const block = tomlServerBlock();
  if (opts.remove) {
    if (!existsSync(path)) {
      return { runtime, path, action: "missing", detail: "no config file" };
    }
    const prev = readFileSync(path, "utf-8");
    const next = stripManagedToml(prev);
    if (next === prev) {
      return { runtime, path, action: "skipped", detail: "no managed block" };
    }
    writeFileSync(path, next, { mode: 0o600 });
    return { runtime, path, action: "removed", detail: "managed block removed" };
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const prev = existsSync(path) ? readFileSync(path, "utf-8") : "";
  // Consider current if same server key present with same command path roughly
  if (prev.includes(BEGIN) && prev.includes("phneakngar_web_brain")) {
    const stripped = stripManagedToml(prev);
    const next = (stripped.replace(/\s+$/, "") ? stripped.replace(/\s+$/, "") + "\n\n" : "") + block;
    if (next === prev || prev.includes(block.trim())) {
      // refresh block in case command path changed
      if (prev.includes(block.trim())) {
        return { runtime, path, action: "skipped", detail: "already current" };
      }
      writeFileSync(path, next, { mode: 0o600 });
      return { runtime, path, action: "updated", detail: "mcp_servers.phneakngar_web_brain" };
    }
  }
  const base = stripManagedToml(prev).replace(/\s+$/, "");
  const next = (base ? base + "\n\n" : "") + block;
  writeFileSync(path, next, { mode: 0o600 });
  return {
    runtime,
    path,
    action: prev.includes(BEGIN) ? "updated" : "wrote",
    detail: "mcp_servers.phneakngar_web_brain",
  };
}

export function wireCodex(opts: { remove?: boolean } = {}): WireResult {
  return wireTomlFile("codex", join(homedir(), ".codex", "config.toml"), opts);
}

/** Grok CLI uses the same TOML mcp_servers shape as Codex under ~/.grok/config.toml */
export function wireGrok(opts: { remove?: boolean } = {}): WireResult {
  return wireTomlFile("grok", join(homedir(), ".grok", "config.toml"), opts);
}

function claudeMcpJsonPath(): string {
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
  const server = { command, args };

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
  return [wireCodex(opts), wireClaude(opts), wireGrok(opts)];
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

export function isGrokWired(): boolean {
  const path = join(homedir(), ".grok", "config.toml");
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf-8").includes("phneakngar_web_brain");
}
