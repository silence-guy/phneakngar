import { describe, it, expect } from "vitest";
import {
  DEFAULT_JUDGMENT_POLICY,
  applyJudgmentPolicyToRuntimeConfig,
  buildAmbiguousIssueDraft,
  buildJudgmentPolicyContextBlock,
  buildJudgmentPolicyNotice,
  isAmbiguousRequest,
  readJudgmentPolicy,
  resolveAmbiguousDmJudgment,
} from "./judgment-policy";

/** Fixture used by product test case: ambiguous DM without clear owner/outcome. */
const AMBIGUOUS_FIXTURE =
  "Can you look into this? Not sure who owns it or what the right outcome is.";

const CLEAR_FIXTURE =
  "Fix the login bug in auth.ts and open a PR with a regression test.";

describe("readJudgmentPolicy / applyJudgmentPolicyToRuntimeConfig", () => {
  it("defaults to disabled when missing or invalid", () => {
    expect(DEFAULT_JUDGMENT_POLICY).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy(undefined)).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy(null)).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy({})).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy({ model: "x" })).toEqual({ ambiguousToIssue: false });
    // Non-object / non-boolean values must stay opt-in false
    expect(readJudgmentPolicy([])).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy("judgment")).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy({ judgment: true })).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentPolicy({ judgment: { ambiguousToIssue: "true" } })).toEqual({
      ambiguousToIssue: false,
    });
    expect(readJudgmentPolicy({ judgment: { ambiguousToIssue: 1 } })).toEqual({
      ambiguousToIssue: false,
    });
    expect(readJudgmentPolicy({ judgment: { ambiguousToIssue: false } })).toEqual({
      ambiguousToIssue: false,
    });
  });

  it("reads camelCase and snake_case enable flags", () => {
    expect(readJudgmentPolicy({ judgment: { ambiguousToIssue: true } })).toEqual({
      ambiguousToIssue: true,
    });
    expect(readJudgmentPolicy({ judgment: { ambiguous_to_issue: true } })).toEqual({
      ambiguousToIssue: true,
    });
  });

  it("merges judgment into runtime_config without dropping other keys", () => {
    expect(
      applyJudgmentPolicyToRuntimeConfig(
        { model: "opus", custom: 1, judgment: { note: "keep" } },
        { ambiguousToIssue: true },
      ),
    ).toEqual({
      model: "opus",
      custom: 1,
      judgment: { note: "keep", ambiguousToIssue: true },
    });
  });

  it("removes judgment key when disabled and tolerates null base", () => {
    expect(
      applyJudgmentPolicyToRuntimeConfig(
        { model: "opus", judgment: { ambiguousToIssue: true } },
        { ambiguousToIssue: false },
      ),
    ).toEqual({ model: "opus" });
    expect(applyJudgmentPolicyToRuntimeConfig(null, { ambiguousToIssue: true })).toEqual({
      judgment: { ambiguousToIssue: true },
    });
  });
});

describe("isAmbiguousRequest", () => {
  it("flags empty and classic ambiguous fixtures", () => {
    expect(isAmbiguousRequest("")).toBe(true);
    expect(isAmbiguousRequest("   ")).toBe(true);
    expect(isAmbiguousRequest(AMBIGUOUS_FIXTURE)).toBe(true);
    expect(isAmbiguousRequest("help")).toBe(true);
    expect(isAmbiguousRequest("Can you help with this?")).toBe(true);
    expect(isAmbiguousRequest("What should we do?")).toBe(true);
    expect(isAmbiguousRequest("pls look at this")).toBe(true);
    expect(isAmbiguousRequest("idk")).toBe(true);
  });

  it("does not flag concrete deliverables", () => {
    expect(isAmbiguousRequest(CLEAR_FIXTURE)).toBe(false);
    expect(
      isAmbiguousRequest("Send the weekly report email to alice@example.com by 5pm"),
    ).toBe(false);
    expect(isAmbiguousRequest("Schedule a calendar event for Monday 09:00 standup")).toBe(
      false,
    );
    expect(isAmbiguousRequest("Refactor `src/cli/chhlat/prompt.ts` to extract helpers")).toBe(
      false,
    );
    expect(isAmbiguousRequest("Open PR #42 with the auth fix")).toBe(false);
  });
});

describe("resolveAmbiguousDmJudgment", () => {
  it("continues when policy is disabled even if prompt is ambiguous", () => {
    const result = resolveAmbiguousDmJudgment({
      policy: { ambiguousToIssue: false },
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "ag_1",
    });
    expect(result).toEqual({
      action: "continue",
      reason: "judgment policy ambiguousToIssue is disabled",
    });
  });

  it("creates an owned issue draft for ambiguous fixture when policy enabled", () => {
    const result = resolveAmbiguousDmJudgment({
      policy: { ambiguousToIssue: true },
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "ag_owner",
      senderName: "Beacon",
      conversationId: "conv_1",
    });

    expect(result.action).toBe("create_issue");
    if (result.action !== "create_issue") return;

    // Product acceptance: owned issue draft (agent is owner), not freeform chat only.
    expect(result.issue.agent_id).toBe("ag_owner");
    expect(result.issue.title.toLowerCase()).toContain("clarify");
    expect(result.issue.description).toContain(AMBIGUOUS_FIXTURE);
    expect(result.issue.description).toContain("Beacon");
    expect(result.issue.description).toContain("conv_1");
    expect(result.issue.description).toMatch(/ambiguous → create issue/i);
    expect(result.reason).toMatch(/ambiguous/i);
  });

  it("continues for clear requests even when policy enabled", () => {
    const result = resolveAmbiguousDmJudgment({
      runtimeConfig: { judgment: { ambiguousToIssue: true } },
      prompt: CLEAR_FIXTURE,
      agentId: "ag_1",
    });
    expect(result.action).toBe("continue");
    expect(result.reason).toMatch(/clear enough/i);
  });

  it("reads policy from runtimeConfig when policy object omitted", () => {
    const result = resolveAmbiguousDmJudgment({
      runtimeConfig: { judgment: { ambiguousToIssue: true } },
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "ag_x",
    });
    expect(result.action).toBe("create_issue");
  });

  it("prefers explicit policy over runtimeConfig", () => {
    const result = resolveAmbiguousDmJudgment({
      policy: { ambiguousToIssue: false },
      runtimeConfig: { judgment: { ambiguousToIssue: true } },
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "ag_1",
    });
    expect(result.action).toBe("continue");
    expect(result.reason).toMatch(/disabled/i);
  });

  it("continues when agent owner id is missing", () => {
    const result = resolveAmbiguousDmJudgment({
      policy: { ambiguousToIssue: true },
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "   ",
    });
    expect(result).toEqual({
      action: "continue",
      reason: "missing agent id for issue ownership",
    });
  });

  it("defaults to disabled when neither policy nor runtimeConfig provided", () => {
    const result = resolveAmbiguousDmJudgment({
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "ag_1",
    });
    expect(result.action).toBe("continue");
  });
});

describe("buildAmbiguousIssueDraft + prompt helpers", () => {
  it("builds create-issue payload with agent owner", () => {
    const draft = buildAmbiguousIssueDraft({
      prompt: AMBIGUOUS_FIXTURE,
      agentId: "ag_9",
    });
    expect(draft).toEqual({
      agent_id: "ag_9",
      title: expect.stringMatching(/^Clarify:/),
      description: expect.stringContaining(AMBIGUOUS_FIXTURE),
    });
  });

  it("does not double-prefix Clarify titles and clamps long titles", () => {
    const already = buildAmbiguousIssueDraft({
      prompt: "Clarify: who owns billing?",
      agentId: "ag_1",
    });
    expect(already.title).toBe("Clarify: who owns billing?");

    const long = "x".repeat(300);
    const clamped = buildAmbiguousIssueDraft({ prompt: long, agentId: "ag_1" });
    expect(clamped.title.length).toBeLessThanOrEqual(200);
    expect(clamped.title.endsWith("…")).toBe(true);
  });

  it("uses empty-request placeholder and first-line title for multi-line prompts", () => {
    expect(
      buildAmbiguousIssueDraft({ prompt: "   ", agentId: "ag_1" }).title,
    ).toMatch(/Clarify: \(empty request\)/);

    const multi = buildAmbiguousIssueDraft({
      prompt: "Who owns this?\nSecond line details",
      agentId: "ag_1",
    });
    expect(multi.title).toBe("Clarify: Who owns this?");
    expect(multi.description).toContain("Second line details");
  });

  it("returns notice/context only when enabled", () => {
    expect(buildJudgmentPolicyNotice({ ambiguousToIssue: false })).toBeNull();
    expect(buildJudgmentPolicyContextBlock({ ambiguousToIssue: false })).toBeNull();

    const notice = buildJudgmentPolicyNotice({ ambiguousToIssue: true });
    expect(notice).toContain("Judgment policy ENABLED");
    expect(notice).toContain("issue create");
    expect(notice).toContain("send-dm");

    const block = buildJudgmentPolicyContextBlock({ ambiguousToIssue: true }, "npx @phneakngar/cli");
    expect(block).toContain("Judgment policy");
    expect(block).toContain("npx @phneakngar/cli issue create");
    expect(block).toContain("npx @phneakngar/cli sync send-dm");
  });
});
