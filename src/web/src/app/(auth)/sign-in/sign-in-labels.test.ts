import { describe, expect, it } from "vitest";
import {
  SIGN_IN_LABELS,
  showImageAriaLabel,
  tooManyRequestsLabel,
  waitSecondsLabel,
} from "./sign-in-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("sign-in labels", () => {
  it("localizes headings, prompts, fields and actions to Khmer", () => {
    expect(isKhmer(SIGN_IN_LABELS.title)).toBe(true);
    expect(isKhmer(SIGN_IN_LABELS.subtitle)).toBe(true);
    expect(isKhmer(SIGN_IN_LABELS.prompt.enterEmail)).toBe(true);
    expect(isKhmer(SIGN_IN_LABELS.prompt.enterCode)).toBe(true);
    expect(isKhmer(SIGN_IN_LABELS.field.email)).toBe(true);
    expect(isKhmer(SIGN_IN_LABELS.sentCodeToPrefix)).toBe(true);
    for (const action of Object.values(SIGN_IN_LABELS.action)) {
      expect(isKhmer(action)).toBe(true);
    }
  });

  it("localizes error fallbacks to Khmer", () => {
    for (const message of Object.values(SIGN_IN_LABELS.error)) {
      expect(isKhmer(message)).toBe(true);
    }
  });

  it("localizes gallery captions to Khmer", () => {
    for (const caption of Object.values(SIGN_IN_LABELS.gallery)) {
      expect(isKhmer(caption)).toBe(true);
    }
  });

  it("formats counts and aria helpers in Khmer without dropping values", () => {
    expect(waitSecondsLabel(30)).toContain("30");
    expect(isKhmer(waitSecondsLabel(30))).toBe(true);
    expect(tooManyRequestsLabel(15)).toContain("15");
    expect(isKhmer(tooManyRequestsLabel(15))).toBe(true);
    expect(showImageAriaLabel(SIGN_IN_LABELS.gallery.calendar)).toContain(
      SIGN_IN_LABELS.gallery.calendar,
    );
    expect(isKhmer(showImageAriaLabel(SIGN_IN_LABELS.gallery.calendar))).toBe(true);
  });
});
