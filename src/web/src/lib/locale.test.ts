import { describe, expect, it } from "vitest";
import { Locale, defaultLocale } from "@alook/shared";
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
    expect(agentFormLabel("runtime")).toBe("បរិស្ថានដំណើរការ (Runtime)");
    expect(agentFormLabel("nameRequired")).toBe("ត្រូវបញ្ចូលឈ្មោះ");
    expect(agentFormLabel("removeMemberAccess")).toBe("ដកសិទ្ធិសមាជិក");
    expect(agentFormLabel("customEmail")).toBe("អ៊ីមែលផ្ទាល់ខ្លួន");
    expect(agentFormLabel("imapHostRequired")).toBe("ត្រូវបញ្ចូល IMAP host");
  });

  it("keeps English fallbacks for app shell, machine connection, and agent form labels", () => {
    expect(appShellLabel("newAgent", Locale.EN)).toBe("New agent");
    expect(connectMachineLabel("copyCommand", Locale.EN)).toBe("Copy Command");
    expect(agentFormLabel("runtime", Locale.EN)).toBe("Runtime");
    expect(agentFormLabel("nameRequired", Locale.EN)).toBe("Name is required");
    expect(agentFormLabel("removeMemberAccess", Locale.EN)).toBe("Remove Member Access");
    expect(agentFormLabel("customEmail", Locale.EN)).toBe("Custom Email");
    expect(agentFormLabel("imapHostRequired", Locale.EN)).toBe("IMAP host is required");
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
