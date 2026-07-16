import { describe, it, expect } from "vitest";
import {
  isHeartbeatAutomation,
  buildHeartbeatPrompt,
  classifyHeartbeatReply,
  shouldNotifyHeartbeat,
  HEARTBEAT_OK_TOKEN,
} from "./gateway-heartbeat";

describe("isHeartbeatAutomation", () => {
  it("detects skill_name heartbeat", () => {
    expect(isHeartbeatAutomation({ skillName: "heartbeat" })).toBe(true);
    expect(isHeartbeatAutomation({ skillName: "Heartbeat" })).toBe(true);
    expect(isHeartbeatAutomation({ skillName: "digest" })).toBe(false);
  });

  it("detects title convention", () => {
    expect(isHeartbeatAutomation({ title: "heartbeat" })).toBe(true);
    expect(isHeartbeatAutomation({ title: "Heartbeat morning" })).toBe(true);
    expect(isHeartbeatAutomation({ title: "daily digest" })).toBe(false);
  });
});

describe("buildHeartbeatPrompt", () => {
  it("includes checklist and HEARTBEAT_OK instruction", () => {
    const p = buildHeartbeatPrompt("- check inbox\n- check calendar");
    expect(p).toContain("HEARTBEAT checklist");
    expect(p).toContain("check inbox");
    expect(p).toContain(HEARTBEAT_OK_TOKEN);
  });

  it("works without checklist", () => {
    expect(buildHeartbeatPrompt(null)).toContain(HEARTBEAT_OK_TOKEN);
  });
});

describe("classifyHeartbeatReply", () => {
  it("suppresses pure HEARTBEAT_OK", () => {
    expect(classifyHeartbeatReply("HEARTBEAT_OK")).toEqual({
      kind: "ack_suppress",
      remainder: "",
    });
  });

  it("alerts on non-OK content", () => {
    expect(classifyHeartbeatReply("Invoice overdue for Acme")).toEqual({
      kind: "alert",
      text: "Invoice overdue for Acme",
    });
  });

  it("empty when blank", () => {
    expect(classifyHeartbeatReply("  ")).toEqual({ kind: "empty" });
  });

  it("suppresses short remainder after OK token", () => {
    const d = classifyHeartbeatReply("HEARTBEAT_OK all quiet");
    expect(d.kind).toBe("ack_suppress");
  });
});

describe("shouldNotifyHeartbeat", () => {
  it("never notifies on ack or none target", () => {
    expect(
      shouldNotifyHeartbeat({ kind: "ack_suppress", remainder: "" }, "last"),
    ).toBe(false);
    expect(
      shouldNotifyHeartbeat({ kind: "alert", text: "x" }, "none"),
    ).toBe(false);
    expect(
      shouldNotifyHeartbeat({ kind: "alert", text: "x" }, "last"),
    ).toBe(true);
  });
});
