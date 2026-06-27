import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_LABELS,
} from "./browser-notification";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("browser notification labels", () => {
  it("maps every notification event to a Khmer label", () => {
    for (const event of NOTIFICATION_EVENTS) {
      expect(isKhmer(NOTIFICATION_EVENT_LABELS[event])).toBe(true);
    }
  });
});
