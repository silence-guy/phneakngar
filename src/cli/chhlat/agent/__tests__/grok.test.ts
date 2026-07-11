import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { Readable } from "stream";
import type { AgentMessage } from "../../types.js";

let currentMockProc: ReturnType<typeof createMockProc> | null = null;
let lastSpawnArgs: { cmd: string; args: string[]; opts: Record<string, unknown> } | null = null;
const mockKillProcessTree = vi.fn().mockResolvedValue(undefined);

function createMockProc(pid: number | undefined = 12345) {
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  const proc = Object.assign(new EventEmitter(), {
    stdout,
    stderr,
    stdin: null,
    kill: vi.fn(),
    pid,
  });
  return { proc, stdout, stderr };
}

vi.mock("child_process", () => ({
  spawn: vi.fn((cmd: string, args: string[], opts: Record<string, unknown>) => {
    lastSpawnArgs = { cmd, args, opts };
    currentMockProc = createMockProc();
    return currentMockProc.proc;
  }),
}));

vi.mock("../../kill-tree.js", () => ({
  killProcessTree: mockKillProcessTree,
  killGraceMs: () => 2000,
  isAlive: () => false,
}));

const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

async function collectMessages(
  messages: AsyncIterable<AgentMessage>,
  maxMessages = 50,
  timeoutMs = 500,
): Promise<AgentMessage[]> {
  const collected: AgentMessage[] = [];
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  const iter = messages[Symbol.asyncIterator]();
  for (let i = 0; i < maxMessages; i++) {
    const next = iter.next();
    const result = await Promise.race([next, timeout.then(() => null)]);
    if (!result || result.done) break;
    collected.push(result.value);
  }
  return collected;
}

const { GrokBackend } = await import("../grok.js");
const { spawn } = await import("child_process");

function getMock() {
  return currentMockProc!;
}

describe("GrokBackend", () => {
  let backend: InstanceType<typeof GrokBackend>;

  beforeEach(() => {
    vi.clearAllMocks();
    currentMockProc = null;
    lastSpawnArgs = null;
    backend = new GrokBackend("/usr/bin/grok");
  });

  it("spawns with streaming-json and bypassPermissions", () => {
    backend.execute("fix the bug", { cwd: "/tmp/ws" });
    expect(lastSpawnArgs?.cmd).toBe("/usr/bin/grok");
    expect(lastSpawnArgs?.args).toEqual(
      expect.arrayContaining([
        "-p",
        "fix the bug",
        "--output-format",
        "streaming-json",
        "--permission-mode",
        "bypassPermissions",
        "--cwd",
        "/tmp/ws",
      ]),
    );
  });

  it("passes model, maxTurns, and resumeSessionId", () => {
    backend.execute("hi", {
      cwd: "/tmp",
      model: "grok-4.5",
      maxTurns: 12,
      resumeSessionId: "sess-abc",
    });
    expect(lastSpawnArgs?.args).toEqual(
      expect.arrayContaining([
        "--model",
        "grok-4.5",
        "--max-turns",
        "12",
        "--resume",
        "sess-abc",
      ]),
    );
  });

  it("emits text chunks from streaming-json", async () => {
    const session = backend.execute("hello", { cwd: "/tmp" });
    const mock = getMock();

    mock.stdout.push(JSON.stringify({ type: "text", data: "Hi " }) + "\n");
    mock.stdout.push(JSON.stringify({ type: "text", data: "there" }) + "\n");
    await tick();
    mock.proc.emit("close", 0);

    const messages = await collectMessages(session.messages);
    expect(messages).toContainEqual({ type: "text", content: "Hi " });
    expect(messages).toContainEqual({ type: "text", content: "there" });
  });

  it("emits thinking for thought events", async () => {
    const session = backend.execute("hello", { cwd: "/tmp" });
    const mock = getMock();

    mock.stdout.push(JSON.stringify({ type: "thought", data: "plan steps" }) + "\n");
    await tick();
    mock.proc.emit("close", 0);

    const messages = await collectMessages(session.messages);
    expect(messages).toContainEqual({ type: "thinking", content: "plan steps" });
  });

  it("captures sessionId from end event and completes", async () => {
    const session = backend.execute("hello", { cwd: "/tmp" });
    const mock = getMock();

    mock.stdout.push(
      JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "sess-99" }) + "\n",
    );
    await tick();
    mock.proc.emit("close", 0);

    await expect(session.sessionId).resolves.toBe("sess-99");
    const result = await session.result;
    expect(result.status).toBe("completed");
    expect(result.sessionId).toBe("sess-99");
  });

  it("marks failed on error event", async () => {
    const session = backend.execute("hello", { cwd: "/tmp" });
    const mock = getMock();

    mock.stdout.push(JSON.stringify({ type: "error", message: "not authenticated" }) + "\n");
    await tick();
    mock.proc.emit("close", 1);

    const messages = await collectMessages(session.messages);
    expect(messages).toContainEqual({ type: "error", content: "not authenticated" });
    const result = await session.result;
    expect(result.status).toBe("failed");
    expect(result.error).toBe("not authenticated");
  });

  it("returns failed result when binary cannot start", async () => {
    vi.mocked(spawn).mockImplementationOnce((cmd: string, args: string[], opts: Record<string, unknown>) => {
      lastSpawnArgs = { cmd, args, opts };
      // Simulate spawn without a pid (binary missing / not executable).
      const stdout = new Readable({ read() {} });
      const stderr = new Readable({ read() {} });
      const proc = Object.assign(new EventEmitter(), {
        stdout,
        stderr,
        stdin: null,
        kill: vi.fn(),
        pid: undefined as number | undefined,
      });
      currentMockProc = { proc, stdout, stderr };
      return proc as never;
    });

    const session = backend.execute("hello", { cwd: "/tmp" });
    expect(session.pid).toBeUndefined();
    const result = await Promise.race([
      session.result,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("result hung")), 1000)),
    ]);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/grok/i);
  });

  it("kills process tree on timeout", async () => {
    const session = backend.execute("hello", { cwd: "/tmp", timeout: 20 });
    await tick(40);
    expect(mockKillProcessTree).toHaveBeenCalled();
    getMock().proc.emit("close", null);
    const result = await session.result;
    expect(result.status).toBe("timeout");
  });
});
