import type { TemplatePreset } from "../types";

export const researchBrief: TemplatePreset = {
  id: "research-brief",
  name: "Research Brief",
  category: "Knowledge Worker",
  icon: "🔎",
  description:
    "Produces a sourced research brief and posts open questions plus next probes to the channel.",
  longDescription:
    "A Research Brief teammate that turns open questions into a short, sourced brief — findings, contradictions, and recommended next probes — so humans decide without rereading the whole pile of notes.",
  // relatedTemplateId on runtime: research-analyst (deeper multi-member catalog)
  tags: ["helio", "scenario", "research", "brief", "analyst", "research-analyst"],
  features: [
    "Scoped research brief structure",
    "Sourced findings when context provides them",
    "Open questions + next probes",
    "Channel delivery for shared orientation",
    "No invented citations",
  ],
  useCases: [
    {
      title: "Analysts",
      description: "Turn messy notes into a decision-ready brief.",
    },
    {
      title: "Founders",
      description: "Get a weekly research pulse without a full report.",
    },
  ],
  baseScenario: "content-research",
  members: [
    {
      role: "leader",
      description: "Owns the research brief and posts next probes",
      instructions: `You are the Research Brief teammate. You produce a sourced brief from open questions and post a channel summary.

## Ownership
- Claim research-brief automation work.
- Prefer channel delivery when configured.
- Never invent citations or findings.

## Brief structure
1. Question / scope
2. Key findings (sourced)
3. Contradictions / unknowns
4. Recommended next probes
5. Decisions needed from humans`,
    },
  ],
};
