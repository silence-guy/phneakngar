import { describe, it, expect } from "vitest";
import {
  handleMcpMessage,
  listTools,
  callTool,
  takeJsonObject,
} from "../src/mcp-server.js";

describe("MCP server handlers", () => {
  it("lists tools including extract, crawl, and diff", () => {
    const names = listTools().map((t) => t.name);
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
    expect(names).toContain("web_extract");
    expect(names).toContain("web_crawl");
    expect(names).toContain("web_diff");
    expect(names).toContain("web_cache");
  });

  it("initialize returns serverInfo", async () => {
    const resp = await handleMcpMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(resp).toMatchObject({
      id: 1,
      result: {
        serverInfo: { name: "phneakngar-web-brain" },
      },
    });
  });

  it("initialize echoes Grok protocolVersion 2025-06-18", async () => {
    const resp = (await handleMcpMessage({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    })) as { result: { protocolVersion: string } };
    expect(resp.result.protocolVersion).toBe("2025-06-18");
  });

  it("takeJsonObject extracts bare JSON without trailing newline", () => {
    const taken = takeJsonObject('{"a":1}{"b":2}');
    expect(taken?.json).toBe('{"a":1}');
    expect(taken?.rest).toBe('{"b":2}');
  });

  it("tools/list returns tools", async () => {
    const resp = (await handleMcpMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    })) as { result: { tools: { name: string }[] } };
    expect(resp.result.tools.length).toBeGreaterThanOrEqual(5);
  });

  it("tools/call web_search with mock", async () => {
    const resp = (await handleMcpMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "web_search",
        arguments: { query: "test", mock: true },
      },
    })) as {
      result: { content: { text: string }[]; isError?: boolean };
    };
    expect(resp.result.isError).toBeFalsy();
    const body = JSON.parse(resp.result.content[0]!.text) as {
      ok: boolean;
      results: unknown[];
    };
    expect(body.ok).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
  });

  it("tools/call web_extract from html", async () => {
    const html = `<html><head><title>T</title></head><body><table><tr><th>A</th></tr><tr><td>1</td></tr></table></body></html>`;
    const result = (await callTool("web_extract", {
      html,
      mode: "tables",
    })) as { ok: boolean; tables?: { headers: string[] }[] };
    expect(result.ok).toBe(true);
    expect(result.tables?.[0]?.headers).toEqual(["A"]);
  });

  it("tools/call web_crawl rejects SSRF", async () => {
    const result = (await callTool("web_crawl", {
      url: "http://127.0.0.1/",
    })) as { ok: boolean };
    expect(result.ok).toBe(false);
  });

  it("tools/call web_diff on inline markdown", async () => {
    const result = (await callTool("web_diff", {
      old_markdown: "a\n",
      new_markdown: "b\n",
    })) as { ok: boolean; summary?: { changed: boolean } };
    expect(result.ok).toBe(true);
    expect(result.summary?.changed).toBe(true);
  });
});

