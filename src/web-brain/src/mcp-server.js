/**
 * Minimal MCP stdio server (JSON-RPC) — tools for lean web-brain.
 * Implements tools/list + tools/call without the full SDK.
 */
import { writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { webFetch } from "./fetch.js";
import { webSearch, createMockSearchProvider } from "./search.js";
import { WebCache, defaultCacheDir } from "./cache.js";
import { structuredExtract } from "./structured-extract.js";
import { webCrawl } from "./crawl.js";
import { webDiff } from "./diff.js";
import { findSimilar, isIndexingEnabled } from "./embed.js";
function openCache() {
    if (process.env.PHNEAKNGAR_WEB_CACHE_DIR) {
        return new WebCache({ dir: process.env.PHNEAKNGAR_WEB_CACHE_DIR });
    }
    const root = process.env.PHNEAKNGAR_PROJECT_ROOT || join(homedir(), ".phneakngar");
    return new WebCache({ dir: defaultCacheDir(root) });
}
const TOOLS = [
    {
        name: "web_search",
        description: "Search the public web (DDG lite → HTML fallback). Returns title/url/snippet plus provider telemetry. Empty results set degraded=true and error.code=empty_provider_results (not silent success). Prefer over inventing URLs.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                max_results: { type: "number" },
                time_range: {
                    type: "string",
                    enum: ["day", "week", "month", "year"],
                    description: "Recency filter (DDG df=) when supported",
                },
                mock: { type: "boolean", description: "Offline mock results" },
            },
            required: ["query"],
        },
    },
    {
        name: "web_fetch",
        description: "Fetch a public http(s) URL as clean markdown. SSRF-guarded. Uses local cache unless force_refresh.",
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
        description: "Structured extract: metadata, HTML tables, and/or JSON-LD from a URL or raw html.",
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
        description: "Multi-page crawl: strategy bfs|dfs|sitemap|auto|map. Sitemap-first for docs, pattern filters, robots.txt, canonical URL dedup. Caps: depth≤3, pages≤50. Prefer sitemap/auto for doc sites; map for URL discovery only.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string" },
                strategy: {
                    type: "string",
                    enum: ["bfs", "dfs", "sitemap", "auto", "map"],
                    description: "bfs (default) | dfs | sitemap | auto (sitemap if found else bfs) | map (URLs only)",
                },
                max_depth: { type: "number" },
                max_pages: { type: "number" },
                same_host: { type: "boolean" },
                include_patterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Regex whitelist on full URL",
                },
                exclude_patterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Regex blacklist on full URL",
                },
                extract_links: {
                    type: "boolean",
                    description: "Include inter-page link graph",
                },
                use_auth: {
                    type: "boolean",
                    description: "Send cookies from auth state / env",
                },
                max_total_chars: { type: "number" },
                max_tokens_out: { type: "number" },
                include_full_markdown: { type: "boolean" },
                index_pages: {
                    type: "boolean",
                    description: "Embed pages into local vector store (or PHNEAKNGAR_CRAWL_INDEX=1)",
                },
                dedupe_boilerplate: { type: "boolean" },
            },
            required: ["url"],
        },
    },
    {
        name: "web_find_similar",
        description: "Find similar pages from the local crawl vector index (hash embeddings). Prefer after crawl with index_pages / PHNEAKNGAR_CRAWL_INDEX=1.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "URL previously indexed or free-text concept",
                },
                limit: { type: "number" },
            },
            required: ["query"],
        },
    },
    {
        name: "web_diff",
        description: "Diff a URL's cached snapshot against a fresh fetch (or two markdown strings). Reports changed, line counts, unified patch.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string" },
                old_markdown: { type: "string" },
                new_markdown: { type: "string" },
            },
        },
    },
];
let frameMode = "ndjson";
function send(msg) {
    // One writeSync: split stdout.write() can leave body in the pipe buffer.
    const body = JSON.stringify(msg);
    if (frameMode === "ndjson") {
        writeSync(1, `${body}\n`);
        return;
    }
    const frame = `Content-Length: ${Buffer.byteLength(body, "utf-8")}\r\n\r\n${body}`;
    writeSync(1, frame);
}
function ok(id, result) {
    send({ jsonrpc: "2.0", id, result });
}
function err(id, code, message) {
    send({ jsonrpc: "2.0", id, error: { code, message } });
}
const SUPPORTED_PROTOCOL = "2025-06-18";
export async function callTool(name, args) {
    const cache = openCache();
    switch (name) {
        case "web_search": {
            const query = String(args.query ?? "");
            const maxResults = Number(args.max_results) || 5;
            const tr = args.time_range != null ? String(args.time_range) : undefined;
            const timeRange = tr === "day" || tr === "week" || tr === "month" || tr === "year"
                ? tr
                : undefined;
            const provider = args.mock
                ? createMockSearchProvider([
                    {
                        title: `Mock: ${query}`,
                        url: "https://example.com/",
                        snippet: "mock",
                    },
                ])
                : undefined;
            return webSearch(query, { maxResults, provider, timeRange });
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
                mode: args.mode || "all",
                fetchOpts: { cache },
            });
        }
        case "web_crawl": {
            const strat = args.strategy != null ? String(args.strategy) : "bfs";
            const strategy = strat === "dfs" ||
                strat === "sitemap" ||
                strat === "auto" ||
                strat === "map" ||
                strat === "bfs"
                ? strat
                : "bfs";
            const include = Array.isArray(args.include_patterns)
                ? args.include_patterns.map(String)
                : undefined;
            const exclude = Array.isArray(args.exclude_patterns)
                ? args.exclude_patterns.map(String)
                : undefined;
            return webCrawl(String(args.url ?? ""), {
                strategy,
                maxDepth: args.max_depth != null ? Number(args.max_depth) : 2,
                maxPages: args.max_pages != null ? Number(args.max_pages) : 20,
                sameHost: args.same_host !== false,
                includePatterns: include,
                excludePatterns: exclude,
                extractLinksGraph: args.extract_links === true,
                useAuth: args.use_auth === true,
                maxTotalChars: args.max_total_chars != null
                    ? Number(args.max_total_chars)
                    : undefined,
                maxTokensOut: args.max_tokens_out != null ? Number(args.max_tokens_out) : undefined,
                includeFullMarkdown: args.include_full_markdown !== false,
                indexPages: args.index_pages === true || isIndexingEnabled(),
                dedupeBoilerplate: args.dedupe_boilerplate !== false,
                cache,
            });
        }
        case "web_find_similar": {
            return {
                ok: true,
                indexingEnabled: isIndexingEnabled(),
                results: findSimilar(String(args.query ?? ""), {
                    limit: Number(args.limit) || 5,
                }),
            };
        }
        case "web_diff": {
            return webDiff({
                url: args.url != null ? String(args.url) : undefined,
                oldMarkdown: args.old_markdown != null ? String(args.old_markdown) : undefined,
                newMarkdown: args.new_markdown != null ? String(args.new_markdown) : undefined,
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
export async function handleMcpMessage(msg) {
    const id = msg.id ?? null;
    const method = msg.method ?? "";
    if (method === "initialize") {
        const requested = typeof msg.params?.protocolVersion === "string"
            ? msg.params.protocolVersion
            : SUPPORTED_PROTOCOL;
        // Prefer client-requested version when present (Grok sends 2025-06-18).
        const protocolVersion = requested === "2024-11-05" || requested === "2025-03-26" || requested === "2025-06-18"
            ? requested
            : SUPPORTED_PROTOCOL;
        return {
            jsonrpc: "2.0",
            id,
            result: {
                protocolVersion,
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
        const args = params.arguments ?? {};
        try {
            const result = await callTool(name, args);
            const isError = typeof result === "object" &&
                result != null &&
                "ok" in result &&
                result.ok === false;
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    structuredContent: result,
                    isError,
                },
            };
        }
        catch (e) {
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
 * Try to extract one complete top-level JSON object from the start of `text`.
 * Used when clients (Grok) send raw JSON without a trailing newline.
 */
export function takeJsonObject(text) {
    const start = text.search(/\{/);
    if (start < 0)
        return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === "\\") {
                escape = true;
                continue;
            }
            if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === "{")
            depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return {
                    json: text.slice(start, i + 1),
                    rest: text.slice(i + 1),
                };
            }
        }
    }
    return null;
}
/**
 * Run MCP server on stdio (Content-Length framing + NDJSON / bare JSON).
 */
export async function runMcpStdio() {
    let buffer = Buffer.alloc(0);
    let draining = false;
    const onData = (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        void drain();
    };
    async function drain() {
        if (draining)
            return;
        draining = true;
        try {
            while (true) {
                // Content-Length only when the buffer *starts* with that header.
                // Do not treat bare `\r\n\r\n` elsewhere as CL — Grok is NDJSON-only.
                const asText = buffer.toString("utf-8");
                const trimmedStart = asText.replace(/^\s+/, "");
                if (/^Content-Length\s*:/i.test(trimmedStart)) {
                    const headerEnd = buffer.indexOf("\r\n\r\n");
                    if (headerEnd < 0)
                        return;
                    const header = buffer.slice(0, headerEnd).toString("utf-8");
                    const match = header.match(/Content-Length:\s*(\d+)/i);
                    if (!match) {
                        buffer = buffer.slice(headerEnd + 4);
                        continue;
                    }
                    frameMode = "content-length";
                    const len = Number(match[1]);
                    const bodyStart = headerEnd + 4;
                    if (buffer.length < bodyStart + len)
                        return;
                    const body = buffer.slice(bodyStart, bodyStart + len).toString("utf-8");
                    buffer = buffer.slice(bodyStart + len);
                    try {
                        const msg = JSON.parse(body);
                        const resp = await handleMcpMessage(msg);
                        if (resp !== undefined)
                            send(resp);
                    }
                    catch {
                        // ignore bad frame
                    }
                    continue;
                }
                // NDJSON line
                const nl = buffer.indexOf("\n");
                if (nl >= 0) {
                    const line = buffer.slice(0, nl).toString("utf-8").trim();
                    buffer = buffer.slice(nl + 1);
                    if (line.startsWith("{")) {
                        frameMode = "ndjson";
                        try {
                            const msg = JSON.parse(line);
                            const resp = await handleMcpMessage(msg);
                            if (resp !== undefined)
                                send(resp);
                        }
                        catch {
                            // ignore
                        }
                    }
                    continue;
                }
                // Bare JSON object without trailing newline.
                const text = buffer.toString("utf-8");
                const taken = takeJsonObject(text.trimStart());
                if (!taken)
                    return;
                frameMode = "ndjson";
                buffer = Buffer.from(taken.rest, "utf-8");
                try {
                    const msg = JSON.parse(taken.json);
                    const resp = await handleMcpMessage(msg);
                    if (resp !== undefined)
                        send(resp);
                }
                catch {
                    // ignore
                }
            }
        }
        finally {
            draining = false;
            // If data arrived while we were awaiting, process it (avoid stall).
            if (buffer.length > 0)
                void drain();
        }
    }
    if (typeof process.stdin.resume === "function")
        process.stdin.resume();
    process.stdin.on("data", onData);
    await new Promise((resolve) => {
        process.stdin.on("end", () => resolve());
        process.stdin.on("close", () => resolve());
    });
}
