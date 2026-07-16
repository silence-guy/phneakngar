import { describe, expect, it } from "vitest";
import { buildRuntimeConfigWithHeadroom } from "./headroom-runtime-settings";
import {
  buildRuntimeConfigWithJudgment,
  readJudgmentSettings,
} from "./judgment-policy-settings";

describe("judgment policy agent settings helpers", () => {
  it("reads persisted judgment settings (camel + snake)", () => {
    expect(
      readJudgmentSettings({
        model: "claude",
        judgment: { ambiguousToIssue: true },
      }),
    ).toEqual({ ambiguousToIssue: true });
    expect(
      readJudgmentSettings({
        judgment: { ambiguous_to_issue: true },
      }),
    ).toEqual({ ambiguousToIssue: true });
    expect(readJudgmentSettings(undefined)).toEqual({ ambiguousToIssue: false });
    expect(readJudgmentSettings({})).toEqual({ ambiguousToIssue: false });
  });

  it("preserves other runtime_config keys when enabling judgment", () => {
    expect(
      buildRuntimeConfigWithJudgment(
        { model: "opus", headroom: { enabled: true }, custom: 1 },
        { ambiguousToIssue: true },
      ),
    ).toEqual({
      model: "opus",
      headroom: { enabled: true },
      custom: 1,
      judgment: { ambiguousToIssue: true },
    });
  });

  it("removes judgment when disabled", () => {
    expect(
      buildRuntimeConfigWithJudgment(
        { model: "opus", judgment: { ambiguousToIssue: true } },
        { ambiguousToIssue: false },
      ),
    ).toEqual({ model: "opus" });
  });

  it("composes with headroom builder without dropping either setting", () => {
    // Mirrors agent-edit-form save path: headroom first, then judgment.
    const composed = buildRuntimeConfigWithJudgment(
      buildRuntimeConfigWithHeadroom(
        { model: "old", judgment: { ambiguousToIssue: true }, custom: 7 },
        "opus",
        { enabled: true, requireOptimization: false, outputShaper: true },
      ),
      { ambiguousToIssue: true },
    );

    expect(composed.model).toBe("opus");
    expect(composed.custom).toBe(7);
    expect(composed.headroom).toMatchObject({
      enabled: true,
      outputShaper: true,
    });
    expect(composed.judgment).toEqual({ ambiguousToIssue: true });
  });

  it("can disable judgment while keeping headroom after compose", () => {
    const composed = buildRuntimeConfigWithJudgment(
      buildRuntimeConfigWithHeadroom(
        { judgment: { ambiguousToIssue: true } },
        "opus",
        { enabled: true, requireOptimization: true, outputShaper: false },
      ),
      { ambiguousToIssue: false },
    );
    expect(composed.model).toBe("opus");
    expect(composed.headroom).toMatchObject({ enabled: true, requireOptimization: true });
    expect(composed.judgment).toBeUndefined();
  });
});
