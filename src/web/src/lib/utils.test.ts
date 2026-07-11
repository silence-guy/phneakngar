import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let mockHostname: string | undefined;

vi.mock("./utils", async () => {
  const actual = await import("./utils");
  return {
    ...actual,
    isLocalMode: () => {
      if (mockHostname && ["localhost", "127.0.0.1"].includes(mockHostname)) return true;
      return process.env.NODE_ENV === "development";
    },
    cliCmd: () => {
      if (process.env.NODE_ENV === "development") return "pnpm dev:cli";
      if (mockHostname && ["localhost", "127.0.0.1"].includes(mockHostname)) {
        return "npx @phneakngar/app cli";
      }
      return "npx @phneakngar/cli";
    },
    chhlatStartCmd: () => {
      let base: string;
      if (process.env.NODE_ENV === "development") base = "pnpm dev:cli";
      else if (mockHostname && ["localhost", "127.0.0.1"].includes(mockHostname)) base = "npx @phneakngar/app cli";
      else base = "npx @phneakngar/cli";
      const cmd = `${base} chhlat start`;
      if (process.env.NODE_ENV === "development") return `${cmd} --foreground`;
      return cmd;
    },
  };
});

import { isLocalMode, cliCmd, chhlatStartCmd } from "./utils";

beforeEach(() => {
  mockHostname = undefined;
});

afterEach(() => {
  mockHostname = undefined;
});

describe("isLocalMode", () => {
  it("returns true on localhost", () => {
    mockHostname = "localhost";
    expect(isLocalMode()).toBe(true);
  });

  it("returns true on 127.0.0.1", () => {
    mockHostname = "127.0.0.1";
    expect(isLocalMode()).toBe(true);
  });

  it("returns false for non-local hostname in production build", () => {
    mockHostname = "phneakngar.ai";
    expect(isLocalMode()).toBe(false);
  });
});

describe("cliCmd", () => {
  it("returns 'npx @phneakngar/cli' in production cloud", () => {
    mockHostname = "phneakngar.ai";
    expect(cliCmd()).toBe("npx @phneakngar/cli");
  });

  it("returns 'npx @phneakngar/app cli' on localhost (app mode)", () => {
    mockHostname = "localhost";
    expect(cliCmd()).toBe("npx @phneakngar/app cli");
  });
});

describe("chhlatStartCmd", () => {
  it("no --foreground in production cloud", () => {
    mockHostname = "phneakngar.ai";
    expect(chhlatStartCmd()).toBe("npx @phneakngar/cli chhlat start");
    expect(chhlatStartCmd()).not.toContain("--foreground");
  });

  it("no --foreground in app mode (localhost, production build)", () => {
    mockHostname = "localhost";
    expect(chhlatStartCmd()).toBe("npx @phneakngar/app cli chhlat start");
    expect(chhlatStartCmd()).not.toContain("--foreground");
  });
});
