import { describe, it, expect, afterEach } from "vitest";
import { isDev, cmdPrefix } from "./env.js";

afterEach(() => {
  delete process.env.PHNEAKNGAR_SERVER_URL;
  delete process.env.PHNEAKNGAR_CMD_PREFIX;
});

describe("isDev", () => {
  it("returns false when PHNEAKNGAR_SERVER_URL is not set", () => {
    expect(isDev()).toBe(false);
  });

  it("returns true when PHNEAKNGAR_SERVER_URL is set", () => {
    process.env.PHNEAKNGAR_SERVER_URL = "http://localhost:3000";
    expect(isDev()).toBe(true);
  });

  it("returns false when PHNEAKNGAR_CMD_PREFIX is set (app mode)", () => {
    process.env.PHNEAKNGAR_SERVER_URL = "http://localhost:3000";
    process.env.PHNEAKNGAR_CMD_PREFIX = "npx @phneakngar/app cli";
    expect(isDev()).toBe(false);
  });
});

describe("cmdPrefix", () => {
  it("returns 'npx @phneakngar/cli' in production", () => {
    expect(cmdPrefix()).toBe("npx @phneakngar/cli");
  });

  it("returns 'pnpm dev:cli' in dev", () => {
    process.env.PHNEAKNGAR_SERVER_URL = "http://localhost:3000";
    expect(cmdPrefix()).toBe("pnpm dev:cli");
  });

  it("returns PHNEAKNGAR_CMD_PREFIX when set", () => {
    process.env.PHNEAKNGAR_SERVER_URL = "http://localhost:3000";
    process.env.PHNEAKNGAR_CMD_PREFIX = "npx @phneakngar/app cli";
    expect(cmdPrefix()).toBe("npx @phneakngar/app cli");
  });
});
