/**
 * Firecrawl v1 compatibility HTTP shim (experimental).
 * Subset: POST /v1/scrape, /v1/crawl, GET /v1/crawl/:id, POST /v1/map, POST /v1/search.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { webFetch } from "./fetch.js";
import { webCrawl } from "./crawl.js";
import { webSearch } from "./search.js";
import { WebCache, defaultCacheDir } from "./cache.js";
import { join } from "node:path";
import { homedir } from "node:os";

export type FirecrawlServeOptions = {
  host?: string;
  port?: number;
  /** Optional bearer token (Authorization: Bearer …). */
  apiKey?: string;
  cache?: WebCache;
};

type JobStatus = "scraping" | "completed" | "failed";

type CrawlJob = {
  id: string;
  status: JobStatus;
  data: { markdown: string; metadata: { sourceURL: string; statusCode?: number } }[];
  total?: number;
  completed?: number;
  error?: string;
  settledAt?: number;
};

const JOB_TTL_MS = 30 * 60 * 1000;
const JOB_CAP = 100;
const RUNNING_CAP = 16;
let running = 0;

export class CrawlJobStore {
  private jobs = new Map<string, CrawlJob>();

  create(): CrawlJob {
    this.sweep();
    const job: CrawlJob = {
      id: randomUUID(),
      status: "scraping",
      data: [],
    };
    this.jobs.set(job.id, job);
    while (this.jobs.size > JOB_CAP) {
      const oldest = this.jobs.keys().next().value;
      if (oldest) this.jobs.delete(oldest);
      else break;
    }
    return job;
  }

  get(id: string): CrawlJob | undefined {
    this.sweep();
    return this.jobs.get(id);
  }

  settle(job: CrawlJob, patch: Partial<CrawlJob>): void {
    Object.assign(job, patch);
    job.settledAt = Date.now();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (job.settledAt && now - job.settledAt > JOB_TTL_MS) {
        this.jobs.delete(id);
      }
    }
  }

  get size(): number {
    return this.jobs.size;
  }
}

const jobStore = new CrawlJobStore();

function readBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(raw);
}

function unauthorized(res: ServerResponse): void {
  json(res, 401, { success: false, error: "Unauthorized" });
}

function checkAuth(
  req: IncomingMessage,
  apiKey?: string,
): boolean {
  if (!apiKey) return true;
  const h = req.headers.authorization ?? "";
  if (h === `Bearer ${apiKey}`) return true;
  if (req.headers["x-api-key"] === apiKey) return true;
  return false;
}

export function createFirecrawlCompatHandler(opts: FirecrawlServeOptions = {}) {
  const cache =
    opts.cache ??
    new WebCache({
      dir:
        process.env.PHNEAKNGAR_WEB_CACHE_DIR ||
        defaultCacheDir(join(homedir(), ".phneakngar")),
    });

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization,x-api-key",
      });
      res.end();
      return;
    }

    if (!checkAuth(req, opts.apiKey)) {
      unauthorized(res);
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    // Accept both /v1/... and /compat/firecrawl/v1/...
    let path = url.pathname.replace(/\/+$/, "") || "/";
    path = path.replace(/^\/compat\/firecrawl/, "") || "/";

    try {
      if (req.method === "GET" && path === "/health") {
        json(res, 200, { ok: true, service: "phneakngar-firecrawl-compat" });
        return;
      }

      if (req.method === "POST" && path === "/v1/scrape") {
        const body = JSON.parse((await readBody(req)) || "{}") as {
          url?: string;
          formats?: string[];
        };
        if (!body.url) {
          json(res, 400, { success: false, error: "url required" });
          return;
        }
        const r = await webFetch(body.url, { cache });
        if (!r.ok) {
          json(res, 502, { success: false, error: r.error.message });
          return;
        }
        json(res, 200, {
          success: true,
          data: {
            markdown: r.markdown,
            metadata: {
              title: r.title,
              sourceURL: r.finalUrl,
              statusCode: r.httpStatus,
            },
          },
        });
        return;
      }

      if (req.method === "POST" && path === "/v1/map") {
        const body = JSON.parse((await readBody(req)) || "{}") as {
          url?: string;
          limit?: number;
        };
        if (!body.url) {
          json(res, 400, { success: false, error: "url required" });
          return;
        }
        const r = await webCrawl(body.url, {
          strategy: "map",
          maxPages: Math.min(body.limit ?? 50, 50),
          cache,
          minDelayMs: 0,
        });
        if (!r.ok) {
          json(res, 502, { success: false, error: r.error.message });
          return;
        }
        json(res, 200, {
          success: true,
          links: r.urls ?? [],
        });
        return;
      }

      if (req.method === "POST" && path === "/v1/search") {
        const body = JSON.parse((await readBody(req)) || "{}") as {
          query?: string;
          limit?: number;
        };
        if (!body.query) {
          json(res, 400, { success: false, error: "query required" });
          return;
        }
        const r = await webSearch(body.query, {
          maxResults: Math.min(body.limit ?? 5, 20),
        });
        if (!r.ok) {
          json(res, 502, { success: false, error: r.error.message });
          return;
        }
        json(res, 200, {
          success: true,
          data: r.results.map((x) => ({
            title: x.title,
            url: x.url,
            description: x.snippet,
          })),
        });
        return;
      }

      if (req.method === "POST" && path === "/v1/crawl") {
        if (running >= RUNNING_CAP) {
          json(res, 429, {
            success: false,
            error: "too many concurrent crawl jobs",
          });
          return;
        }
        const body = JSON.parse((await readBody(req)) || "{}") as {
          url?: string;
          limit?: number;
          maxDepth?: number;
          includePaths?: string[];
          excludePaths?: string[];
        };
        if (!body.url) {
          json(res, 400, { success: false, error: "url required" });
          return;
        }
        const job = jobStore.create();
        running += 1;
        void (async () => {
          try {
            const r = await webCrawl(body.url!, {
              strategy: "auto",
              maxPages: Math.min(body.limit ?? 20, 50),
              maxDepth: Math.min(body.maxDepth ?? 2, 3),
              includePatterns: body.includePaths,
              excludePatterns: body.excludePaths,
              cache,
              minDelayMs: 100,
              indexPages: process.env.PHNEAKNGAR_CRAWL_INDEX === "1",
            });
            if (!r.ok) {
              jobStore.settle(job, {
                status: "failed",
                error: r.error.message,
              });
              return;
            }
            jobStore.settle(job, {
              status: "completed",
              data: r.pages.map((p) => ({
                markdown: p.markdown,
                metadata: { sourceURL: p.url, statusCode: 200 },
              })),
              total: r.totalFound,
              completed: r.crawled,
            });
          } catch (e) {
            jobStore.settle(job, {
              status: "failed",
              error: e instanceof Error ? e.message : String(e),
            });
          } finally {
            running = Math.max(0, running - 1);
          }
        })();
        json(res, 200, { success: true, id: job.id, url: `/v1/crawl/${job.id}` });
        return;
      }

      const crawlGet = path.match(/^\/v1\/crawl\/([^/]+)$/);
      if (req.method === "GET" && crawlGet) {
        const job = jobStore.get(crawlGet[1]!);
        if (!job) {
          json(res, 404, { success: false, error: "job not found" });
          return;
        }
        json(res, 200, {
          success: true,
          status: job.status,
          total: job.total ?? 0,
          completed: job.completed ?? job.data.length,
          data: job.data,
          error: job.error,
        });
        return;
      }

      json(res, 404, {
        success: false,
        error: `not found: ${path}`,
        hint: "POST /v1/scrape|crawl|map|search, GET /v1/crawl/:id",
      });
    } catch (e) {
      json(res, 500, {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
}

export async function startFirecrawlCompatServer(
  opts: FirecrawlServeOptions = {},
): Promise<{ server: ReturnType<typeof createServer>; url: string }> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 3333;
  const handler = createFirecrawlCompatHandler(opts);
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const addr = server.address();
  const actualPort =
    typeof addr === "object" && addr ? addr.port : port;
  return { server, url: `http://${host}:${actualPort}` };
}

export { jobStore as firecrawlJobStore };
