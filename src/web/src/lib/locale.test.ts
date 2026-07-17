import { describe, expect, it } from "vitest";
import { Locale, defaultLocale } from "@phneakngar/shared";
import {
  DEFAULT_WEB_LOCALE,
  agentFormLabel,
  appShellLabel,
  connectMachineLabel,
  formatAgentCount,
  issueStatusLabel,
  localeDisplayName,
  navigationLabel,
  onboardingLabel,
  resolveWebLocale,
  taskStatusLabel,
  taskTypeLabel,
} from "./locale";

describe("web locale helpers", () => {
  it("defaults the web UI to the shared Khmer locale", () => {
    expect(DEFAULT_WEB_LOCALE).toBe(defaultLocale);
    expect(resolveWebLocale(undefined)).toBe(Locale.KM);
    expect(resolveWebLocale("en")).toBe(Locale.EN);
    expect(resolveWebLocale("km-KH")).toBe(Locale.KM);
  });

  it("returns Khmer navigation and onboarding labels by default", () => {
    expect(navigationLabel("agents")).toBe("ភ្នាក់ងារ");
    expect(navigationLabel("inbox")).toBe("ប្រអប់សារ");
    expect(onboardingLabel("browseTemplates")).toBe("មើលគំរូ");
    expect(onboardingLabel("companyCreated")).toBe("បានបង្កើតក្រុមហ៊ុនរួចហើយ!");
  });

  it("keeps English fallback labels available", () => {
    expect(navigationLabel("agents", Locale.EN)).toBe("Agents");
    expect(onboardingLabel("focusQuestion", Locale.EN)).toBe("What will your company focus on?");
    expect(localeDisplayName(Locale.KM, Locale.EN)).toBe("Khmer");
  });

  it("returns Khmer app shell, machine connection, and agent form labels by default", () => {
    expect(appShellLabel("newAgent")).toBe("ភ្នាក់ងារថ្មី");
    expect(appShellLabel("switchWorkspace")).toBe("ប្តូរកន្លែងធ្វើការ");
    expect(connectMachineLabel("copyCommand")).toBe("ចម្លងពាក្យបញ្ជា");
    expect(connectMachineLabel("nextStepsTitle")).toBe("ជំហានបន្ទាប់");
    expect(connectMachineLabel("agentWorkdirNote")).toContain("sandboxed");
    expect(agentFormLabel("runtime")).toBe("បរិស្ថានដំណើរការ (Runtime)");
    expect(agentFormLabel("nameRequired")).toBe("ត្រូវបញ្ចូលឈ្មោះ");
    expect(agentFormLabel("removeMemberAccess")).toBe("ដកសិទ្ធិសមាជិក");
    expect(agentFormLabel("customEmail")).toBe("អ៊ីមែលផ្ទាល់ខ្លួន");
    expect(agentFormLabel("imapHostRequired")).toBe("ត្រូវបញ្ចូល IMAP host");
    expect(agentFormLabel("roleTitle")).toBe("តួនាទីសហការី");
    expect(agentFormLabel("responsibility")).toBe("ការទទួលខុសត្រូវ");
    expect(agentFormLabel("mcpTools")).toBe("ឧបករណ៍ MCP");
    expect(agentFormLabel("mcpToolsHint")).toContain("wire-mcp");
    expect(agentFormLabel("mcpToolsHint")).toMatch(/web-brain|runtime\/config/i);
    expect(agentFormLabel("ambiguousToIssue")).toContain("issue");
    expect(agentFormLabel("ambiguousToIssueHint")).toMatch(/issue|DM/i);
  });

  it("keeps English fallbacks for app shell, machine connection, and agent form labels", () => {
    expect(appShellLabel("newAgent", Locale.EN)).toBe("New agent");
    expect(connectMachineLabel("copyCommand", Locale.EN)).toBe("Copy Command");
    expect(connectMachineLabel("nextStepsTitle", Locale.EN)).toBe("Next steps");
    expect(connectMachineLabel("nextStepRegisterTerminal", Locale.EN)).toContain("register");
    expect(connectMachineLabel("nextStepChhlat", Locale.EN)).toContain("chhlat start");
    expect(connectMachineLabel("agentWorkdirNote", Locale.EN)).toMatch(
      /sandboxed agent workspace|not your entire filesystem/i,
    );
    expect(connectMachineLabel("terminalDescription", Locale.EN)).not.toMatch(
      /entire (PC|computer|filesystem)|full (PC|disk|root)/i,
    );
    expect(connectMachineLabel("generateRegisterCommand", Locale.EN)).toMatch(/Generate register/i);
    expect(connectMachineLabel("optionalConnectDescription", Locale.EN)).toMatch(/optional|web access/i);
    expect(agentFormLabel("runtime", Locale.EN)).toBe("Runtime");
    expect(agentFormLabel("nameRequired", Locale.EN)).toBe("Name is required");
    expect(agentFormLabel("removeMemberAccess", Locale.EN)).toBe("Remove Member Access");
    expect(agentFormLabel("customEmail", Locale.EN)).toBe("Custom Email");
    expect(agentFormLabel("imapHostRequired", Locale.EN)).toBe("IMAP host is required");
    expect(agentFormLabel("roleTitle", Locale.EN)).toBe("Teammate role");
    expect(agentFormLabel("responsibility", Locale.EN)).toBe("Responsibility");
    expect(agentFormLabel("mcpTools", Locale.EN)).toBe("MCP tools");
    expect(agentFormLabel("mcpToolsHint", Locale.EN)).toMatch(/wire-mcp/i);
    expect(agentFormLabel("mcpToolsHint", Locale.EN)).toMatch(
      /web-brain|search|fetch|runtime/i,
    );
    expect(agentFormLabel("ambiguousToIssue", Locale.EN)).toBe("Ambiguous DMs → issue");
    expect(agentFormLabel("ambiguousToIssueHint", Locale.EN)).toMatch(/owned issue/i);
  });

  it("formats agent counts without changing the stable entity concept", () => {
    expect(formatAgentCount(1)).toBe("1 ភ្នាក់ងារ");
    expect(formatAgentCount(2)).toBe("2 ភ្នាក់ងារ");
    expect(formatAgentCount(1, Locale.EN)).toBe("1 agent");
    expect(formatAgentCount(2, Locale.EN)).toBe("2 agents");
  });

  it("uses shared stable status and task labels", () => {
    expect(issueStatusLabel("in_progress")).toBe("កំពុងដំណើរការ");
    expect(issueStatusLabel("review")).toBe("រង់ចាំពិនិត្យ");
    expect(taskStatusLabel("running")).toBe("កំពុងដំណើរការ");
    expect(taskTypeLabel("email_notification")).toBe("ការជូនដំណឹងអ៊ីមែល");
  });
});
