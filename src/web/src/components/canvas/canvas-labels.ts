// Co-located Khmer (KM) labels for canvas components.
// Khmer is the default locale, so these are flat constants used directly.

export const CANVAS_LABELS = {
  chat: {
    openFullPage: "បើកទំព័រពេញ",
    close: "បិទ",
    fallbackTitle: "ជជែក",
  },
  link: {
    editRelationshipPrefix: "កែទំនាក់ទំនងរវាង ",
    editRelationshipJoin: " និង ",
    agentFallback: "ភ្នាក់ងារ",
    mentionHint: "ប្រើ @ ដើម្បីនិយាយអំពីភ្នាក់ងារ",
    relationshipPlaceholder:
      "ពិពណ៌នាពីរបៀបដែលភ្នាក់ងារទាំងនេះគួរសហការគ្នា។ សេចក្តីណែនាំនេះត្រូវបានចែករំលែកជាមួយភ្នាក់ងារទាំងពីរ នៅពេលពួកវាទទួលបានភារកិច្ច។",
    removeConnection: "ដកការតភ្ជាប់",
    removeConnectionDescriptionPrefix: "សកម្មភាពនេះនឹងដកការតភ្ជាប់រវាង “",
    removeConnectionDescriptionJoin: "” និង “",
    removeConnectionDescriptionSuffix: "”។",
  },
  events: {
    unknownAgent: "មិនស្គាល់",
    upcoming: "នាពេលខាងមុខ",
    upcomingEventsAria: "ព្រឹត្តិការណ៍នាពេលខាងមុខ",
    eventsToday: "ព្រឹត្តិការណ៍ថ្ងៃនេះ",
    collapsePanelAria: "បង្រួមផ្ទាំងព្រឹត្តិការណ៍",
    eventSuffix: "ព្រឹត្តិការណ៍",
  },
} as const;

export function editRelationshipTitle(
  sourceName?: string,
  targetName?: string,
): string {
  return `${CANVAS_LABELS.link.editRelationshipPrefix}${sourceName ?? ""}${CANVAS_LABELS.link.editRelationshipJoin}${targetName ?? ""}`;
}

export function linkAgentPairLabel(
  sourceName?: string,
  targetName?: string,
): string {
  const a = sourceName ?? CANVAS_LABELS.link.agentFallback;
  const b = targetName ?? CANVAS_LABELS.link.agentFallback;
  return `${a}${CANVAS_LABELS.link.editRelationshipJoin}${b}`;
}

export function removeConnectionDescription(
  sourceName?: string,
  targetName?: string,
): string {
  const a = sourceName ?? CANVAS_LABELS.link.agentFallback;
  const b = targetName ?? CANVAS_LABELS.link.agentFallback;
  return `${CANVAS_LABELS.link.removeConnectionDescriptionPrefix}${a}${CANVAS_LABELS.link.removeConnectionDescriptionJoin}${b}${CANVAS_LABELS.link.removeConnectionDescriptionSuffix}`;
}

export function upcomingCountLabel(count: number): string {
  return `${count} ${CANVAS_LABELS.events.upcoming}`;
}

export function eventsTodayLabel(count: number): string {
  return `${count} ${CANVAS_LABELS.events.eventsToday}`;
}

export function eventCountLabel(count: number): string {
  return `${count} ${CANVAS_LABELS.events.eventSuffix}`;
}
