import { Command } from "commander";
import { webFetch, webSearch, WebCache, defaultCacheDir, checkWebBrainReady, createMockSearchProvider, structuredExtract, webCrawl, webDiff, findSimilar, startFirecrawlCompatServer, } from "@phneakngar/web-brain";
import { configDir } from "../lib/config.js";
import { printJSON } from "../lib/output.js";
import { wireAll, isCodexWired, isClaudeWired, isGrokWired, } from "../lib/mcp-wire.js";
function openCache() {
    const dir = process.env.PHNEAKNGAR_WEB_CACHE_DIR || defaultCacheDir(configDir());
    return new WebCache({ dir });
}
function printFetch(res, json) {
    if (json) {
        printJSON(res);
        return;
    }
    if (!res.ok) {
        console.error(`Error [${res.error.code}]: ${res.error.message}`);
        process.exitCode = 1;
        return;
    }
    console.log(`url: ${res.url}`);
    console.log(`finalUrl: ${res.finalUrl}`);
    console.log(`title: ${res.title}`);
    console.log(`fromCache: ${res.fromCache}`);
    console.log(`httpStatus: ${res.httpStatus}`);
    console.log(`contentHash: ${res.contentHash.slice(0, 12)}…`);
    console.log("");
    console.log(res.markdown);
}
function printSearch(res, json) {
    if (json) {
        printJSON(res);
        return;
    }
    if (!res.ok) {
        console.error(`Error [${res.error.code}]: ${res.error.message}`);
        process.exitCode = 1;
        return;
    }
    console.log(`query: ${res.query}`);
    console.log(`provider: ${res.provider}`);
    console.log(`results: ${res.results.length}`);
    if (res.degraded)
        console.log(`degraded: true`);
    if (res.error)
        console.log(`error: [${res.error.code}] ${res.error.message}`);
    if (res.providersTried?.length) {
        console.log(`providersTried: ${res.providersTried.join(" → ")}`);
    }
    if (res.timeRange)
        console.log(`timeRange: ${res.timeRange}`);
    if (res.telemetry?.length) {
        for (const t of res.telemetry) {
            console.log(`  telemetry[${t.provider}]: http=${t.httpStatus ?? "?"} parse=${t.parseCount} ${t.latencyMs}ms${t.blockedHint ? ` blocked=${t.blockedHint}` : ""}${t.error ? ` err=${t.error}` : ""}`);
        }
    }
    console.log("");
    for (const [i, r] of res.results.entries()) {
        console.log(`${i + 1}. ${r.title}`);
        console.log(`   ${r.url}`);
        if (r.snippet)
            console.log(`   ${r.snippet}`);
    }
}
export function webCommand() {
    const cmd = new Command("web").description("Lean local web brain (search / fetch / extract / crawl / MCP) — no wigolo");
    cmd
        .command("status")
        .description("Show web brain readiness, cache stats, MCP wire state")
        .option("--json", "JSON output")
        .action((opts) => {
        const cache = openCache();
        const mcp = {
            codex: isCodexWired(),
            claude: isClaudeWired(),
            grok: isGrokWired(),
        };
        const status = checkWebBrainReady({
            cache,
            enabled: true,
            mcpWired: mcp,
        });
        const stats = cache.stats();
        const payload = { ...status, cache: stats, mcp };
        if (opts.json) {
            printJSON(payload);
            return;
        }
        console.log(`Web brain: [${status.status.toUpperCase()}] ${status.detail}`);
        console.log(`Cache: ${stats.entries} entries @ ${stats.path}`);
        console.log(`MCP: codex=${mcp.codex} claude=${mcp.claude} grok=${mcp.grok}`);
    });
    cmd
        .command("fetch")
        .description("Fetch a public http(s) URL as clean markdown")
        .argument("<url>", "http(s) URL")
        .option("--force-refresh", "Bypass cache")
        .option("--max-chars <n>", "Max markdown chars", "30000")
        .option("--json", "JSON output")
        .option("--skip-cache", "Do not read/write disk cache")
        .action(async (url, opts) => {
        const cache = opts.skipCache ? null : openCache();
        const res = await webFetch(url, {
            forceRefresh: !!opts.forceRefresh,
            maxChars: Number(opts.maxChars) || 30_000,
            cache,
        });
        printFetch(res, !!opts.json);
    });
    cmd
        .command("search")
        .description("Search the web (ddg-lite → ddg-html fallback; use --mock for offline demo)")
        .argument("<query>", "Search query")
        .option("--max <n>", "Max results", "5")
        .option("--time-range <range>", "Recency: day | week | month | year (DDG df=)")
        .option("--json", "JSON output")
        .option("--mock", "Use built-in mock results (no network) — for demos and CI")
        .action(async (query, opts) => {
        const maxResults = Number(opts.max) || 5;
        const timeRange = opts.timeRange
            ? String(opts.timeRange)
            : undefined;
        const provider = opts.mock
            ? createMockSearchProvider([
                {
                    title: `Mock result for: ${query}`,
                    url: "https://example.com/",
                    snippet: "Offline mock provider — pass without --mock for live search",
                },
            ])
            : undefined;
        const res = await webSearch(query, { maxResults, provider, timeRange });
        printSearch(res, !!opts.json);
    });
    cmd
        .command("extract")
        .description("Structured extract (metadata / tables / jsonld)")
        .argument("[url]", "http(s) URL (omit if using --html)")
        .option("--html <path-or-inline>", "Raw HTML string (or use stdin later)")
        .option("--mode <mode>", "metadata | tables | jsonld | all", "all")
        .option("--json", "JSON output")
        .action(async (url, opts) => {
        const mode = String(opts.mode || "all");
        const res = await structuredExtract({
            url: url || undefined,
            html: opts.html ? String(opts.html) : undefined,
            mode,
            fetchOpts: { cache: openCache() },
        });
        if (opts.json || true) {
            // always structured
            printJSON(res);
        }
        if (!res.ok)
            process.exitCode = 1;
    });
    cmd
        .command("crawl")
        .description("Crawl site (bfs|dfs|sitemap|auto|map; depth≤3, pages≤50)")
        .argument("<url>", "Seed http(s) URL")
        .option("--strategy <s>", "bfs | dfs | sitemap | auto | map (default bfs)", "bfs")
        .option("--max-depth <n>", "Link depth (default 2, max 3)", "2")
        .option("--max-pages <n>", "Page cap (default 20, max 50)", "20")
        .option("--include <regex>", "Include URL regex (repeatable)", (v, acc) => {
        acc.push(v);
        return acc;
    }, [])
        .option("--exclude <regex>", "Exclude URL regex (repeatable)", (v, acc) => {
        acc.push(v);
        return acc;
    }, [])
        .option("--extract-links", "Include inter-page link graph")
        .option("--use-auth", "Send cookies from auth state / env")
        .option("--index", "Embed pages into local vector store")
        .option("--max-total-chars <n>", "Total markdown char budget")
        .option("--max-tokens-out <n>", "Aggregate token budget (approx)")
        .option("--no-full-markdown", "Evidence/excerpt only (strip full bodies)")
        .option("--json", "JSON output")
        .action(async (url, opts) => {
        const strat = String(opts.strategy || "bfs");
        const strategy = strat === "dfs" ||
            strat === "sitemap" ||
            strat === "auto" ||
            strat === "map" ||
            strat === "bfs"
            ? strat
            : "bfs";
        const res = await webCrawl(url, {
            strategy,
            maxDepth: Number(opts.maxDepth) || 2,
            maxPages: Number(opts.maxPages) || 20,
            includePatterns: opts.include?.length ? opts.include : undefined,
            excludePatterns: opts.exclude?.length ? opts.exclude : undefined,
            extractLinksGraph: !!opts.extractLinks,
            useAuth: !!opts.useAuth,
            indexPages: !!opts.index,
            maxTotalChars: opts.maxTotalChars
                ? Number(opts.maxTotalChars)
                : undefined,
            maxTokensOut: opts.maxTokensOut ? Number(opts.maxTokensOut) : undefined,
            includeFullMarkdown: opts.fullMarkdown !== false,
            cache: openCache(),
            minDelayMs: 0, // CLI interactive: no forced delay for snappy demos
        });
        if (opts.json) {
            printJSON(res);
        }
        else if (!res.ok) {
            console.error(`Error [${res.error.code}]: ${res.error.message}`);
            process.exitCode = 1;
        }
        else {
            console.log(`seed: ${res.seed}`);
            console.log(`strategy: ${res.strategyUsed} sitemap=${res.sitemapFound} totalFound=${res.totalFound} crawled=${res.crawled}`);
            if (res.indexed)
                console.log(`indexed: ${res.indexed}`);
            if (res.authUsed)
                console.log(`auth: used`);
            if (res.urls?.length) {
                console.log(`urls: ${res.urls.length}`);
                for (const u of res.urls.slice(0, 30))
                    console.log(`- ${u}`);
                if (res.urls.length > 30)
                    console.log(`… +${res.urls.length - 30} more`);
            }
            for (const p of res.pages) {
                console.log(`- [d${p.depth}] ${p.title} — ${p.url}`);
            }
            if (res.skipped.length) {
                console.log(`skipped: ${res.skipped.length}`);
            }
        }
        if (!res.ok)
            process.exitCode = 1;
    });
    cmd
        .command("similar")
        .description("Find similar pages in local crawl vector index")
        .argument("<query>", "URL or free-text concept")
        .option("--limit <n>", "Max results", "5")
        .option("--json", "JSON output")
        .action((query, opts) => {
        const results = findSimilar(query, { limit: Number(opts.limit) || 5 });
        if (opts.json)
            printJSON({ query, results });
        else {
            console.log(`${results.length} hit(s)`);
            for (const r of results) {
                console.log(`- ${r.score.toFixed(3)} ${r.url}`);
                if (r.textPreview)
                    console.log(`  ${r.textPreview.slice(0, 100)}`);
            }
        }
    });
    cmd
        .command("serve")
        .description("Firecrawl-compat REST (scrape/crawl/map/search)")
        .option("--host <host>", "Bind host", "127.0.0.1")
        .option("--port <n>", "Port", "3333")
        .option("--api-key <key>", "Optional bearer / x-api-key")
        .action(async (opts) => {
        const { url } = await startFirecrawlCompatServer({
            host: String(opts.host || "127.0.0.1"),
            port: Number(opts.port) || 3333,
            apiKey: opts.apiKey ? String(opts.apiKey) : undefined,
            cache: openCache(),
        });
        console.log(`Firecrawl-compat listening on ${url}`);
        console.log(`  POST ${url}/v1/scrape`);
        console.log(`  POST ${url}/v1/crawl  → GET ${url}/v1/crawl/:id`);
        console.log(`  POST ${url}/v1/map`);
        console.log(`  POST ${url}/v1/search`);
        // keep process alive
        await new Promise(() => { });
    });
    cmd
        .command("diff")
        .description("Diff cached page vs fresh fetch (or two --old/--new markdown strings)")
        .argument("[url]", "http(s) URL to re-check")
        .option("--old <markdown>", "Explicit old markdown body")
        .option("--new <markdown>", "Explicit new markdown body")
        .option("--json", "JSON output")
        .action(async (url, opts) => {
        const res = await webDiff({
            url: url || undefined,
            oldMarkdown: opts.old != null ? String(opts.old) : undefined,
            newMarkdown: opts.new != null ? String(opts.new) : undefined,
            cache: openCache(),
        });
        if (opts.json) {
            printJSON(res);
        }
        else if (!res.ok) {
            console.error(`Error [${res.error.code}]: ${res.error.message}`);
        }
        else {
            console.log(`url: ${res.url ?? "(inline)"}`);
            console.log(`changed: ${res.summary.changed}`);
            console.log(`lines: +${res.summary.addedLines} -${res.summary.removedLines}`);
            if (res.summary.unified) {
                console.log("");
                console.log(res.summary.unified);
            }
        }
        if (!res.ok)
            process.exitCode = 1;
    });
    cmd
        .command("cache")
        .description("Inspect or clear the local web cache")
        .option("--clear", "Clear all cached pages")
        .option("--search <q>", "Full-text search over cached pages")
        .option("--json", "JSON output")
        .action((opts) => {
        const cache = openCache();
        if (opts.clear) {
            cache.clear();
            if (opts.json)
                printJSON({ cleared: true, path: cache.dir });
            else
                console.log(`Cleared cache at ${cache.dir}`);
            return;
        }
        if (opts.search) {
            const hits = cache.search(String(opts.search));
            if (opts.json) {
                printJSON({ query: opts.search, hits });
                return;
            }
            console.log(`${hits.length} hit(s) for ${JSON.stringify(opts.search)}`);
            for (const h of hits) {
                console.log(`- ${h.title} — ${h.url}`);
            }
            return;
        }
        const stats = cache.stats();
        if (opts.json)
            printJSON(stats);
        else
            console.log(`Cache: ${stats.entries} entries @ ${stats.path}`);
    });
    cmd
        .command("wire-mcp")
        .description("Wire phneakngar_web_brain MCP into Codex, Claude, and Grok configs")
        .option("--remove", "Remove managed MCP entries")
        .option("--json", "JSON output")
        .action((opts) => {
        const results = wireAll({ remove: !!opts.remove });
        if (opts.json)
            printJSON(results);
        else {
            for (const r of results) {
                console.log(`[${r.action}] ${r.runtime}: ${r.path} — ${r.detail}`);
            }
        }
    });
    return cmd;
}
/** Exported for doctor without constructing full commander tree. */
export function webBrainDoctorCheck() {
    try {
        const cache = openCache();
        return checkWebBrainReady({
            cache,
            enabled: true,
            mcpWired: {
                codex: isCodexWired(),
                claude: isClaudeWired(),
                grok: isGrokWired(),
            },
        });
    }
    catch (err) {
        return {
            name: "Web brain",
            status: "warn",
            detail: `unavailable: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
