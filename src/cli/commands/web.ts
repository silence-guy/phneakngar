import { Command } from "commander";
import {
  webFetch,
  webSearch,
  WebCache,
  defaultCacheDir,
  checkWebBrainReady,
  createMockSearchProvider,
  structuredExtract,
  webCrawl,
  webDiff,
} from "@phneakngar/web-brain";
import { configDir } from "../lib/config.js";
import { printJSON } from "../lib/output.js";
import {
  wireAll,
  isCodexWired,
  isClaudeWired,
} from "../lib/mcp-wire.js";

function openCache(): WebCache {
  const dir =
    process.env.PHNEAKNGAR_WEB_CACHE_DIR || defaultCacheDir(configDir());
  return new WebCache({ dir });
}

function printFetch(res: Awaited<ReturnType<typeof webFetch>>, json: boolean): void {
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

function printSearch(res: Awaited<ReturnType<typeof webSearch>>, json: boolean): void {
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
  console.log("");
  for (const [i, r] of res.results.entries()) {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   ${r.url}`);
    if (r.snippet) console.log(`   ${r.snippet}`);
  }
}

export function webCommand(): Command {
  const cmd = new Command("web").description(
    "Lean local web brain (search / fetch / extract / crawl / MCP) — no wigolo",
  );

  cmd
    .command("status")
    .description("Show web brain readiness, cache stats, MCP wire state")
    .option("--json", "JSON output")
    .action((opts) => {
      const cache = openCache();
      const mcp = { codex: isCodexWired(), claude: isClaudeWired() };
      const status = checkWebBrainReady({ cache, enabled: true, mcpWired: mcp });
      const stats = cache.stats();
      const payload = { ...status, cache: stats, mcp };
      if (opts.json) {
        printJSON(payload);
        return;
      }
      console.log(`Web brain: [${status.status.toUpperCase()}] ${status.detail}`);
      console.log(`Cache: ${stats.entries} entries @ ${stats.path}`);
      console.log(`MCP: codex=${mcp.codex} claude=${mcp.claude}`);
    });

  cmd
    .command("fetch")
    .description("Fetch a public http(s) URL as clean markdown")
    .argument("<url>", "http(s) URL")
    .option("--force-refresh", "Bypass cache")
    .option("--max-chars <n>", "Max markdown chars", "30000")
    .option("--json", "JSON output")
    .option("--skip-cache", "Do not read/write disk cache")
    .action(async (url: string, opts) => {
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
    .description("Search the web (default: ddg-lite; use --mock for offline demo)")
    .argument("<query>", "Search query")
    .option("--max <n>", "Max results", "5")
    .option("--json", "JSON output")
    .option(
      "--mock",
      "Use built-in mock results (no network) — for demos and CI",
    )
    .action(async (query: string, opts) => {
      const maxResults = Number(opts.max) || 5;
      const provider = opts.mock
        ? createMockSearchProvider([
            {
              title: `Mock result for: ${query}`,
              url: "https://example.com/",
              snippet: "Offline mock provider — pass without --mock for live search",
            },
          ])
        : undefined;
      const res = await webSearch(query, { maxResults, provider });
      printSearch(res, !!opts.json);
    });

  cmd
    .command("extract")
    .description("Structured extract (metadata / tables / jsonld)")
    .argument("[url]", "http(s) URL (omit if using --html)")
    .option("--html <path-or-inline>", "Raw HTML string (or use stdin later)")
    .option("--mode <mode>", "metadata | tables | jsonld | all", "all")
    .option("--json", "JSON output")
    .action(async (url: string | undefined, opts) => {
      const mode = String(opts.mode || "all") as "all";
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
      if (!res.ok) process.exitCode = 1;
    });

  cmd
    .command("crawl")
    .description("Capped BFS crawl (max_depth≤2, max_pages≤20)")
    .argument("<url>", "Seed http(s) URL")
    .option("--max-depth <n>", "Link depth (default 1, max 2)", "1")
    .option("--max-pages <n>", "Page cap (default 10, max 20)", "10")
    .option("--json", "JSON output")
    .action(async (url: string, opts) => {
      const res = await webCrawl(url, {
        maxDepth: Number(opts.maxDepth) || 1,
        maxPages: Number(opts.maxPages) || 10,
        cache: openCache(),
        minDelayMs: 0, // CLI interactive: no forced delay for snappy demos
      });
      if (opts.json) {
        printJSON(res);
      } else if (!res.ok) {
        console.error(`Error [${res.error.code}]: ${res.error.message}`);
        process.exitCode = 1;
      } else {
        console.log(`seed: ${res.seed}`);
        console.log(`pages: ${res.pages.length} (robots=${res.robotsFetched})`);
        for (const p of res.pages) {
          console.log(`- [d${p.depth}] ${p.title} — ${p.url}`);
        }
        if (res.skipped.length) {
          console.log(`skipped: ${res.skipped.length}`);
        }
      }
      if (!res.ok) process.exitCode = 1;
    });

  cmd
    .command("diff")
    .description(
      "Diff cached page vs fresh fetch (or two --old/--new markdown strings)",
    )
    .argument("[url]", "http(s) URL to re-check")
    .option("--old <markdown>", "Explicit old markdown body")
    .option("--new <markdown>", "Explicit new markdown body")
    .option("--json", "JSON output")
    .action(async (url: string | undefined, opts) => {
      const res = await webDiff({
        url: url || undefined,
        oldMarkdown: opts.old != null ? String(opts.old) : undefined,
        newMarkdown: opts.new != null ? String(opts.new) : undefined,
        cache: openCache(),
      });
      if (opts.json) {
        printJSON(res);
      } else if (!res.ok) {
        console.error(`Error [${res.error.code}]: ${res.error.message}`);
      } else {
        console.log(`url: ${res.url ?? "(inline)"}`);
        console.log(`changed: ${res.summary.changed}`);
        console.log(
          `lines: +${res.summary.addedLines} -${res.summary.removedLines}`,
        );
        if (res.summary.unified) {
          console.log("");
          console.log(res.summary.unified);
        }
      }
      if (!res.ok) process.exitCode = 1;
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
        if (opts.json) printJSON({ cleared: true, path: cache.dir });
        else console.log(`Cleared cache at ${cache.dir}`);
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
      if (opts.json) printJSON(stats);
      else console.log(`Cache: ${stats.entries} entries @ ${stats.path}`);
    });

  cmd
    .command("wire-mcp")
    .description("Wire phneakngar_web_brain MCP into Codex + Claude configs")
    .option("--remove", "Remove managed MCP entries")
    .option("--json", "JSON output")
    .action((opts) => {
      const results = wireAll({ remove: !!opts.remove });
      if (opts.json) printJSON(results);
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
      mcpWired: { codex: isCodexWired(), claude: isClaudeWired() },
    });
  } catch (err) {
    return {
      name: "Web brain",
      status: "warn" as const,
      detail: `unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
