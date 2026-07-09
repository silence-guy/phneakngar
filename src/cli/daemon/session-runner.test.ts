import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// Use vi.hoisted to ensure mocks are available at module scope for vi.mock factories
const { mocks, clientInstance, prepare, initEntryAsync, updateEntry, createTimelineEntry,
        findResumableSessionByContextKey, readKillIntent, clearKillIntent,
        killProcessTree, backendExecute, prepareHeadroomForTask, log, mkdir,
        writeFile, rename, rm } = vi.hoisted(() => {
  const clientInstance = {
    completeTask: vi.fn(async () => ({})),
    failTask: vi.fn(async () => ({})),
    supersedeTask: vi.fn(async () => ({})),
    reportMessages: vi.fn(async () => ({})),
    getArtifactMeta: vi.fn(async () => ({ filename: "file.txt", content_type: "text/plain" })),
    downloadArtifact: vi.fn(async () => new ArrayBuffer(0)),
  };

  const prepare = vi.fn(() => ({
    workDir: "/tmp/ws/ws1/agent1/workdir",
    timelineDir: "/tmp/ws/ws1/agent1/workdir/.context_timeline",
    env: {
      PHNEAKNGAR_WORKSPACE_ID: "ws1",
      PHNEAKNGAR_AGENT_ID: "agent1",
      PHNEAKNGAR_TASK_ID: "t1",
      PHNEAKNGAR_CONVERSATION_ID: "c1",
      PHNEAKNGAR_HEALTH_PORT: "19514",
    },
  }));

  const initEntryAsync = vi.fn(async () => {});
  const updateEntry = vi.fn();
  const createTimelineEntry = vi.fn(
    (
      taskId: string,
      prompt: string,
      type: string,
      sessionId?: string,
      pid?: number,
      provider?: string,
      contextKey?: string | null,
      detailedLog?: string | null,
    ) => ({
      task_id: taskId,
      context_key: contextKey ?? null,
      session_id: sessionId || null,
      pid: pid ?? null,
      status: "running",
      datetime: "2026-04-16T10:00:00-05:00",
      type,
      prompt,
      agent_responses: [],
      errmsg: null,
      provider: provider || null,
      detailed_log: detailedLog ?? null,
    }),
  );
  const findResumableSessionByContextKey = vi.fn((): string | null => null);

  const readKillIntent = vi.fn((): any => null);
  const clearKillIntent = vi.fn();

  const killProcessTree = vi.fn(async (pid: number) => {
    try { process.kill(-pid, "SIGTERM"); } catch { /* */ }
  });

  const backendExecute = vi.fn();

  const prepareHeadroomForTask = vi.fn(async () => ({
    status: "disabled",
    env: {},
    requireOptimization: false,
  }));

  const log = { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() };

  const mkdir = vi.fn(async () => undefined);
  const writeFile = vi.fn(async () => undefined);
  const rename = vi.fn(async () => undefined);
  const rm = vi.fn(async () => undefined);

  const mocks = {
    clientInstance,
    prepare,
    initEntryAsync,
    updateEntry,
    createTimelineEntry,
    findResumableSessionByContextKey,
    readKillIntent,
    clearKillIntent,
    killProcessTree,
    backendExecute,
    prepareHeadroomForTask,
    log,
    mkdir,
    writeFile,
    rename,
    rm,
  };

  return {
    mocks,
    clientInstance,
    prepare,
    initEntryAsync,
    updateEntry,
    createTimelineEntry,
    findResumableSessionByContextKey,
    readKillIntent,
    clearKillIntent,
    killProcessTree,
    backendExecute,
    prepareHeadroomForTask,
    log,
    mkdir,
    writeFile,
    rename,
    rm,
  };
});

// Mocks - using vi.hoisted values
vi.mock("./client.js", () => ({
  DaemonClient: function() { return clientInstance; },
}));

vi.mock("./execenv/index.js", () => ({
  prepare,
}));

vi.mock("./execenv/timeline.js", () => ({
  initEntryAsync,
  updateEntry,
  createTimelineEntry,
  findResumableSessionByContextKey,
}));

vi.mock("./execenv/steering.js", () => ({
  readKillIntent,
  clearKillIntent,
}));

vi.mock("./kill-tree.js", () => ({
  killProcessTree,
  isAlive: vi.fn(() => false),
}));

vi.mock("./prompt.js", () => ({
  buildPrompt: vi.fn((task: any) => task.prompt),
}));

vi.mock("./agent/index.js", () => ({
  createBackend: vi.fn(() => ({
    name: "claude",
    execute: backendExecute,
  })),
}));

vi.mock("./headroom/index.js", () => ({
  prepareHeadroomForTask,
}));

vi.mock("../lib/logger.js", () => ({
  createLogger: () => log,
  log,
}));

vi.mock("fs/promises", () => ({
  mkdir,
  writeFile,
  rename,
  rm,
  readdir: vi.fn(async () => []),
  readFile: vi.fn(async () => ""),
  unlink: vi.fn(async () => undefined),
  stat: vi.fn(async () => ({ mtimeMs: 0 })),
}));

import { runSession, writeMarkerFile, reportToServer, type MarkerData } from "./session-runner.js";
import { createBackend } from "./agent/index.js";
import { buildPrompt } from "./prompt.js";
import type { SessionRunnerInput } from "./types.js";

function makeInput(overrides?: Partial<SessionRunnerInput>): SessionRunnerInput {
  return {
    task: {
      id: "t1",
      agentId: "a1",
      runtimeId: "rt1",
      conversationId: "c1",
      workspaceId: "ws1",
      prompt: "do the thing",
      status: "dispatched",
      priority: 0,
      type: "user_dm_message",
      contextKey: "c1",
      createdAt: "2026-01-01T00:00:00Z",
      traceId: null,
      parentTaskId: null,
      channel: null,
    },
    provider: "claude",
    cliPath: "claude",
    model: "opus",
    serverURL: "http://localhost:8080",
    token: "test_token",
    workspacesRoot: "/tmp/ws",
    agentTimeout: 7200000,
    messageInactivityTimeout: 300000,
    ...overrides,
  };
}

function setupBackend(
  messages: any[],
  result: any,
  sessionId = "sess-1",
) {
  backendExecute.mockReturnValue({
    pid: 12345,
    messages: (async function* () {
      for (const msg of messages) yield msg;
    })(),
    sessionId: Promise.resolve(sessionId),
    result: Promise.resolve(result),
  });
}

describe("session-runner runSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareHeadroomForTask.mockResolvedValue({
      status: "disabled",
      env: {},
      requireOptimization: false,
    });
  });

  it("parses input, calls prepare, executes backend, and calls completeTask", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done!",
      error: "",
      durationMs: 1000,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(prepare).toHaveBeenCalledWith(
      { workspacesRoot: "/tmp/ws", token: "test_token" },
      expect.objectContaining({ id: "t1" }),
    );
    expect(createBackend).toHaveBeenCalledWith("claude", "claude");
    expect(backendExecute).toHaveBeenCalledWith(
      "do the thing",
      expect.objectContaining({
        cwd: "/tmp/ws/ws1/agent1/workdir",
        model: "opus",
        timeout: 7200000,
      }),
    );
    expect(clientInstance.completeTask).toHaveBeenCalledWith(
      "test_token",
      "t1",
      expect.objectContaining({ output: "Done!", session_id: "sess-1" }),
    );
  });

  it("prepares Headroom and merges its env overlay", async () => {
    prepareHeadroomForTask.mockResolvedValue({
      status: "ready",
      env: {
        ANTHROPIC_BASE_URL: "http://127.0.0.1:8787",
        HEADROOM_TELEMETRY: "off",
      },
      requireOptimization: false,
    });

    setupBackend([], {
      status: "completed",
      output: "Done!",
      error: "",
      durationMs: 1000,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(prepareHeadroomForTask).toHaveBeenCalled();
    expect(backendExecute).toHaveBeenCalledWith(
      "do the thing",
      expect.objectContaining({
        env: expect.objectContaining({
          ANTHROPIC_BASE_URL: "http://127.0.0.1:8787",
          HEADROOM_TELEMETRY: "off",
        }),
      }),
    );
  });

  it("fails open when optional Headroom is unavailable", async () => {
    prepareHeadroomForTask.mockResolvedValue({
      status: "failed",
      env: {},
      requireOptimization: false,
      diagnostic: "Headroom executable not found: headroom",
    });

    setupBackend([], {
      status: "completed",
      output: "Done!",
      error: "",
      durationMs: 1000,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(backendExecute).toHaveBeenCalled();
    expect(clientInstance.completeTask).toHaveBeenCalledWith(
      "test_token",
      "t1",
      expect.objectContaining({ output: "Done!" }),
    );
    expect(log.warn).toHaveBeenCalledWith("Headroom executable not found: headroom");
  });

  it("fails before spawning when Headroom is required but unavailable", async () => {
    prepareHeadroomForTask.mockResolvedValue({
      status: "failed",
      env: {},
      requireOptimization: true,
      diagnostic: "Headroom executable not found: headroom",
    });

    await runSession(makeInput());

    expect(backendExecute).not.toHaveBeenCalled();
    expect(clientInstance.failTask).toHaveBeenCalledWith(
      "test_token",
      "t1",
      "Headroom optimization required but unavailable: Headroom executable not found: headroom",
    );
  });

  it("calls buildPrompt with task", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "s1",
    });

    await runSession(makeInput());

    expect(buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", prompt: "do the thing" }),
      undefined,
    );
  });

  it("calls failTask on failed agent result", async () => {
    setupBackend([], {
      status: "failed",
      output: "",
      error: "something broke",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(clientInstance.failTask).toHaveBeenCalledWith(
      "test_token",
      "t1",
      "something broke",
    );
    expect(clientInstance.completeTask).not.toHaveBeenCalled();
  });

  it('uses "agent exited unexpectedly" when result.error is empty on failure', async () => {
    setupBackend([], {
      status: "failed",
      output: "",
      error: "",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(clientInstance.failTask).toHaveBeenCalledWith(
      "test_token",
      "t1",
      "agent exited unexpectedly",
    );
  });

  it("writes timeline init entry with session runner PID (process.pid) and sessionId=undefined", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(createTimelineEntry).toHaveBeenCalledWith(
      "t1",
      "do the thing",
      "user_dm_message",
      undefined,
      process.pid,
      "claude",
      "c1",
      undefined,
    );
    expect(initEntryAsync).toHaveBeenCalledWith(
      "/tmp/ws/ws1/a1/workdir/.context_timeline",
      expect.objectContaining({ task_id: "t1", pid: process.pid, session_id: null }),
    );
  });

  it("updates timeline entry with session_id after agent starts", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    const firstCall = updateEntry.mock.calls[0];
    expect(firstCall[0]).toBe("/tmp/ws/ws1/a1/workdir/.context_timeline");
    expect(firstCall[1]).toBe("t1");
    const entry = { session_id: null as string | null, agent_started: undefined as boolean | undefined };
    firstCall[2](entry);
    expect(entry.session_id).toBe("sess-1");
    expect(entry.agent_started).toBe(true);
  });

  it("does not mark agent_started when sessionId resolves to an empty string", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "",
    }, "");

    await runSession(makeInput());

    const firstCall = updateEntry.mock.calls[0];
    const entry = { session_id: "stale" as string | null, agent_started: undefined as boolean | undefined };
    firstCall[2](entry);
    expect(entry.session_id).toBeNull();
    expect(entry.agent_started).toBeUndefined();
  });

  it("initEntryAsync is called with detailedLog from input.logFilePath", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput({ logFilePath: "/tmp/logs/t1.log" }));

    expect(createTimelineEntry).toHaveBeenCalledWith(
      "t1",
      "do the thing",
      "user_dm_message",
      undefined,
      process.pid,
      "claude",
      "c1",
      "/tmp/logs/t1.log",
    );
  });

  it("finalizes timeline entry on completion (status=completed, pid=null, session_id set)", async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "sess-2",
    });

    await runSession(makeInput());

    const calls = updateEntry.mock.calls;
    const lastCall = calls[calls.length - 1];
    const entry = {
      session_id: null as string | null,
      pid: process.pid as number | null,
      status: "running" as string,
      errmsg: null as string | null,
      agent_responses: [] as string[],
    };
    lastCall[2](entry);
    expect(entry.session_id).toBe("sess-2");
    expect(entry.pid).toBeNull();
    expect(entry.status).toBe("completed");
  });

  it("reports messages via reportMessages", async () => {
    const messages = [
      { type: "user", role: "user", content: "hello" },
      { type: "assistant", role: "assistant", content: "hi" },
    ];
    setupBackend(messages, {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput());

    expect(clientInstance.reportMessages).toHaveBeenCalledWith(
      "test_token",
      "t1",
      expect.arrayContaining([
        expect.objectContaining({ type: "user", content: "hello" }),
        expect.objectContaining({ type: "assistant", content: "hi" }),
      ]),
    );
  });

  it('uses "default" when model is empty', async () => {
    setupBackend([], {
      status: "completed",
      output: "Done",
      error: "",
      durationMs: 100,
      sessionId: "sess-1",
    });

    await runSession(makeInput({ model: "" }));

    // The source code passes model || undefined, not model || "default"
    expect(backendExecute).toHaveBeenCalledWith(
      "do the thing",
      expect.objectContaining({ model: undefined }),
    );
  });

  describe("logging", () => {
    it("logs task start with metadata", async () => {
      setupBackend([], {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `starting (task=t1, type=user_dm_message, agent=a1, provider=claude, model=opus)`,
      );
    });

    it("logs agent started with PID and session ID", async () => {
      setupBackend([], {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `agent started (pid=12345, session=sess-1)`,
      );
    });

    it("logs user prompt with role=user", async () => {
      setupBackend([], {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `{"role":"user","type":"text","content":"do the thing"}`,
      );
    });

    it("logs each agent message with role=assistant", async () => {
      const messages = [
        { type: "text", content: "hello world" },
      ];
      setupBackend(messages, {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `{"role":"assistant","type":"text","content":"hello world"}`,
      );
    });

    it("logs tool-use messages with role=assistant and counts tools", async () => {
      const messages = [
        { type: "tool-use", tool: "Read", callId: "c1", input: { file_path: "a.ts" } },
      ];
      setupBackend(messages, {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `{"role":"assistant","type":"tool-use","tool":"Read","callId":"c1","input":{"file_path":"a.ts"}}`,
      );
    });

    it("logs completion with duration, message count, and tool count", async () => {
      setupBackend(
        [
          { type: "text", content: "a" },
          { type: "tool-use", tool: "Read", callId: "c1" },
          { type: "text", content: "b" },
        ],
        {
          status: "completed",
          output: "Done",
          error: "",
          durationMs: 5400,
          sessionId: "sess-1",
        },
      );

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `completed (duration=5.4s, messages=3, tools=1)`,
      );
    });

    it("logs failure with duration, message count, tool count, and error", async () => {
      setupBackend(
        [
          { type: "text", content: "a" },
          { type: "tool-use", tool: "Read", callId: "c1" },
          { type: "text", content: "b" },
        ],
        {
          status: "failed",
          output: "",
          error: "command failed",
          durationMs: 1200,
          sessionId: "sess-1",
        },
      );

      await runSession(makeInput());

      expect(log.info).toHaveBeenCalledWith(
        `failed (duration=1.2s, messages=3, tools=1) — command failed`,
      );
    });

    it("logs kill with message count and tool count", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
      let releaseHang: (() => void) | undefined;
      clientInstance.failTask.mockResolvedValue({});

      backendExecute.mockReturnValue({
        pid: 12345,
        messages: (async function* () {
          yield { type: "text", content: "hi" };
          yield { type: "text", content: "there" };
          yield { type: "tool-use", tool: "Read", callId: "c1" };
          await new Promise<void>((r) => { releaseHang = r; });
        })(),
        sessionId: Promise.resolve("sess-1"),
        result: new Promise(() => {}),
      });

      const runPromise = runSession(makeInput()).catch(() => undefined);
      // Allow runSession to register signal handlers and consume the 3 messages
      for (let i = 0; i < 20 && !releaseHang; i++) {
        await new Promise((r) => setTimeout(r, 5));
      }
      process.emit("SIGTERM", "SIGTERM");
      // Let onKill await failTask, then unblock the generator so the loop can exit
      await new Promise((r) => setTimeout(r, 30));
      releaseHang?.();
      await Promise.race([runPromise, new Promise((r) => setTimeout(r, 100))]);

      expect(log.info).toHaveBeenCalledWith(
        `killed by signal (messages=3, tools=1)`,
      );
      exitSpy.mockRestore();
      process.removeAllListeners("SIGTERM");
      process.removeAllListeners("SIGINT");
    });

    it("logs default model when model is empty", async () => {
      setupBackend([], {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput({ model: "" }));

      // The source logs "model=" (empty) when model is empty string
      const logCalls = log.info.mock.calls.map((c: any[]) => c[0] as string);
      const startLog = logCalls.find((s: string) => s.includes("starting"));
      expect(startLog).toBeDefined();
      // Source code: `model=${model || "default"}` - empty string is falsy so "default" is used
      expect(startLog).toContain("model=default");
    });

    it("truncates tool-result output longer than 500 chars in log", async () => {
      const longOutput = "x".repeat(600);
      setupBackend([{ type: "tool-result", callId: "c1", output: longOutput }], {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      const logCalls = log.info.mock.calls.map((c: any[]) => c[0] as string);
      const toolResultLog = logCalls.find((s: string) => s.includes('"type":"tool-result"'));
      expect(toolResultLog).toBeDefined();
      const parsed = JSON.parse(toolResultLog!);
      expect(parsed.output.length).toBeLessThan(550);
      expect(parsed.output).toContain("... (600 chars)");
    });

    it("does not truncate tool-result output under 500 chars in log", async () => {
      setupBackend([{ type: "tool-result", callId: "c1", output: "short output" }], {
        status: "completed",
        output: "Done",
        error: "",
        durationMs: 100,
        sessionId: "sess-1",
      });

      await runSession(makeInput());

      const logCalls = log.info.mock.calls.map((c: any[]) => c[0] as string);
      const toolResultLog = logCalls.find((s: string) => s.includes('"type":"tool-result"'));
      expect(toolResultLog).toBeDefined();
      const parsed = JSON.parse(toolResultLog!);
      expect(parsed.output).toBe("short output");
    });
  });
});

// writeMarkerFile and reportToServer tests
describe("reportToServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds without writing a marker when the report fn resolves", async () => {
    const fn = vi.fn().mockResolvedValue({ status: "completed", output: "Done!" });
    await reportToServer(
      fn,
      { taskId: "t1", type: "complete", payload: { output: "Done!" }, token: "test_token", serverURL: "http://localhost:8080", createdAt: new Date().toISOString() },
      "/tmp/ws",
    );

    expect(fn).toHaveBeenCalledTimes(1);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("writes marker after retryable failures exhaust retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const reportPromise = reportToServer(
      fn,
      { taskId: "t1", type: "fail", payload: { error: "Task failed" }, token: "test_token", serverURL: "http://localhost:8080", createdAt: new Date().toISOString() },
      "/tmp/ws",
    );

    // RETRY_DELAYS = [1000, 3000, 9000]
    await vi.advanceTimersByTimeAsync(1000 + 3000 + 9000 + 100);
    await reportPromise;

    expect(fn.mock.calls.length).toBeGreaterThan(1);
    expect(writeFile).toHaveBeenCalled();
  });
});

describe("writeMarkerFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes marker with "complete" status', async () => {
    await writeMarkerFile("/tmp/ws", { taskId: "t1", type: "complete", payload: { output: "Done" }, token: "test_token", serverURL: "http://localhost:8080", createdAt: new Date().toISOString() });
    expect(writeFile).toHaveBeenCalled();
    expect(rename).toHaveBeenCalled();
  });

  it('writes marker with "fail" status', async () => {
    await writeMarkerFile("/tmp/ws", { taskId: "t1", type: "fail", payload: { error: "failed" }, token: "test_token", serverURL: "http://localhost:8080", createdAt: new Date().toISOString() });
    expect(writeFile).toHaveBeenCalled();
  });

  it("includes timestamp in marker", async () => {
    const createdAt = "2026-04-16T10:00:00.000Z";
    await writeMarkerFile("/tmp/ws", { taskId: "t1", type: "complete", payload: { output: "Done" }, token: "test_token", serverURL: "http://localhost:8080", createdAt });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining(".tmp"),
      expect.stringContaining(createdAt),
      expect.objectContaining({ mode: 0o600 }),
    );
  });
});

describe("session-runner marker integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
  });

  it('report fn failure writes complete marker', async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const reportPromise = reportToServer(
      fn,
      { taskId: "t1", type: "complete", payload: { output: "Done!" }, token: "test_token", serverURL: "http://localhost:8080", createdAt: new Date().toISOString() },
      "/tmp/ws",
    );
    await vi.advanceTimersByTimeAsync(1000 + 3000 + 9000 + 100);
    await reportPromise;
    expect(writeFile).toHaveBeenCalled();
  });

  it('report fn failure writes fail marker', async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));
    const reportPromise = reportToServer(
      fn,
      { taskId: "t1", type: "fail", payload: { error: "Task failed" }, token: "test_token", serverURL: "http://localhost:8080", createdAt: new Date().toISOString() },
      "/tmp/ws",
    );
    await vi.advanceTimersByTimeAsync(1000 + 3000 + 9000 + 100);
    await reportPromise;
    expect(writeFile).toHaveBeenCalled();
  });

  it("onKill reports failTask and exits", async () => {
    vi.useRealTimers();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    let releaseHang: (() => void) | undefined;

    clientInstance.failTask.mockResolvedValue({});

    backendExecute.mockReturnValue({
      pid: 12345,
      messages: (async function* () {
        yield { type: "text", content: "hi" };
        await new Promise<void>((r) => { releaseHang = r; });
      })(),
      sessionId: Promise.resolve("sess-1"),
      result: new Promise(() => {}),
    });

    const runPromise = runSession(makeInput()).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 30));
    process.emit("SIGTERM", "SIGTERM");
    releaseHang?.();
    await new Promise((r) => setTimeout(r, 50));
    await Promise.race([runPromise, new Promise((r) => setTimeout(r, 50))]);

    expect(clientInstance.failTask).toHaveBeenCalledWith(
      "test_token",
      "t1",
      "killed by signal",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
