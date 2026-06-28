import { describe, expect, it } from "vitest";
import { getAgentKey, resolveDashboardAgent, type AgentInfo } from "./demo-dashboard";

const agents: AgentInfo[] = [
  { id: "planner", name: "វិចិត្រ", email: "planner@phneakngar.ai", config: { shape: "hexagon", eye: "dots", nose: "dash", bg: 5 } },
  { id: "coder", name: "ដារ៉ា", email: "coder@phneakngar.ai", config: { shape: "task", eye: "happy", nose: "dot", bg: 0 } },
];

describe("demo dashboard agent resolution", () => {
  it("keeps stable active-agent keys separate from Khmer display names", () => {
    expect(getAgentKey(agents[0]!)).toBe("planner");
    expect(resolveDashboardAgent(agents, "coder")?.name).toBe("ដារ៉ា");
  });

  it("falls back to the first agent when the active key is unknown", () => {
    expect(resolveDashboardAgent(agents, "missing")?.name).toBe("វិចិត្រ");
  });
});
