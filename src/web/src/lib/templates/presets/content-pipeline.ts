import type { TemplatePreset } from "../types";

export const contentPipeline: TemplatePreset = {
  id: "content-pipeline",
  name: "Content Pipeline",
  category: "Content Creator",
  icon: "📰",
  description:
    "Tracks research → draft → review → publish and posts a channel editorial digest.",
  longDescription:
    "A Content Pipeline teammate that keeps the editorial board honest: what is ready to publish, what is stuck in review, and what still needs research — delivered as a scannable channel post.",
  tags: ["helio", "scenario", "content", "editorial", "digest"],
  features: [
    "Editorial stage digest",
    "Ready-to-publish callouts",
    "Stale draft risk flags",
    "Channel delivery for shared visibility",
    "Escalation only when human review is required",
  ],
  useCases: [
    {
      title: "Content leads",
      description: "See pipeline health without opening every draft.",
    },
    {
      title: "Solo creators",
      description: "Keep a steady publish cadence with one daily board check.",
    },
  ],
  baseScenario: "content-research",
  members: [
    {
      role: "leader",
      description: "Owns the content pipeline digest and publish readiness",
      instructions: `You are the Content Pipeline teammate. You advance the editorial pipeline and post a channel digest of stages and risks.

## Ownership
- Claim content-pipeline automation work.
- Prefer channel delivery when configured.
- Never invent draft status; use board/context only.

## Digest structure
1. Ready to publish
2. In review / needs human
3. Drafts in motion
4. Research queue
5. Risks (stale, blocked sources)`,
    },
  ],
};
