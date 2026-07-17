/**
 * Minimal MCP stdio server (JSON-RPC) — tools for lean web-brain.
 * Implements tools/list + tools/call without the full SDK.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { webFetch } from "./fetch.js";
import { webSearch, createMockSearchProvider } from "./search.js";
import { WebCache, defaultCacheDir } from "./cache.js";
import { structuredExtract } from "./structured-extract.js";
import { webCrawl } from "./crawl.js";
import { webDiff } from "./diff.js";

type JsonRpcId = string | number | null;

type JsonRpcReq = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function openCache(): WebCache {
  if (process.env.PHNEAKNGAR_WEB_CACHE_DIR) {
    return new WebCache({ dir: process.env.PHNEAKNGAR_WEB_CACHE_DIR });
  }
  const root = process.env.PHNEAKNGAR_PROJECT_ROOT || join(homedir(), ".phneakngar");
  return new WebCache({ dir: defaultCacheDir(root) });
}

const TOOLS = [
  {
    name: "web_search",
    description:
      "Search the public web. Returns title/url/snippet list. Prefer over inventing URLs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max_results: { type: "number" },
        mock: { type: "boolean", description: "Offline mock results" },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch a public http(s) URL as clean markdown. SSRF-guarded. Uses local cache unless force_refresh.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        force_refresh: { type: "boolean" },
        max_chars: { type: "number" },
      },
      required: ["url"],
    },
  },
  {
    name: "web_cache",
    description: "Search or stats on the local web-brain cache (no network).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["search", "stats", "clear"] },
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["action"],
    },
  },
  {
    name: "web_extract",
    description:
      "Structured extract: metadata, HTML tables, and/or JSON-LD from a URL or raw html.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        html: { type: "string" },
        mode: {
          type: "string",
          enum: ["metadata", "tables", "jsonld", "all"],
        },
      },
    },
  },
  {
    name: "web_crawl",
    description:
      "Capped BFS crawl (max_depth≤2, max_pages≤20). Respects robots.txt. Same host by default.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        max_depth: { type: "number" },
        max_pages: { type: "number" },
        same_host: { type: "boolean" },
      },
      required: ["url"],
    },
  },
  {
    name: "web_diff",
    description:
      "Diff a URL's cached snapshot against a fresh fetch (or two markdown strings). Reports changed, line counts, unified patch.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        old_markdown: { type: "string" },
        new_markdown: { type: "string" },
      },
    },
  },
] as const;

function send(msg: unknown): void {
  const body = JSON.stringify(msg);
  const buf = Buffer.from(body, "utf-8");
  process.stdout.write(`Content-Length: ${buf.length}\r\n\r\n`);
  process.stdout.write(buf);
}

function ok(id: JsonRpcId, result: unknown): void {
  send({ jsonrpc: "2.0", id, result });
}

function err(id: JsonRpcId, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const cache = openCache();
  switch (name) {
    case "web_search": {
      const query = String(args.query ?? "");
      const maxResults = Number(args.max_results) || 5;
      const provider = args.mock
        ? createMockSearchProvider([
            {
              title: `Mock: ${query}`,
              url: "https://example.com/",
              snippet: "mock",
            },
          ])
        : undefined;
      return webSearch(query, { maxResults, provider });
    }
    case "web_fetch": {
      return webFetch(String(args.url ?? ""), {
        forceRefresh: !!args.force_refresh,
        maxChars: Number(args.max_chars) || 30_000,
        cache,
      });
    }
    case "web_cache": {
      const action = String(args.action ?? "stats");
      if (action === "clear") {
        cache.clear();
        return { ok: true, cleared: true, path: cache.dir };
      }
      if (action === "search") {
        return {
          ok: true,
          hits: cache.search(String(args.query ?? ""), Number(args.limit) || 20),
        };
      }
      return { ok: true, ...cache.stats() };
    }
    case "web_extract": {
      return structuredExtract({
        url: args.url != null ? String(args.url) : undefined,
        html: args.html != null ? String(args.html) : undefined,
        mode: (args.mode as "metadata" | "tables" | "jsonld" | "all") || "all",
        fetchOpts: { cache },
      });
    }
    case "web_crawl": {
      return webCrawl(String(args.url ?? ""), {
        maxDepth: args.max_depth != null ? Number(args.max_depth) : 1,
        maxPages: args.max_pages != null ? Number(args.max_pages) : 10,
        sameHost: args.same_host !== false,
        cache,
      });
    }
    case "web_diff": {
      return webDiff({
        url: args.url != null ? String(args.url) : undefined,
        oldMarkdown:
          args.old_markdown != null ? String(args.old_markdown) : undefined,
        newMarkdown:
          args.new_markdown != null ? String(args.new_markdown) : undefined,
        cache,
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function listTools() {
  return TOOLS;
}

export async function handleMcpMessage(msg: JsonRpcReq): Promise<unknown | void> {
  const id = msg.id ?? null;
  const method = msg.method ?? "";

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "phneakngar-web-brain", version: "0.0.2" },
      },
    };
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return undefined;
  }
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (method === "tools/call") {
    const params = msg.params ?? {};
    const name = String(params.name ?? "");
    const args = (params.arguments as Record<string, unknown>) ?? {};
    try {
      const result = await callTool(name, args);
      const isError =
        typeof result === "object" &&
        result != null &&
        "ok" in result &&
        (result as { ok: boolean }).ok === false;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError,
        },
      };
    } catch (e) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  if (id !== null && id !== undefined) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  }
  return undefined;
}

/**
 * Run MCP server on stdio (Content-Length framing + optional NDJSON lines).
 */
export async function runMcpStdio(): Promise<void> {
  let buffer = Buffer.alloc(0);

  const onData = (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    void drain();
  };

  async function drain(): Promise<void> {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        // Try NDJSON single line
        const nl = buffer.indexOf("\n");
        if (nl < 0) return;
        const line = buffer.slice(0, nl).toString("utf-8").trim();
        buffer = buffer.slice(nl + 1);
        if (line.startsWith("{")) {
          try {
            const msg = JSON.parse(line) as JsonRpcReq;
            const resp = await handleMcpMessage(msg);
            if (resp !== undefined) send(resp);
          } catch {
            // ignore
          }
        }
        continue;
      }
      const header = buffer.slice(0, headerEnd).toString("utf-8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + len) return;
      const body = buffer.slice(bodyStart, bodyStart + len).toString("utf-8");
      buffer = buffer.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body) as JsonRpcReq;
        const resp = await handleMcpMessage(msg);
        if (resp !== undefined) send(resp);
      } catch {
        // ignore bad frame
      }
    }
  }

  process.stdin.on("data", onData);
  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
    process.stdin.on("close", () => resolve());
  });
}
