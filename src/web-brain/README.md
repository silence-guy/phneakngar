# @phneakngar/web-brain

Lean local web toolkit for ភ្នាក់ងារ agents: **search**, **fetch** (HTML → markdown), and **disk cache** with FTS.

- No `wigolo` dependency
- No onnx / embeddings / Playwright browser stack
- SSRF guards on all outbound fetch targets
- Cache under the agent config directory (`web-cache/`)

## API

```ts
import {
  webFetch,
  webSearch,
  WebCache,
  structuredExtract,
  webCrawl,
  webDiff,
  assertSafeHttpUrl,
  runMcpStdio,
} from "@phneakngar/web-brain";
```

## CLI

```bash
phneakngar web search "query"
phneakngar web fetch https://example.com
phneakngar web extract https://example.com --mode all
phneakngar web crawl https://example.com --max-depth 1 --max-pages 5
phneakngar web diff https://example.com
phneakngar web wire-mcp
phneakngar web status
```

## MCP

```bash
# after wire-mcp, Codex/Claude load tools:
# web_search, web_fetch, web_cache, web_extract, web_crawl, web_diff
pnpm --filter @phneakngar/web-brain mcp
```
