import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import {
  SIGN_IN_LABELS,
  getSignInLabels,
  showImageAriaLabel,
  tooManyRequestsLabel,
  waitSecondsLabel,
} from "./sign-in-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

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

describe("sign-in labels", () => {
  it("provides matching en/km label groups with no empty strings", () => {
    const en = flatten(SIGN_IN_LABELS[Locale.EN] as unknown as Record<string, unknown>);
    const km = flatten(SIGN_IN_LABELS[Locale.KM] as unknown as Record<string, unknown>);

    expect(en.length).toBeGreaterThan(0);
    expect(en.length).toBe(km.length);
    for (const value of [...en, ...km]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(en.some((s) => /[\uFFFD]/.test(s))).toBe(false);
    expect(km.some((s) => /[\uFFFD]/.test(s))).toBe(false);
  });

  it("localizes headings, prompts, fields and actions to Khmer by default", () => {
    const labels = getSignInLabels();
    expect(isKhmer(labels.title)).toBe(true);
    expect(isKhmer(labels.subtitle)).toBe(true);
    expect(isKhmer(labels.prompt.enterEmail)).toBe(true);
    expect(isKhmer(labels.prompt.enterCode)).toBe(true);
    expect(isKhmer(labels.field.email)).toBe(true);
    expect(isKhmer(labels.sentCodeToPrefix)).toBe(true);
    for (const action of Object.values(labels.action)) {
      expect(isKhmer(action)).toBe(true);
    }
  });

  it("localizes error fallbacks to Khmer by default", () => {
    for (const message of Object.values(getSignInLabels().error)) {
      expect(isKhmer(message)).toBe(true);
    }
  });

  it("localizes gallery captions to Khmer by default", () => {
    for (const caption of Object.values(getSignInLabels().gallery)) {
      expect(isKhmer(caption)).toBe(true);
    }
  });

  it("localizes own-brand surface copy to Khmer by default", () => {
    for (const label of Object.values(getSignInLabels().surface)) {
      expect(isKhmer(label)).toBe(true);
    }
  });

  it("returns English labels for the en locale", () => {
    const labels = getSignInLabels(Locale.EN);
    expect(labels.title).toBe("Sign in");
    expect(labels.subtitle).toBe("or create an account to get started");
    expect(labels.action.signIn).toBe("Sign in");
    expect(labels.gallery.calendar).toBe("Calendar");
  });

  it("formats counts and aria helpers per locale without dropping values", () => {
    expect(waitSecondsLabel(30)).toContain("30");
    expect(isKhmer(waitSecondsLabel(30))).toBe(true);
    expect(waitSecondsLabel(30, Locale.EN)).toBe("Wait 30 seconds");

    expect(tooManyRequestsLabel(15)).toContain("15");
    expect(isKhmer(tooManyRequestsLabel(15))).toBe(true);
    expect(tooManyRequestsLabel(15, Locale.EN)).toContain("15");
    expect(tooManyRequestsLabel(15, Locale.EN)).toContain("try again");

    const kmCalendar = getSignInLabels().gallery.calendar;
    expect(showImageAriaLabel(kmCalendar)).toContain(kmCalendar);
    expect(isKhmer(showImageAriaLabel(kmCalendar))).toBe(true);
    expect(showImageAriaLabel("Calendar", Locale.EN)).toBe("Show Calendar");
  });
});
