import { describe, it, expect } from "vitest";
import { GrokBackend } from "../grok.js";

const backend = new GrokBackend("grok");

describe("GrokBackend.parseLine", () => {
  it("empty line returns empty", () => {
    expect(backend.parseLine("")).toEqual([]);
  });

  it("invalid JSON returns log event", () => {
    const events = backend.parseLine("not json");
    expect(events[0].kind).toBe("log");
  });

  it("text → text", () => {
    const line = JSON.stringify({ type: "text", data: "hello" });
    expect(backend.parseLine(line)).toContainEqual({ kind: "text", text: "hello" });
  });

  it("thought → thinking", () => {
    const line = JSON.stringify({ type: "thought", data: "reasoning…" });
    expect(backend.parseLine(line)).toContainEqual({ kind: "thinking", text: "reasoning…" });
  });

  it("end → session_init + turn_end with sessionId", () => {
    const line = JSON.stringify({
      type: "end",
      stopReason: "EndTurn",
      sessionId: "sess-1",
      requestId: "req-1",
    });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "session_init", sessionId: "sess-1" });
    expect(events).toContainEqual({ kind: "turn_end", sessionId: "sess-1" });
  });

  it("error → error + turn_end", () => {
    const line = JSON.stringify({ type: "error", message: "auth failed" });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "error", message: "auth failed" });
    expect(events).toContainEqual({ kind: "turn_end" });
  });

  it("max_turns_reached → internal_progress + turn_end", () => {
    const line = JSON.stringify({ type: "max_turns_reached" });
    const events = backend.parseLine(line);
    expect(events.some((e) => e.kind === "internal_progress")).toBe(true);
    expect(events.some((e) => e.kind === "turn_end")).toBe(true);
  });

  it("tool_call → tool_call", () => {
    const line = JSON.stringify({
      type: "tool_call",
      name: "run_terminal_cmd",
      call_id: "c1",
      input: { command: "ls" },
    });
    expect(backend.parseLine(line)).toContainEqual({
      kind: "tool_call",
      name: "run_terminal_cmd",
      callId: "c1",
      input: { command: "ls" },
    });
  });

  it("tool_result → tool_output", () => {
    const line = JSON.stringify({ type: "tool_result", call_id: "c1", output: "ok" });
    expect(backend.parseLine(line)).toContainEqual({
      kind: "tool_output",
      callId: "c1",
      output: "ok",
    });
  });
});
