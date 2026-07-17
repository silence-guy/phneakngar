// Khmer-only labels co-located with the settings page.
// Tab ids, slugs, URLs, and technical tokens stay in English; only display labels are localized.

export const SETTINGS_LABELS = {
  title: "ការកំណត់",
  tabs: {
    general: "ទូទៅ",
    pet: "សត្វចិញ្ចឹម",
    instruction: "សេចក្តីណែនាំសកល",
    notifications: "ការជូនដំណឹង",
    members: "សមាជិក",
    usages: "ការប្រើប្រាស់",
    gateway: "ច្រកទ្វារ",
  } as Record<string, string>,

  general: {
    failedToLoad: "មិនអាចផ្ទុកព័ត៌មាន workspace បានទេ",
    ownerOnly: "មានតែម្ចាស់ workspace ប៉ុណ្ណោះអាចកែការកំណត់ workspace បាន។",
    sectionTitle: "កន្លែងការងារ",
    nameLabel: "ឈ្មោះ",
    namePlaceholder: "ឈ្មោះ workspace",
    slugLabel: "Slug",
    slugHintPrefix: "ប្រើក្នុង URL៖ ",
    save: "រក្សាទុក",
    saving: "កំពុងរក្សាទុក...",
    updated: "បានធ្វើបច្ចុប្បន្នភាព workspace",
    failedToUpdate: "មិនអាចធ្វើបច្ចុប្បន្នភាព workspace បានទេ",
    dangerZone: "តំបន់គ្រោះថ្នាក់",
    deleteWarning:
      "ការលុប workspace នេះគឺជាអចិន្ត្រៃយ៍ និងមិនអាចត្រឡប់វិញបានទេ។ ភ្នាក់ងារ ការសន្ទនា និងទិន្នន័យទាំងអស់នឹងបាត់បង់។",
    confirmPrefix: "វាយ ",
    confirmSuffix: " ដើម្បីបញ្ជាក់",
    delete: "លុប Workspace",
    deleting: "កំពុងលុប...",
    deleted: "បានលុប workspace",
    failedToDelete: "មិនអាចលុប workspace បានទេ",
  },

  instruction: {
    failedToLoad: "មិនអាចផ្ទុកការកំណត់បានទេ",
    failedToSave: "មិនអាចរក្សាទុកបានទេ",
    placeholder: "សរសេរសេចក្តីណែនាំដែលភ្នាក់ងារទាំងអស់របស់អ្នកនឹងធ្វើតាម...",
    footerHelp: "សេចក្តីណែនាំនេះត្រូវបានដាក់ខាងមុខសេចក្តីណែនាំរបស់ភ្នាក់ងារនីមួយៗ។",
  },

  members: {
    failedToLoad: "មិនអាចផ្ទុកសមាជិកបានទេ",
    inviteCopied: "បានចម្លងតំណអញ្ជើញទៅ clipboard",
    failedToGenerate: "មិនអាចបង្កើតតំណអញ្ជើញបានទេ",
    inviteCopiedShort: "បានចម្លងតំណអញ្ជើញ",
    failedToCopy: "មិនអាចចម្លងតំណបានទេ",
    inviteRevoked: "បានដកហូតតំណអញ្ជើញ",
    failedToRevoke: "មិនអាចដកហូតតំណអញ្ជើញបានទេ",
    memberRemoved: "បានដកសមាជិកចេញ",
    failedToRemove: "មិនអាចដកសមាជិកចេញបានទេ",
    pendingInvites: "តំណអញ្ជើញដែលកំពុងរង់ចាំ",
    generating: "កំពុងបង្កើត...",
    generateInvite: "បង្កើតតំណអញ្ជើញ",
    noInvites: "គ្មានតំណអញ្ជើញសកម្មទេ។ បង្កើតមួយដើម្បីអញ្ជើញនរណាម្នាក់ចូល workspace នេះ។",
    inviteWebAccessNote:
      "អ្នកដែលត្រូវបានអញ្ជើញត្រូវការតែគេហទំព័រ (email + កូដ)។ CLI ត្រូវការតែបើពួកគេចង់រត់ភ្នាក់ងារលើកុំព្យូទ័ររបស់ខ្លួន។",
    expired: "ផុតកំណត់",
    copyInvite: "ចម្លងតំណអញ្ជើញ",
    revokeInvite: "ដកហូតតំណអញ្ជើញ",
    membersHeading: "សមាជិក",
    you: "(អ្នក)",
    removeMember: "ដកសមាជិកចេញ",
  },

  notification: {
    permissionDenied: "សិទ្ធិជូនដំណឹងត្រូវបានបដិសេធ។ សូមបើកវានៅក្នុងការកំណត់ browser។",
    permissionDeniedHint: "សិទ្ធិជូនដំណឹងត្រូវបានបដិសេធ។ សូមអនុញ្ញាតវានៅក្នុងការកំណត់ browser របស់អ្នក។",
    notSupported: "browser របស់អ្នកមិនគាំទ្រការជូនដំណឹងទេ។",
    sectionTitle: "ការជូនដំណឹងតាម Browser",
    enable: "បើកការជូនដំណឹង",
    enableDescription: "ទទួលការជូនដំណឹងពេលភារកិច្ចបញ្ចប់ ខណៈ tab នៅផ្ទៃខាងក្រោយ",
    notifyWhen: "ជូនដំណឹងខ្ញុំពេល៖",
  },

  gateway: {
    sectionTitle: "Chat gateway bindings",
    sectionHint:
      "Map Slack/Discord/Telegram/Lark/Teams team ids to a workspace agent. Outbound defaults to Preview until Live credentials are configured.",
    parityNote: "Full commercial Helio/OpenClaw parity is not claimed.",
    provider: "Provider",
    teamId: "External team / chat id",
    agent: "Agent",
    botToken: "Bot token (vault)",
    botTokenHint: "Write-only. Stored as secret_ref — never shown again after save.",
    outboundMode: "Outbound mode",
    outboundPreview: "Preview (format only)",
    outboundLive: "Live (Telegram/Slack send when token set)",
    hasSecret: "Token vaulted",
    noSecret: "No token",
    saveToken: "Save token",
    enableLive: "Set Live",
    setPreview: "Set Preview",
    probe: "Probe",
    probeOk: "Probe ok",
    probeFailed: "Probe failed",
    tokenSaved: "Bot token saved",
    updated: "Binding updated",
    add: "Add binding",
    saving: "Saving…",
    empty: "No gateway bindings yet.",
    created: "Binding created",
    deleted: "Binding deleted",
    delete: "Delete binding",
    failedToLoad: "Failed to load gateway bindings",
    failedToCreate: "Failed to create binding",
    failedToDelete: "Failed to delete binding",
    failedToUpdate: "Failed to update binding",
    missingFields: "Provider, team id, and agent are required",
    doctorTitle: "Dry-config doctor",
    doctorHint:
      "Binding and webhook-secret checks. Live without vaulted token is a risk. Probe runs live provider ping when token is present.",
    doctorOk: "Dry-config ok",
    doctorWarning: "Dry-config warnings",
    doctorCritical: "Dry-config critical",
    doctorBindingsSummary: "bindings",
    doctorLiveRisk: "Live without vaulted outbound token (risk flag)",
    doctorWebhookFailClosed: "Webhook fail-closed: map set without shared secret",
    doctorMissingTeam: "Missing external team / chat id",
    doctorMissingAgent: "Binding agent missing or not in workspace",
    doctorEmpty: "No bindings — nothing to assess.",
    liveRiskBadgeHint: "token required",
  },
} as const;

export function settingsTabLabel(id: string): string {
  return SETTINGS_LABELS.tabs[id] ?? id;
}

// Dynamic strings — keep the literal value the user must type or read unchanged.

export function slugUrlHint(slug: string): string {
  return `${SETTINGS_LABELS.general.slugHintPrefix}/w/${slug}/`;
}

export function expiresLabel(date: string): string {
  return `ផុតកំណត់ ${date}`;
}
