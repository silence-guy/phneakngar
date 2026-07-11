import { describe, expect, it } from "vitest";
import { DEVICE_LABELS } from "./device-labels";

const KHMER = /[ក-៿]/;

describe("device labels", () => {
  it("exposes Khmer copy for headings and steps", () => {
    expect(DEVICE_LABELS.heading).toBe("អនុញ្ញាតឧបករណ៍");
    expect(DEVICE_LABELS.verifyCode).toBe("ផ្ទៀងផ្ទាត់លេខកូដ");
    expect(DEVICE_LABELS.approve).toBe("អនុម័ត");
    expect(DEVICE_LABELS.deny).toBe("បដិសេធ");
  });

  it("uses Khmer for loading and success/denied states", () => {
    expect(DEVICE_LABELS.verifying).toMatch(KHMER);
    expect(DEVICE_LABELS.approving).toMatch(KHMER);
    expect(DEVICE_LABELS.deviceAuthorized).toMatch(KHMER);
    expect(DEVICE_LABELS.openDashboard).toMatch(KHMER);
    expect(DEVICE_LABELS.accessDenied).toMatch(KHMER);
  });

  it("provides Khmer error fallbacks", () => {
    for (const message of Object.values(DEVICE_LABELS.errors)) {
      expect(message).toMatch(KHMER);
    }
  });
});
