/**
 * Readiness snapshot for doctor / `phneakngar web status`.
 */

import { existsSync } from "node:fs";
import type { WebCacheLike } from "./types.js";

export type WebBrainStatus = {
  name: string;
  status: "pass" | "warn" | "info" | "fail";
  detail: string;
  hint?: string;
};

export function checkWebBrainReady(opts: {
  cache?: WebCacheLike | null;
  enabled?: boolean;
  /** Optional MCP wire status from CLI. */
  mcpWired?: { codex?: boolean; claude?: boolean; grok?: boolean };
}): WebBrainStatus {
  if (opts.enabled === false) {
    return {
      name: "Web brain",
      status: "info",
      detail: "disabled",
      hint: "Enable with config web.enabled=true or use phneakngar web fetch/search",
    };
  }

  // Core library is always present when this module loads
  let cacheDetail = "cache not configured";
  if (opts.cache) {
    const stats = opts.cache.stats();
    cacheDetail = `cache ${stats.entries} entries at ${stats.path}`;
    if (!existsSync(stats.path)) {
      return {
        name: "Web brain",
        status: "warn",
        detail: `ready; cache path missing (${stats.path})`,
      };
    }
  }

  const mcp = opts.mcpWired;
  let mcpDetail = "MCP: run `phneakngar web wire-mcp` for Codex/Claude";
  if (mcp) {
    const parts = [
      mcp.codex ? "codex" : null,
      mcp.claude ? "claude" : null,
      mcp.grok ? "grok" : null,
    ].filter(Boolean);
    mcpDetail = parts.length
      ? `MCP wired: ${parts.join("+")}`
      : "MCP not wired (CLI tools still work)";
  }

  return {
    name: "Web brain",
    status: "pass",
    detail: `lean toolkit ready (${cacheDetail}); ${mcpDetail}; tools: search/fetch/cache/extract/crawl/diff; no wigolo/onnx`,
  };
}
