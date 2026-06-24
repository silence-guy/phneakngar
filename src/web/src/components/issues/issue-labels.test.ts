import { describe, expect, it } from "vitest";
import {
  activeTaskCountLabel,
  activeTaskPanelTitle,
  issueAssignedMeta,
  issueEventLabel,
  issueStampLabel,
  issueStatusLabel,
  issueStatusTransitionMeta,
  viewAllTasksLabel,
} from "./issue-labels";

describe("issue labels", () => {
  it("maps stable status ids to Khmer display labels", () => {
    expect(issueStatusLabel("todo")).toBe("ត្រូវធ្វើ");
    expect(issueStatusLabel("in_progress")).toBe("កំពុងដំណើរការ");
    expect(issueStatusLabel("review")).toBe("រង់ចាំពិនិត្យ");
    expect(issueStatusLabel("done")).toBe("រួចរាល់");
    expect(issueStatusLabel("canceled")).toBe("បានបោះបង់");
  });

  it("keeps unknown status fallback readable", () => {
    expect(issueStatusLabel("needs_review")).toBe("Needs Review");
  });

  it("formats issue event display copy in Khmer", () => {
    expect(issueEventLabel("created")).toBe("បានបង្កើតបញ្ហា");
    expect(issueStampLabel("created")).toBe("ថ្មី");
    expect(issueStampLabel("status_changed", "done")).toBe("រួចរាល់");
    expect(issueAssignedMeta("Sophea")).toBe("បានចាត់តាំងទៅ Sophea");
    expect(issueStatusTransitionMeta("todo", "review")).toBe("ត្រូវធ្វើ → រង់ចាំពិនិត្យ");
  });

  it("formats active task display copy in Khmer", () => {
    expect(activeTaskCountLabel(2)).toBe("2 កំពុងសកម្ម");
    expect(activeTaskPanelTitle(2)).toBe("កិច្ចការ 2 កំពុងសកម្ម");
    expect(viewAllTasksLabel(9)).toBe("មើលកិច្ចការ 9 ទាំងអស់");
  });
});
