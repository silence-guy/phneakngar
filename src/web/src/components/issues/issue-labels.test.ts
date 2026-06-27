import { describe, expect, it } from "vitest";
import {
  ISSUE_LABELS,
  activeTaskCountLabel,
  activeTaskPanelTitle,
  issueAssignedMeta,
  issueColumnLabel,
  issueEventLabel,
  issueStampLabel,
  issueStatusLabel,
  issueStatusTransitionMeta,
  showCompletedCountLabel,
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

  it("maps board column ids to Khmer labels", () => {
    expect(issueColumnLabel("todo")).toBe("ត្រូវធ្វើ");
    expect(issueColumnLabel("in_progress")).toBe("កំពុងដំណើរការ");
    expect(issueColumnLabel("review")).toBe("ពិនិត្យ");
    expect(issueColumnLabel("completed")).toBe("រួចរាល់");
  });

  it("keeps unknown column fallback readable", () => {
    expect(issueColumnLabel("backlog")).toBe("Backlog");
  });

  it("provides Khmer board copy and counts", () => {
    expect(ISSUE_LABELS.issuesHeading).toBe("បញ្ហា");
    expect(ISSUE_LABELS.noIssues).toBe("គ្មានបញ្ហា");
    expect(ISSUE_LABELS.empty).toBe("ទទេ");
    expect(ISSUE_LABELS.createIssueFailed).toBe("មិនអាចបង្កើតបញ្ហាបានទេ");
    expect(showCompletedCountLabel(4)).toBe("បង្ហាញការងាររួចរាល់ (4)");
  });
});
