import { describe, it, expect } from "vitest";
import {
  AGENT_CHAT_LABELS,
  sayHiLabel,
  agentWellRestedLabel,
  repliesLabel,
  lastReplyLabel,
  viewConversationLabel,
  errorFromLabel,
  napSeparatorLabel,
  deleteChannelConfirmLabel,
} from "./agent-chat-labels";

// Khmer Unicode block: U+1780–U+17FF.
const KHMER = /[ក-៿]/;

describe("AGENT_CHAT_LABELS", () => {
  it("provides Khmer view labels", () => {
    expect(AGENT_CHAT_LABELS.view.failedToLoadConversation).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.quote).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.nap).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.stop).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.dropFilesHere).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.attachFiles).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.send).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.activeWorkingTitle).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.activeStuckTitle).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.openRuntimes).toMatch(KHMER);
  });

  it("keeps the technical clipboard token while wrapping in Khmer", () => {
    expect(AGENT_CHAT_LABELS.view.copiedToClipboard).toContain("clipboard");
    expect(AGENT_CHAT_LABELS.view.copiedToClipboard).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.copiedToClipboard).toContain("clipboard");
  });

  it("translates the Global skill scope consistently in both surfaces", () => {
    expect(AGENT_CHAT_LABELS.view.global).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.slash.global).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.view.global).toBe(AGENT_CHAT_LABELS.slash.global);
  });

  it("provides Khmer message-list action labels", () => {
    expect(AGENT_CHAT_LABELS.messageList.you).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.copy).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.quote).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.replyInThread).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.flag).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.unflag).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.messageList.notDeliveredTapToRetry).toMatch(KHMER);
  });

  it("provides Khmer channel labels", () => {
    expect(AGENT_CHAT_LABELS.channel.addNew).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.channel.rename).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.channel.delete).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.channel.cancel).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.channel.rightClickForOptions).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.channel.namePlaceholder).toMatch(KHMER);
  });

  it("provides Khmer channel participants labels (C8)", () => {
    expect(AGENT_CHAT_LABELS.participants.title).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.participants.empty).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.participants.addAgent).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.participants.agentBadge).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.participants.userBadge).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.participants.remove).toMatch(KHMER);
  });

  it("provides Khmer multi-party DM participants labels", () => {
    expect(AGENT_CHAT_LABELS.dmParticipants.title).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.dmParticipants.subtitle).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.dmParticipants.empty).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.dmParticipants.addAgent).toMatch(KHMER);
  });

  it("provides Khmer artifact + runtime-error labels", () => {
    expect(AGENT_CHAT_LABELS.artifact.title).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.artifact.empty).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.runtimeError.retry).toMatch(KHMER);
    expect(AGENT_CHAT_LABELS.runtimeError.explanation).toMatch(KHMER);
  });
});

describe("agent-chat label helpers", () => {
  it("sayHiLabel interpolates the name and returns Khmer", () => {
    const out = sayHiLabel("Maya");
    expect(out).toContain("Maya");
    expect(out).toMatch(KHMER);
  });

  it("agentWellRestedLabel interpolates the name and returns Khmer", () => {
    const out = agentWellRestedLabel("Luna");
    expect(out).toContain("Luna");
    expect(out).toMatch(KHMER);
  });

  it("repliesLabel returns Khmer with the count", () => {
    expect(repliesLabel(3)).toContain("3");
    expect(repliesLabel(3)).toMatch(KHMER);
    expect(repliesLabel(1)).toMatch(KHMER);
  });

  it("lastReplyLabel returns Khmer with the time string", () => {
    const out = lastReplyLabel("10:30 AM");
    expect(out).toContain("10:30 AM");
    expect(out).toMatch(KHMER);
  });

  it("viewConversationLabel interpolates the name and returns Khmer", () => {
    const out = viewConversationLabel("Priya");
    expect(out).toContain("Priya");
    expect(out).toMatch(KHMER);
  });

  it("errorFromLabel interpolates the provider and returns Khmer", () => {
    const out = errorFromLabel("Claude Code");
    expect(out).toContain("Claude Code");
    expect(out).toMatch(KHMER);
  });

  it("napSeparatorLabel returns Khmer without the emoji (caller appends it)", () => {
    const out = napSeparatorLabel("Luna");
    expect(out).toContain("Luna");
    expect(out).toMatch(KHMER);
    expect(out).not.toContain("💤");
  });

  it("deleteChannelConfirmLabel interpolates the channel name and returns Khmer", () => {
    const out = deleteChannelConfirmLabel("ops");
    expect(out).toContain("ops");
    expect(out).toMatch(KHMER);
  });
});
