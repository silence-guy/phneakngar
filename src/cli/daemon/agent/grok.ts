import { spawn } from "child_process";
import { createInterface } from "readline";
import type { AgentBackend, AgentSession } from "./index.js";
import type {
  ExecOptions,
  AgentMessage,
  AgentResult,
  ParsedEvent,
  DriverLifecycle,
  BusyDeliveryMode,
} from "../types.js";
import { killProcessTree } from "../kill-tree.js";

/**
 * Grok Build (xAI) headless backend.
 *
 * Auth is local-only: `grok login` (Grok subscription OAuth/device code)
 * or `XAI_API_KEY`. The control plane never holds xAI credentials.
 *
 * Protocol: `grok -p … --output-format streaming-json` emits NDJSON events
 * (`text`, `thought`, `end`, `error`, plus best-effort compaction signals).
 * v1 is per-turn only — no mid-turn stdin steering.
 */
export class GrokBackend implements AgentBackend {
  name = "grok";
  lifecycle: DriverLifecycle = { kind: "per_turn", inFlightWake: "coalesce_into_pending" };
  busyDeliveryMode: BusyDeliveryMode = "none";
  supportsStdinNotification = false;

  constructor(private cliPath: string) {}

  parseLine(line: string): ParsedEvent[] {
    if (!line.trim()) return [];
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      return [{ kind: "log", content: line, level: "debug" }];
    }

    const events: ParsedEvent[] = [];
    const eventType = event.type as string | undefined;

    switch (eventType) {
      case "text": {
        const text =
          (event.data as string | undefined) ||
          (event.content as string | undefined) ||
          (event.text as string | undefined) ||
          "";
        if (text) events.push({ kind: "text", text });
        break;
      }

      case "thought":
      case "thinking": {
        const text =
          (event.data as string | undefined) ||
          (event.content as string | undefined) ||
          (event.text as string | undefined) ||
          "";
        if (text) events.push({ kind: "thinking", text });
        break;
      }

      case "end": {
        const sessionId =
          (event.sessionId as string | undefined) ||
          (event.session_id as string | undefined) ||
          "";
        if (sessionId) {
          events.push({ kind: "session_init", sessionId });
        }
        events.push({ kind: "turn_end", sessionId: sessionId || undefined });
        break;
      }

      case "error": {
        const message =
          (event.message as string | undefined) ||
          (event.data as string | undefined) ||
          (event.content as string | undefined) ||
          "grok error";
        events.push({ kind: "error", message });
        events.push({ kind: "turn_end" });
        break;
      }

      case "max_turns_reached": {
        events.push({
          kind: "internal_progress",
          source: "grok",
          itemType: "max_turns_reached",
          payloadBytes: line.length,
        });
        events.push({ kind: "turn_end" });
        break;
      }

      case "auto_compact_started":
      case "compaction_started": {
        events.push({ kind: "compaction_started" });
        break;
      }

      case "auto_compact_finished":
      case "compaction_finished": {
        events.push({ kind: "compaction_finished" });
        break;
      }

      case "tool_call":
      case "tool_use": {
        events.push({
          kind: "tool_call",
          name: (event.name as string) || (event.tool as string) || "",
          callId: (event.call_id as string) || (event.id as string) || "",
          input: (event.input as Record<string, unknown>) || (event.args as Record<string, unknown>),
        });
        break;
      }

      case "tool_result":
      case "tool_output": {
        events.push({
          kind: "tool_output",
          callId: (event.call_id as string) || (event.id as string) || "",
          output: (event.output as string) || (event.data as string) || (event.content as string) || "",
        });
        break;
      }

      default:
        events.push({ kind: "log", content: line, level: "debug" });
    }

    return events;
  }

  encodeStdinMessage(): string | null {
    return null;
  }

  execute(prompt: string, options: ExecOptions): AgentSession {
    const args: string[] = [
      "-p",
      prompt,
      "--output-format",
      "streaming-json",
      "--permission-mode",
      "bypassPermissions",
    ];

    if (options.model) {
      args.push("--model", options.model);
    }
    if (options.maxTurns) {
      args.push("--max-turns", String(options.maxTurns));
    }
    if (options.resumeSessionId) {
      args.push("--resume", options.resumeSessionId);
    }
    if (options.cwd) {
      args.push("--cwd", options.cwd);
    }

    const proc = spawn(this.cliPath, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32",
      windowsHide: true,
      // POSIX: own process group so session-runner can reap CLI + tool children.
      detached: process.platform !== "win32",
    });

    if (!proc.pid) {
      const error = `Failed to start ${this.cliPath}: binary not found or not executable. Is 'grok' installed and on PATH? Authenticate with \`grok login\` (Grok subscription) or set XAI_API_KEY.`;
      const failedResult: AgentResult = { status: "failed", output: "", error, durationMs: 0, sessionId: "" };
      const emptyMessages: AsyncIterable<AgentMessage> = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return { value: undefined as unknown as AgentMessage, done: true };
            },
          };
        },
      };
      return { pid: undefined, messages: emptyMessages, sessionId: Promise.resolve(""), result: Promise.resolve(failedResult) };
    }

    let timedOut = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    if (options.timeout) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        if (proc.pid !== undefined) void killProcessTree(proc.pid);
      }, options.timeout);
    }

    const startTime = Date.now();
    let lastSessionId = "";
    let lastOutput = "";
    let lastError = "";
    let resultStatus: AgentResult["status"] = "completed";
    let resolveSessionId: (id: string) => void;
    const sessionIdPromise = new Promise<string>((resolve) => {
      resolveSessionId = resolve;
    });

    let turnDoneTriggered = false;
    const turnDone = () => {
      if (turnDoneTriggered) return;
      turnDoneTriggered = true;
      try {
        proc.kill("SIGTERM");
      } catch {
        /* already dead */
      }
    };

    const messageQueue: AgentMessage[] = [];
    let messageResolve: (() => void) | null = null;
    let messageDone = false;

    const parsedEventQueue: ParsedEvent[] = [];
    let parsedEventResolve: (() => void) | null = null;
    let parsedEventDone = false;

    const pushMessage = (msg: AgentMessage) => {
      messageQueue.push(msg);
      if (messageResolve) {
        const r = messageResolve;
        messageResolve = null;
        r();
      }
    };

    const pushParsedEvent = (evt: ParsedEvent) => {
      parsedEventQueue.push(evt);
      if (parsedEventResolve) {
        const r = parsedEventResolve;
        parsedEventResolve = null;
        r();
      }
    };

    const resultPromise = new Promise<AgentResult>((resolve) => {
      const stderrChunks: string[] = [];

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk.toString());
      });

      const rl = createInterface({ input: proc.stdout! });

      rl.on("line", (line: string) => {
        if (!line.trim()) return;

        const parsed = this.parseLine(line);
        for (const pe of parsed) pushParsedEvent(pe);

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          pushMessage({ type: "log", content: line, level: "debug" });
          return;
        }

        const eventType = event.type as string | undefined;

        switch (eventType) {
          case "text": {
            const text =
              (event.data as string | undefined) ||
              (event.content as string | undefined) ||
              (event.text as string | undefined) ||
              "";
            if (text) {
              lastOutput = (lastOutput || "") + text;
              pushMessage({ type: "text", content: text });
            }
            break;
          }

          case "thought":
          case "thinking": {
            const text =
              (event.data as string | undefined) ||
              (event.content as string | undefined) ||
              (event.text as string | undefined) ||
              "";
            if (text) pushMessage({ type: "thinking", content: text });
            break;
          }

          case "end": {
            const sessionId =
              (event.sessionId as string | undefined) ||
              (event.session_id as string | undefined) ||
              "";
            if (sessionId) {
              lastSessionId = sessionId;
              resolveSessionId(sessionId);
            }
            // Prefer full final text if provided on end event
            const finalText =
              (event.text as string | undefined) ||
              (event.data as string | undefined) ||
              "";
            if (finalText) lastOutput = finalText;
            turnDone();
            break;
          }

          case "error": {
            const content =
              (event.message as string | undefined) ||
              (event.data as string | undefined) ||
              (event.content as string | undefined) ||
              "grok error";
            lastError = content;
            resultStatus = "failed";
            pushMessage({ type: "error", content });
            turnDone();
            break;
          }

          case "max_turns_reached": {
            resultStatus = "failed";
            if (!lastError) lastError = "max turns reached";
            pushMessage({ type: "error", content: lastError });
            turnDone();
            break;
          }

          case "tool_call":
          case "tool_use": {
            pushMessage({
              type: "tool-use",
              tool: (event.name as string) || (event.tool as string) || "",
              callId: (event.call_id as string) || (event.id as string) || "",
              input: (event.input as Record<string, unknown>) || (event.args as Record<string, unknown>),
            });
            break;
          }

          case "tool_result":
          case "tool_output": {
            pushMessage({
              type: "tool-result",
              callId: (event.call_id as string) || (event.id as string) || "",
              output: (event.output as string) || (event.data as string) || (event.content as string) || "",
            });
            break;
          }

          default: {
            pushMessage({ type: "log", content: line, level: "debug" });
          }
        }
      });

      proc.on("error", (err: Error) => {
        resultStatus = "failed";
        lastError = `spawn error: ${err.message}`;
        resolveSessionId(lastSessionId);
        messageDone = true;
        parsedEventDone = true;
        if (messageResolve) {
          const r = messageResolve;
          messageResolve = null;
          r();
        }
        if (parsedEventResolve) {
          const r = parsedEventResolve;
          parsedEventResolve = null;
          r();
        }
        resolve({
          status: "failed",
          output: "",
          error: lastError,
          durationMs: Date.now() - startTime,
          sessionId: lastSessionId,
        });
      });

      proc.on("close", (code: number | null) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);

        if (timedOut) {
          resultStatus = "timeout";
        } else if (code !== 0 && resultStatus === "completed" && !turnDoneTriggered) {
          if (!lastOutput) {
            resultStatus = "failed";
          }
        }

        const stderr = stderrChunks.join("");
        if (stderr && !lastError) {
          lastError = stderr;
        }

        resolveSessionId(lastSessionId);

        messageDone = true;
        parsedEventDone = true;
        if (messageResolve) {
          const r = messageResolve;
          messageResolve = null;
          r();
        }
        if (parsedEventResolve) {
          const r = parsedEventResolve;
          parsedEventResolve = null;
          r();
        }

        resolve({
          status: resultStatus,
          output: lastOutput,
          error: lastError,
          durationMs: Date.now() - startTime,
          sessionId: lastSessionId,
        });
      });
    });

    const messages: AsyncIterable<AgentMessage> = {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<AgentMessage>> {
            while (messageQueue.length === 0 && !messageDone) {
              await new Promise<void>((resolve) => {
                messageResolve = resolve;
              });
            }
            if (messageQueue.length > 0) {
              return { value: messageQueue.shift()!, done: false };
            }
            return { value: undefined as unknown as AgentMessage, done: true };
          },
        };
      },
    };

    const parsedEvents: AsyncIterable<ParsedEvent> = {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<ParsedEvent>> {
            while (parsedEventQueue.length === 0 && !parsedEventDone) {
              await new Promise<void>((resolve) => {
                parsedEventResolve = resolve;
              });
            }
            if (parsedEventQueue.length > 0) {
              return { value: parsedEventQueue.shift()!, done: false };
            }
            return { value: undefined as unknown as ParsedEvent, done: true };
          },
        };
      },
    };

    const send = (): { ok: boolean; reason?: string } => {
      return { ok: false, reason: "unsupported" };
    };

    const descriptor = {
      lifecycle: this.lifecycle,
      busyDeliveryMode: this.busyDeliveryMode,
      supportsStdinNotification: this.supportsStdinNotification,
    };

    return {
      pid: proc.pid,
      messages,
      parsedEvents,
      sessionId: sessionIdPromise,
      result: resultPromise,
      send,
      descriptor,
    };
  }
}
