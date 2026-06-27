import { describe, expect, it } from "vitest";
import { HOME_LABELS, homeLayoutLabel } from "./home-labels";

describe("home labels", () => {
  it("provides Khmer canvas and empty-state copy", () => {
    expect(HOME_LABELS.layout).toBe("ប្លង់");
    expect(HOME_LABELS.dragHint).toBe("អូសរវាងចំណុចភ្ជាប់ភ្នាក់ងារ ដើម្បីបង្កើតទំនាក់ទំនង។");
    expect(HOME_LABELS.createNewAgent).toBe("បង្កើតភ្នាក់ងារថ្មី");
    expect(HOME_LABELS.buildYourCompany).toBe("កសាងក្រុមហ៊ុន AI របស់អ្នក");
    expect(HOME_LABELS.getStarted).toBe("ចាប់ផ្តើម");
  });

  it("provides Khmer link error copy", () => {
    expect(HOME_LABELS.linkAlreadyExists).toBe("ការតភ្ជាប់មានរួចហើយ");
    expect(HOME_LABELS.cannotLinkToSelf).toBe("មិនអាចភ្ជាប់ភ្នាក់ងារទៅខ្លួនឯងបានទេ");
    expect(HOME_LABELS.createLinkFailed).toBe("មិនអាចបង្កើតការតភ្ជាប់បានទេ");
  });

  it("maps stable layout ids to Khmer labels", () => {
    expect(homeLayoutLabel("star")).toBe("ផ្កាយ");
    expect(homeLayoutLabel("tree")).toBe("មែកធាង");
    expect(homeLayoutLabel("flow")).toBe("លំហូរ");
  });
});
