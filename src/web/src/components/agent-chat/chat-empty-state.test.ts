import { describe, it, expect } from "vitest";
import {
  resolveChatEmptyState,
  isActiveTaskStuck,
  ACTIVE_TASK_STUCK_AFTER_MS,
} from "./chat-empty-state";

describe("resolveChatEmptyState", () => {
  const base = {
    messageCount: 0,
    isNewAgent: false,
    hasEmailTask: false,
    activeChannel: "default",
    activeTaskStatus: null,
    activeTaskType: null,
    activeTaskAgeMs: null,
  } as const;

  it("returns none when messages already exist", () => {
    expect(
      resolveChatEmptyState({ ...base, messageCount: 3 }),
    ).toBe("none");
  });

  it("returns welcome-email for a new agent with email task on default channel", () => {
    expect(
      resolveChatEmptyState({
        ...base,
        isNewAgent: true,
        hasEmailTask: true,
        activeChannel: "default",
      }),
    ).toBe("welcome-email");
  });

  it("returns welcome-email while an email_notification task is active (not stuck)", () => {
    expect(
      resolveChatEmptyState({
        ...base,
        activeTaskStatus: "dispatched",
        activeTaskType: "email_notification",
        activeTaskAgeMs: 30_000,
      }),
    ).toBe("welcome-email");
  });

  it("returns active-working for a non-email active task that is not stuck", () => {
    expect(
      resolveChatEmptyState({
        ...base,
        activeTaskStatus: "running",
        activeTaskType: "user_dm_message",
        activeTaskAgeMs: 10_000,
      }),
    ).toBe("active-working");
    expect(
      resolveChatEmptyState({
        ...base,
        activeTaskStatus: "queued",
        activeTaskType: "user_dm_message",
        activeTaskAgeMs: 30_000,
      }),
    ).toBe("active-working");
  });

  it("returns active-stuck when queued/dispatched longer than the stuck threshold", () => {
    expect(
      resolveChatEmptyState({
        ...base,
        activeTaskStatus: "dispatched",
        activeTaskType: "user_dm_message",
        activeTaskAgeMs: ACTIVE_TASK_STUCK_AFTER_MS,
      }),
    ).toBe("active-stuck");
    expect(
      resolveChatEmptyState({
        ...base,
        activeTaskStatus: "queued",
        activeTaskType: "email_notification",
        activeTaskAgeMs: ACTIVE_TASK_STUCK_AFTER_MS + 1,
      }),
    ).toBe("active-stuck");
  });

  it("does not mark running tasks as stuck even when old", () => {
    expect(
      resolveChatEmptyState({
        ...base,
        activeTaskStatus: "running",
        activeTaskType: "user_dm_message",
        activeTaskAgeMs: ACTIVE_TASK_STUCK_AFTER_MS * 10,
      }),
    ).toBe("active-working");
  });

  it("returns say-hi for new agent email work on a non-default channel when idle", () => {
    expect(
      resolveChatEmptyState({
        ...base,
        isNewAgent: true,
        hasEmailTask: true,
        activeChannel: "ops",
      }),
    ).toBe("say-hi");
  });

  it("returns say-hi when empty and no welcome/active path", () => {
    expect(resolveChatEmptyState(base)).toBe("say-hi");
  });

  it("does not treat any-active-count as welcome-email for a DM task", () => {
    // hasEmailTask must be typed (email_notification), not "any task count".
    expect(
      resolveChatEmptyState({
        ...base,
        isNewAgent: true,
        hasEmailTask: false,
        activeTaskStatus: "queued",
        activeTaskType: "user_dm_message",
        activeTaskAgeMs: 10_000,
      }),
    ).toBe("active-working");
  });
});

describe("isActiveTaskStuck", () => {
  it("is true only for old queued/dispatched tasks", () => {
    expect(isActiveTaskStuck("running", ACTIVE_TASK_STUCK_AFTER_MS * 10)).toBe(
      false,
    );
    expect(isActiveTaskStuck("queued", 1_000)).toBe(false);
    expect(isActiveTaskStuck("dispatched", ACTIVE_TASK_STUCK_AFTER_MS)).toBe(
      true,
    );
  });
});
