import { describe, expect, it } from "vitest";
import { EMAIL_LABELS } from "./email-labels";

describe("EMAIL_LABELS", () => {
  it("provides Khmer compose labels", () => {
    expect(EMAIL_LABELS.compose.title).toBe("អ៊ីមែលថ្មី");
    expect(EMAIL_LABELS.compose.send).toBe("ផ្ញើ");
    expect(EMAIL_LABELS.compose.fileTooLarge("brief.pdf")).toContain("10 MB");
  });

  it("keeps technical URL placeholder behavior in components", () => {
    expect(EMAIL_LABELS.toolbar.insertLink).toBe("បញ្ចូលតំណ");
    expect(EMAIL_LABELS.toolbar.validUrl).toContain("URL");
  });
});
