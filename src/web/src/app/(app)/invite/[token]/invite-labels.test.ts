import { describe, expect, it } from "vitest";
import { INVITE_LABELS, invitedByLabel, joinedWorkspaceLabel } from "./invite-labels";

const KHMER = /[ក-៿]/;

describe("invite labels", () => {
  it("exposes Khmer copy for static chrome", () => {
    expect(INVITE_LABELS.invited).toBe("អ្នកត្រូវបានអញ្ជើញ");
    expect(INVITE_LABELS.joinWorkspace).toBe("ចូលរួមកន្លែងធ្វើការ");
    expect(INVITE_LABELS.workspace).toMatch(KHMER);
    expect(INVITE_LABELS.inviteUnavailable).toMatch(KHMER);
    expect(INVITE_LABELS.goToWorkspaces).toMatch(KHMER);
  });

  it("provides Khmer error fallbacks", () => {
    for (const message of Object.values(INVITE_LABELS.errors)) {
      expect(message).toMatch(KHMER);
    }
  });

  it("interpolates dynamic values while keeping static parts Khmer", () => {
    expect(invitedByLabel("Sok")).toBe("Sok បានអញ្ជើញអ្នកឱ្យចូលរួម");
    expect(joinedWorkspaceLabel("Acme")).toBe("បានចូលរួម Acme");
    expect(invitedByLabel("Sok")).toMatch(KHMER);
    expect(joinedWorkspaceLabel("Acme")).toMatch(KHMER);
  });
});
