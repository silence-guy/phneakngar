import { describe, expect, it } from "vitest";
import { Locale } from "@alook/shared";
import {
  hasAgentCreateFieldErrors,
  validateAgentCreateRequiredFields,
} from "./agent-create-form-validation";

describe("validateAgentCreateRequiredFields", () => {
  it("requires a non-empty name", () => {
    const errors = validateAgentCreateRequiredFields({
      name: "   ",
      runtimeId: "rt_1",
    });

    expect(errors).toEqual({ name: "ត្រូវបញ្ចូលឈ្មោះ" });
    expect(hasAgentCreateFieldErrors(errors)).toBe(true);
  });

  it("requires a runtime", () => {
    const errors = validateAgentCreateRequiredFields({
      name: "Maddox",
      runtimeId: "",
    });

    expect(errors).toEqual({ runtimeId: "ជ្រើសរើស Runtime ដែល online" });
    expect(hasAgentCreateFieldErrors(errors)).toBe(true);
  });

  it("keeps English fallback validation messages available", () => {
    const errors = validateAgentCreateRequiredFields(
      {
        name: "   ",
        runtimeId: "",
      },
      Locale.EN,
    );

    expect(errors).toEqual({
      name: "Name is required",
      runtimeId: "Select an online runtime",
    });
    expect(hasAgentCreateFieldErrors(errors)).toBe(true);
  });

  it("passes when required fields are present", () => {
    const errors = validateAgentCreateRequiredFields({
      name: "Maddox",
      runtimeId: "rt_1",
    });

    expect(errors).toEqual({});
    expect(hasAgentCreateFieldErrors(errors)).toBe(false);
  });
});
