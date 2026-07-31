import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { DEVICE_LABELS, getDeviceLabels } from "./device-labels";

const KHMER = /[ក-៿]/;

function flatten(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      out.push(value);
    } else if (value && typeof value === "object") {
      out.push(...flatten(value as Record<string, unknown>));
    }
  }
  return out;
}

describe("device labels", () => {
  it("provides matching en/km label groups with no empty strings", () => {
    const en = flatten(DEVICE_LABELS[Locale.EN] as unknown as Record<string, unknown>);
    const km = flatten(DEVICE_LABELS[Locale.KM] as unknown as Record<string, unknown>);

    expect(en.length).toBeGreaterThan(0);
    expect(en.length).toBe(km.length);
    for (const value of [...en, ...km]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(km.some((s) => /[\uFFFD]/.test(s))).toBe(false);
  });

  it("exposes Khmer copy for headings and steps by default", () => {
    const labels = getDeviceLabels();
    expect(labels.heading).toBe("អនុញ្ញាតឧបករណ៍");
    expect(labels.verifyCode).toBe("ផ្ទៀងផ្ទាត់លេខកូដ");
    expect(labels.approve).toBe("អនុម័ត");
    expect(labels.deny).toBe("បដិសេធ");
  });

  it("uses Khmer for loading and success/denied states", () => {
    const labels = getDeviceLabels();
    expect(labels.verifying).toMatch(KHMER);
    expect(labels.approving).toMatch(KHMER);
    expect(labels.deviceAuthorized).toMatch(KHMER);
    expect(labels.openDashboard).toMatch(KHMER);
    expect(labels.accessDenied).toMatch(KHMER);
  });

  it("provides Khmer error fallbacks", () => {
    for (const message of Object.values(getDeviceLabels().errors)) {
      expect(message).toMatch(KHMER);
    }
  });

  it("returns English copy for the en locale", () => {
    const labels = getDeviceLabels(Locale.EN);
    expect(labels.heading).toBe("Authorize device");
    expect(labels.verifyCode).toBe("Verify code");
    expect(labels.approve).toBe("Approve");
    expect(labels.deny).toBe("Deny");
    expect(labels.errors.invalidOrExpired).toBe("Invalid or expired code");
  });
});
