import { describe, expect, it } from "vitest";
import {
  EMAIL_SETUP_LABELS,
  EMAIL_SETUP_PROVIDER_COPY,
  emailSetupProviderCopy,
} from "./email-setup-labels";

const KHMER = /[ក-៿]/;

describe("email setup labels", () => {
  it("exposes Khmer heading and subtitle while keeping IMAP/SMTP tokens", () => {
    expect(EMAIL_SETUP_LABELS.heading).toMatch(KHMER);
    expect(EMAIL_SETUP_LABELS.subtitle).toMatch(KHMER);
    expect(EMAIL_SETUP_LABELS.subtitle).toContain("IMAP/SMTP");
    expect(EMAIL_SETUP_LABELS.imap).toBe("IMAP");
    expect(EMAIL_SETUP_LABELS.smtp).toBe("SMTP");
  });

  it("provides Khmer prose for every provider step", () => {
    for (const copy of Object.values(EMAIL_SETUP_PROVIDER_COPY)) {
      expect(copy.steps.length).toBeGreaterThan(0);
      for (const step of copy.steps) {
        expect(step).toMatch(KHMER);
      }
      if (copy.note) {
        expect(copy.note).toMatch(KHMER);
      }
    }
  });

  it("keeps technical tokens and credentials in English", () => {
    const gmail = emailSetupProviderCopy("gmail");
    expect(gmail.steps.some((s) => s.includes("App Password"))).toBe(true);
    expect(gmail.steps.some((s) => s.includes("you@gmail.com"))).toBe(true);
    expect(emailSetupProviderCopy("163").note).toContain("465");
  });
});
