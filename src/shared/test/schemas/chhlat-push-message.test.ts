import { describe, it, expect } from "vitest";
import { ChhlatPushMessageSchema } from "../../src/schemas";

describe("ChhlatPushMessageSchema — chhlat.kill", () => {
  it("accepts valid chhlat.kill message with agentId", () => {
    const msg = {
      type: "chhlat.kill",
      workspaceId: "ws1",
      agentId: "ag_abc123",
      taskId: "kt1",
      targetTaskId: "t1",
    };
    const result = ChhlatPushMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("rejects chhlat.kill message without agentId", () => {
    const msg = {
      type: "chhlat.kill",
      workspaceId: "ws1",
      taskId: "kt1",
      targetTaskId: "t1",
    };
    const result = ChhlatPushMessageSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });

  it("rejects chhlat.kill message with non-string agentId", () => {
    const msg = {
      type: "chhlat.kill",
      workspaceId: "ws1",
      agentId: 123,
      taskId: "kt1",
      targetTaskId: "t1",
    };
    const result = ChhlatPushMessageSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });

  it("rejects chhlat.kill message with empty string agentId", () => {
    const msg = {
      type: "chhlat.kill",
      workspaceId: "ws1",
      agentId: "",
      taskId: "kt1",
      targetTaskId: "t1",
    };
    const result = ChhlatPushMessageSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });
});
