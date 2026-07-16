import { describe, expect, it } from "vitest";
import { stripSecretFields } from "./agent-integrations-panel";

describe("stripSecretFields", () => {
  it("keeps public fields and drops secret_ref/secretRef", () => {
    const row = {
      id: "int_1",
      workspace_id: "ws1",
      agent_id: "ag1",
      provider: "github",
      status: "active",
      config: { org: "acme" },
      has_secret: true,
      created_at: "2026-07-16T00:00:00.000Z",
      updated_at: "2026-07-16T00:00:00.000Z",
      secret_ref: "must-not-leak",
      secretRef: "also-must-not-leak",
    };
    const pub = stripSecretFields(row);
    expect(pub).toEqual({
      id: "int_1",
      workspace_id: "ws1",
      agent_id: "ag1",
      provider: "github",
      status: "active",
      config: { org: "acme" },
      has_secret: true,
      created_at: "2026-07-16T00:00:00.000Z",
      updated_at: "2026-07-16T00:00:00.000Z",
    });
    expect(pub).not.toHaveProperty("secret_ref");
    expect(pub).not.toHaveProperty("secretRef");
  });
});
