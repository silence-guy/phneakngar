import { describe, expect, it } from "vitest";
import {
  AgentStatus,
  IssueStatus,
  MeetingStatus,
  MessageRole,
  RuntimeStatus,
  TASK_TYPES,
  TaskStatus,
} from "./constants";
import { cliCommand, chhlatCommand, updateCommand } from "./mode";
import {
  AgentLanguageMode,
  Locale,
  SUPPORTED_AGENT_LANGUAGE_MODES,
  SUPPORTED_LOCALES,
  agentStatusLabels,
  buildAgentPromptLanguagePolicy,
  coreEntityLabels,
  defaultLocale,
  getLocalizedLabel,
  isSupportedAgentLanguageMode,
  isSupportedLocale,
  issueStatusLabels,
  localeDisplayLabels,
  localeTechnicalTokenPolicy,
  meetingStatusLabels,
  messageRoleLabels,
  resolveAgentLanguageMode,
  resolveAgentLanguagePolicy,
  resolveLocale,
  runtimeStatusLabels,
  taskStatusLabels,
  taskTypeLabels,
} from "./locale";

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function expectKeysToMatchValues(
  labels: Record<string, unknown>,
  stableValues: Record<string, string>,
): void {
  expect(sorted(Object.keys(labels))).toEqual(sorted(Object.values(stableValues)));
}

describe("locale foundation", () => {
  it("defines Khmer-first locale constants", () => {
    expect(Locale.EN).toBe("en");
    expect(Locale.KM).toBe("km");
    expect(defaultLocale).toBe(Locale.KM);
    expect(SUPPORTED_LOCALES).toEqual([Locale.KM, Locale.EN]);
  });

  it("resolves unsupported locales to the Khmer default", () => {
    expect(isSupportedLocale("km")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
    expect(resolveLocale(null)).toBe(Locale.KM);
    expect(resolveLocale("fr")).toBe(Locale.KM);
    expect(resolveLocale("km-KH")).toBe(Locale.KM);
  });

  it("resolves agent language mode from stable modes and locale-like input", () => {
    expect(SUPPORTED_AGENT_LANGUAGE_MODES).toEqual([
      AgentLanguageMode.KM,
      AgentLanguageMode.EN,
      AgentLanguageMode.BILINGUAL,
      AgentLanguageMode.AUTO,
    ]);
    expect(isSupportedAgentLanguageMode("bilingual")).toBe(true);
    expect(resolveAgentLanguageMode("en-US")).toBe(AgentLanguageMode.EN);
    expect(resolveAgentLanguageMode("km-KH")).toBe(AgentLanguageMode.KM);
    expect(resolveAgentLanguageMode("fr")).toBe(AgentLanguageMode.KM);
  });

  it("resolves agent language policy with persisted precedence", () => {
    expect(resolveAgentLanguagePolicy({ userLocale: "en" })).toMatchObject({
      mode: AgentLanguageMode.EN,
      defaultUserFacingLanguage: "en",
    });
    expect(resolveAgentLanguagePolicy({ workspaceDefaultLocale: "en", userLocale: "km" })).toMatchObject({
      mode: AgentLanguageMode.EN,
      defaultUserFacingLanguage: "en",
    });
    expect(resolveAgentLanguagePolicy({
      agentPreferredLocale: "bilingual",
      workspaceAgentOutputLocale: "en",
    })).toMatchObject({
      mode: AgentLanguageMode.BILINGUAL,
      defaultUserFacingLanguage: "bilingual",
    });
    expect(resolveAgentLanguagePolicy({
      taskLocaleOverride: "auto",
      agentPreferredLocale: "km",
      agentLanguagePolicy: "Use Khmer legal terminology when possible.",
    })).toEqual({
      mode: AgentLanguageMode.AUTO,
      defaultUserFacingLanguage: "auto",
      customPolicy: "Use Khmer legal terminology when possible.",
    });
  });

  it("builds prompt language policy while preserving technical tokens", () => {
    const policy = buildAgentPromptLanguagePolicy({ agentPreferredLocale: "bilingual" });
    expect(policy.default_user_facing_language).toBe("bilingual");
    expect(policy.apply_to).toContain("User-facing");
    expect(policy.guidance).toContain("Use Khmer first");
    expect(policy.preserve_english_for.join("\n")).toContain("phneakngar sync send-dm");
    expect(policy.preserve_english_for.join("\n")).toContain("JSON keys");
    expect(policy.preserve_english_for.join("\n")).toContain("in_progress");
    expect(policy.preserve_english_for.join("\n")).toContain("file paths");
    expect(policy.preserve_english_for.join("\n")).toContain("logs");
  });

  it("returns Khmer labels by default with English available", () => {
    expect(getLocalizedLabel(coreEntityLabels.agent)).toBe("ភ្នាក់ងារ");
    expect(getLocalizedLabel(coreEntityLabels.agent, Locale.EN)).toBe("Agent");
    expect(localeDisplayLabels[Locale.KM][Locale.KM]).toBe("ខ្មែរ");
    expect(localeDisplayLabels[Locale.EN][Locale.EN]).toBe("English");
  });

  it("covers core entities with Khmer and English labels", () => {
    const entityKeys = Object.keys(coreEntityLabels);

    expect(entityKeys).toEqual([
      "user",
      "workspace",
      "agent",
      "teammate",
      "runtime",
      "memory",
      "automation",
      "approval",
      "routine",
      "template",
      "owner",
      "conversation",
      "message",
      "task",
      "email",
      "inbox",
      "calendar",
      "calendarEvent",
      "issue",
      "issueComment",
      "channel",
      "artifact",
      "machine",
      "machineToken",
      "meeting",
      "agentLink",
      "workspaceFile",
    ]);

    expect(coreEntityLabels.teammate[Locale.EN]).toBe("Teammate");
    expect(coreEntityLabels.teammate[Locale.KM]).toBe("មិត្តរួមការងារ");
    expect(coreEntityLabels.automation[Locale.EN]).toBe("Automation");
    expect(coreEntityLabels.approval[Locale.EN]).toBe("Approval");
    expect(coreEntityLabels.routine[Locale.EN]).toBe("Routine");
    expect(coreEntityLabels.memory[Locale.KM]).toBe("សតិចងចាំ");
    expect(coreEntityLabels.template[Locale.KM]).toBe("គំរូ");
    expect(coreEntityLabels.inbox[Locale.KM]).toBe("ប្រអប់សារ");
    expect(issueStatusLabels.blocked[Locale.EN]).toBe("Blocked");
    expect(issueStatusLabels.blocked[Locale.KM]).toBe("ជាប់គាំង");

    for (const labels of Object.values(coreEntityLabels)) {
      expect(labels[Locale.KM]).not.toBe("");
      expect(labels[Locale.EN]).not.toBe("");
    }
  });

  it("keys status and type display labels by stable values", () => {
    expectKeysToMatchValues(agentStatusLabels, AgentStatus);
    expectKeysToMatchValues(runtimeStatusLabels, RuntimeStatus);
    expectKeysToMatchValues(taskStatusLabels, TaskStatus);
    expectKeysToMatchValues(taskTypeLabels, TASK_TYPES);
    expectKeysToMatchValues(issueStatusLabels, IssueStatus);
    expectKeysToMatchValues(messageRoleLabels, MessageRole);
    expectKeysToMatchValues(meetingStatusLabels, MeetingStatus);
  });

  it("keeps technical tokens and command strings in English", () => {
    expect(localeTechnicalTokenPolicy.defaultContentLocale).toBe(Locale.KM);
    expect(localeTechnicalTokenPolicy.preserve).toContain("CLI command strings");
    expect(localeTechnicalTokenPolicy.preserve).toContain("API status values");
    expect(localeTechnicalTokenPolicy.preserve).toContain("task type values");
    expect(localeTechnicalTokenPolicy.preserve).toContain("logs");

    expect(cliCommand("production")).toBe("npx @phneakngar/cli");
    expect(cliCommand("dev")).toBe("pnpm dev:cli");
    expect(chhlatCommand("dev")).toBe("pnpm dev:cli chhlat start --foreground");
    expect(updateCommand("app")).toBe(
      "npx @phneakngar/app stop && npx @phneakngar/app@latest update && npx @phneakngar/app start",
    );
  });
});
