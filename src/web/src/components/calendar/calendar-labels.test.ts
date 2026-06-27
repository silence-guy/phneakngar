import { describe, expect, it } from "vitest";
import {
  CALENDAR_LABELS,
  calendarViewLabel,
  hiddenEventsLabel,
  hiddenEventsAriaLabel,
  collapsedTodayLabel,
  recurringTitlePrefix,
} from "./calendar-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("calendar labels", () => {
  it("maps stable view ids to Khmer display labels", () => {
    expect(calendarViewLabel("month")).toBe("ខែ");
    expect(calendarViewLabel("week")).toBe("សប្តាហ៍");
    expect(calendarViewLabel("agenda")).toBe("បញ្ជី");
  });

  it("formats hidden and collapsed counts without changing ids", () => {
    expect(hiddenEventsLabel(3)).toBe("+3 ទៀត");
    expect(hiddenEventsAriaLabel(3)).toBe("3 ព្រឹត្តិការណ៍បន្ថែម");
    expect(collapsedTodayLabel(2)).toBe("× 2 ថ្ងៃនេះ");
  });

  it("adds Khmer recurring title prefix only for recurring events", () => {
    expect(recurringTitlePrefix(true)).toBe("កើតឡើងដដែល · ");
    expect(recurringTitlePrefix(false)).toBe("");
  });

  it("localizes calendar page header and toast strings to Khmer", () => {
    expect(isKhmer(CALENDAR_LABELS.page.title)).toBe(true);
    expect(isKhmer(CALENDAR_LABELS.page.subtitle)).toBe(true);
    expect(isKhmer(CALENDAR_LABELS.page.newEvent)).toBe(true);
    expect(isKhmer(CALENDAR_LABELS.page.noEventsForAgents)).toBe(true);
    for (const toast of Object.values(CALENDAR_LABELS.toast)) {
      expect(isKhmer(toast)).toBe(true);
    }
  });
});
