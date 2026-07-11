import { describe, expect, it } from "vitest";
import {
  WELCOME_EMAIL_SUBJECT_AGENT,
  WELCOME_EMAIL_SUBJECT_STUDIO,
  WELCOME_EMAIL_SUBJECT_WHITELIST,
  WELCOME_USER_FACING_KHMER_RULE,
  buildAgentWelcomeEmailPrompt,
  buildStudioWelcomeChatPrompt,
  buildStudioWelcomeEmailPrompt,
  buildWhitelistWelcomeEmailPrompt,
} from "./welcome-prompts";

describe("welcome prompts", () => {
  it("forces Khmer for studio welcome chat and never matches owner language", () => {
    const prompt = buildStudioWelcomeChatPrompt({
      ownerEmail: "owner@example.com",
      leaderName: "ចន្ត្រា",
      teammatesList: "- ពិសិដ្ឋ (piseth@cieee.xyz), role: researcher",
    });
    expect(prompt).toContain(WELCOME_USER_FACING_KHMER_RULE);
    expect(prompt).toContain("natural Khmer");
    expect(prompt).not.toMatch(/same language as your owner/i);
    expect(prompt).not.toMatch(/owner's name or email suggests/i);
  });

  it("forces exact Khmer studio welcome email subject", () => {
    const prompt = buildStudioWelcomeEmailPrompt({
      ownerEmail: "owner@example.com",
      leaderName: "ចន្ត្រា",
      teammatesList: "- សុខា, role: assistant",
    });
    expect(prompt).toContain(WELCOME_USER_FACING_KHMER_RULE);
    expect(prompt).toContain(WELCOME_EMAIL_SUBJECT_STUDIO);
    expect(prompt).toContain("EMAIL SUBJECT (MANDATORY)");
    expect(prompt).toContain("no asterisks");
  });

  it("forces exact Khmer subjects for agent and whitelist welcomes", () => {
    const agentPrompt = buildAgentWelcomeEmailPrompt({
      ownerEmail: "o@x.com",
      agentName: "Bot",
    });
    expect(agentPrompt).toContain(WELCOME_EMAIL_SUBJECT_AGENT);
    expect(agentPrompt).toContain(WELCOME_USER_FACING_KHMER_RULE);

    const whitelistPrompt = buildWhitelistWelcomeEmailPrompt({
      ownerEmail: "o@x.com",
      agentName: "Bot",
      contactEmail: "c@x.com",
    });
    expect(whitelistPrompt).toContain(WELCOME_EMAIL_SUBJECT_WHITELIST);
    expect(whitelistPrompt).toContain(WELCOME_USER_FACING_KHMER_RULE);
  });
});
