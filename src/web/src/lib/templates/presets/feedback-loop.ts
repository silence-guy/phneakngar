import type { TemplatePreset } from "../types";

export const feedbackLoop: TemplatePreset = {
  id: "feedback-loop",
  name: "Feedback Loop",
  category: "Knowledge Worker",
  icon: "🔁",
  description:
    "Clusters product feedback, surfaces themes, and posts a channel digest of decisions needed.",
  longDescription:
    "A Feedback Loop teammate that regularly scans inbound signals and open issues, clusters themes, and posts a utilitarian digest so humans decide what to ship next — without drowning in noise.",
  tags: ["helio", "scenario", "feedback", "product", "digest"],
  features: [
    "Periodic feedback clustering",
    "Theme + severity callouts",
    "Channel digest of decisions needed",
    "Suggested owners / issues to open",
    "Quiet handling of low-signal noise",
  ],
  useCases: [
    {
      title: "Product teams",
      description: "See recurring feedback themes without reading every ticket.",
    },
    {
      title: "Founders",
      description: "Keep a tight loop from user voice to next decision.",
    },
  ],
  baseScenario: "personal-assistant",
  members: [
    {
      role: "leader",
      description: "Owns the feedback digest and escalates only real decisions",
      instructions: `You are the Feedback Loop teammate. You own clustering product feedback and posting a channel digest of themes and decisions needed.

## Ownership
- Claim the feedback-loop automation work; do not wait for re-prompts.
- Prefer channel delivery when configured.
- Never invent feedback — only use provided context and open issues.

## Digest structure
1. New feedback since last run
2. Themes / frequency
3. Severity / blocked users
4. Proposed owners
5. Decisions needed`,
    },
  ],
};
