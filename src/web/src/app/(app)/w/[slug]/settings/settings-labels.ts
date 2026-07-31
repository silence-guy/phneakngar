// Bilingual labels for the settings page.
// Tab ids, slugs, URLs, and technical tokens stay in English; only display labels are localized.
// This module exports both the original structure (for backward compat) and a getSettingsLabels() function for bilingual support.

import { Locale, type LocaleLabels } from "@phneakngar/shared";

// Helper type for bilingual labels
type BilingualLabel = LocaleLabels;
type BilingualRecord = Record<string, BilingualLabel>;

// =============================================================================
// Original structure (KH-only, backward compatible)
// =============================================================================

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
    slugHintPrefix: "ប្រើក្នុង URL: ",
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
    inviteCopiedShort: "បានចម្លង",
    failedToCopy: "មិនអាចចម្លងតំណបានទេ",
    inviteRevoked: "បានដកហូតតំណអញ្ជើញ",
    failedToRevoke: "មិនអាចដកហូតតំណអញ្ជើញបានទេ",
    memberRemoved: "បានដកសមាជិកចេញ",
    failedToRemove: "មិនអាចដកសមាជិកចេញបានទេ",
    pendingInvites: "តំណអញ្ជើញដែលកំពុងរង់ចាំ",
    generating: "កំពុងបង្កើត...",
    generateInvite: "បង្កើតតំណអញ្ជើញ",
    noInvites:
      "គ្មានតំណអញ្ជើញសកម្មទេ។ បង្កើតមួយដើម្បីអញ្ជើញនរណាម្នាក់ចូល workspace នេះ។",
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
    permissionDenied: "សិទ្ធិជូនដំណឹងត្រូវបានបដិសេធ។ សូមបើកវានៅក្នុងការកំណត់ browser ។",
    permissionDeniedHint: "សិទ្ធិជូនដំណឹងត្រូវបានបដិសេធ។ សូមអនុញ្ញាតវានៅក្នុងការកំណត់ browser របស់អ្នក ។",
    notSupported: "browser របស់អ្នកមិនគាំទ្រការជូនដំណឹងទេ។",
    sectionTitle: "ការជូនដំណឹងតាម Browser",
    enable: "បើកការជូនដំណឹង",
    enableDescription: "ទទួលការជូនដំណឹងពេលភារកិច្ចបញ្ចប់ ខណៈ tab នៅផ្ទៃខាងក្រោយ",
    notifyWhen: "ជូនដំណឹងខ្ញុំពេល:",
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
    peersTitle: "Peer allowlist",
    peersHint:
      "When dm_policy is allowlist or pairing, only these peer ids may DM the bot.",
    peersEmpty: "No peers yet.",
    peerId: "Peer id",
    peerAdd: "Add peer",
    peerRemove: "Remove",
    peerAdded: "Peer added",
    peerRemoved: "Peer removed",
    peerFailed: "Peer update failed",
    peersLoadFailed: "Failed to load peers",
  },

  language: {
    sectionTitle: "Language",
    uiLocaleLabel: "Interface Language",
    uiLocaleDescription: "Controls the language of the workspace UI and labels",
    agentLanguageLabel: "Agent Response Language",
    agentLanguageDescription: "How agents respond to user messages",
  },
} as const;

// =============================================================================
// Bilingual labels for getSettingsLabels()
// =============================================================================

const BILINGUAL_LABELS = {
  title: {
    [Locale.EN]: "Settings",
    [Locale.KM]: "ការកំណត់",
  } as BilingualLabel,

  tabs: {
    general: { [Locale.EN]: "General", [Locale.KM]: "ទូទៅ" } as BilingualLabel,
    pet: { [Locale.EN]: "Pet", [Locale.KM]: "សត្វចិញ្ចឹម" } as BilingualLabel,
    instruction: { [Locale.EN]: "Global Instructions", [Locale.KM]: "សេចក្តីណែនាំសកល" } as BilingualLabel,
    notifications: { [Locale.EN]: "Notifications", [Locale.KM]: "ការជូនដំណឹង" } as BilingualLabel,
    members: { [Locale.EN]: "Members", [Locale.KM]: "សមាជិក" } as BilingualLabel,
    usages: { [Locale.EN]: "Usage", [Locale.KM]: "ការប្រើប្រាស់" } as BilingualLabel,
    gateway: { [Locale.EN]: "Gateway", [Locale.KM]: "ច្រកទ្វារ" } as BilingualLabel,
  } as BilingualRecord,

  general: {
    failedToLoad: { [Locale.EN]: "Failed to load workspace info", [Locale.KM]: "មិនអាចផ្ទុកព័ត៌មាន workspace បានទេ" },
    ownerOnly: { [Locale.EN]: "Only workspace owners can edit workspace settings.", [Locale.KM]: "មានតែម្ចាស់ workspace ប៉ុណ្ណោះអាចកែការកំណត់ workspace បាន។" },
    sectionTitle: { [Locale.EN]: "Workspace", [Locale.KM]: "កន្លែងការងារ" },
    nameLabel: { [Locale.EN]: "Name", [Locale.KM]: "ឈ្មោះ" },
    namePlaceholder: { [Locale.EN]: "Workspace name", [Locale.KM]: "ឈ្មោះ workspace" },
    slugLabel: { [Locale.EN]: "Slug", [Locale.KM]: "Slug" },
    slugHintPrefix: { [Locale.EN]: "Used in URL: ", [Locale.KM]: "ប្រើក្នុង URL: " },
    save: { [Locale.EN]: "Save", [Locale.KM]: "រក្សាទុក" },
    saving: { [Locale.EN]: "Saving...", [Locale.KM]: "កំពុងរក្សាទុក..." },
    updated: { [Locale.EN]: "Workspace updated", [Locale.KM]: "បានធ្វើបច្ចុប្បន្នភាព workspace" },
    failedToUpdate: { [Locale.EN]: "Failed to update workspace", [Locale.KM]: "មិនអាចធ្វើបច្ចុប្បន្នភាព workspace បានទេ" },
    dangerZone: { [Locale.EN]: "Danger Zone", [Locale.KM]: "តំបន់គ្រោះថ្នាក់" },
    deleteWarning: {
      [Locale.EN]: "Deleting this workspace is permanent and cannot be undone. All agents, conversations, and data will be lost.",
      [Locale.KM]: "ការលុប workspace នេះគឺជាអចិន្ត្រៃយ៍ និងមិនអាចត្រឡប់វិញបានទេ។ ភ្នាក់ងារ ការសន្ទនា និងទិន្នន័យទាំងអស់នឹងបាត់បង់។",
    },
    confirmPrefix: { [Locale.EN]: "Type ", [Locale.KM]: "វាយ " },
    confirmSuffix: { [Locale.EN]: " to confirm", [Locale.KM]: " ដើម្បីបញ្ជាក់" },
    delete: { [Locale.EN]: "Delete Workspace", [Locale.KM]: "លុប Workspace" },
    deleting: { [Locale.EN]: "Deleting...", [Locale.KM]: "កំពុងលុប..." },
    deleted: { [Locale.EN]: "Workspace deleted", [Locale.KM]: "បានលុប workspace" },
    failedToDelete: { [Locale.EN]: "Failed to delete workspace", [Locale.KM]: "មិនអាចលុប workspace បានទេ" },
  },

  instruction: {
    failedToLoad: { [Locale.EN]: "Failed to load settings", [Locale.KM]: "មិនអាចផ្ទុកការកំណត់បានទេ" },
    failedToSave: { [Locale.EN]: "Failed to save", [Locale.KM]: "មិនអាចរក្សាទុកបានទេ" },
    placeholder: {
      [Locale.EN]: "Write instructions that all your agents will follow...",
      [Locale.KM]: "សរសេរសេចក្តីណែនាំដែលភ្នាក់ងារទាំងអស់របស់អ្នកនឹងធ្វើតាម...",
    },
    footerHelp: {
      [Locale.EN]: "This instruction is prepended to each agent's own instructions.",
      [Locale.KM]: "សេចក្តីណែនាំនេះត្រូវបានដាក់ខាងមុខសេចក្តីណែនាំរបស់ភ្នាក់ងារនីមួយៗ។",
    },
  },

  members: {
    failedToLoad: { [Locale.EN]: "Failed to load members", [Locale.KM]: "មិនអាចផ្ទុកសមាជិកបានទេ" },
    inviteCopied: { [Locale.EN]: "Invite link copied to clipboard", [Locale.KM]: "បានចម្លងតំណអញ្ជើញទៅ clipboard" },
    failedToGenerate: { [Locale.EN]: "Failed to generate invite", [Locale.KM]: "មិនអាចបង្កើតតំណអញ្ជើញបានទេ" },
    inviteCopiedShort: { [Locale.EN]: "Copied", [Locale.KM]: "បានចម្លង" },
    failedToCopy: { [Locale.EN]: "Failed to copy link", [Locale.KM]: "មិនអាចចម្លងតំណបានទេ" },
    inviteRevoked: { [Locale.EN]: "Invite revoked", [Locale.KM]: "បានដកហូតតំណអញ្ជើញ" },
    failedToRevoke: { [Locale.EN]: "Failed to revoke invite", [Locale.KM]: "មិនអាចដកហូតតំណអញ្ជើញបានទេ" },
    memberRemoved: { [Locale.EN]: "Member removed", [Locale.KM]: "បានដកសមាជិកចេញ" },
    failedToRemove: { [Locale.EN]: "Failed to remove member", [Locale.KM]: "មិនអាចដកសមាជិកចេញបានទេ" },
    pendingInvites: { [Locale.EN]: "Pending Invites", [Locale.KM]: "តំណអញ្ជើញដែលកំពុងរង់ចាំ" },
    generating: { [Locale.EN]: "Generating...", [Locale.KM]: "កំពុងបង្កើត..." },
    generateInvite: { [Locale.EN]: "Generate Invite", [Locale.KM]: "បង្កើតតំណអញ្ជើញ" },
    noInvites: {
      [Locale.EN]: "No active invites. Generate one to invite someone to this workspace.",
      [Locale.KM]: "គ្មានតំណអញ្ជើញសកម្មទេ។ បង្កើតមួយដើម្បីអញ្ជើញនរណាម្នាក់ចូល workspace នេះ។",
    },
    inviteWebAccessNote: {
      [Locale.EN]: "Invited users only need the web app (email + code). CLI is only needed if they want to run agents on their own machine.",
      [Locale.KM]: "អ្នកដែលត្រូវបានអញ្ជើញត្រូវការតែគេហទំព័រ (email + កូដ)។ CLI ត្រូវការតែបើពួកគេចង់រត់ភ្នាក់ងារលើកុំព្យូទ័ររបស់ខ្លួន។",
    },
    expired: { [Locale.EN]: "Expired", [Locale.KM]: "ផុតកំណត់" },
    copyInvite: { [Locale.EN]: "Copy Invite Link", [Locale.KM]: "ចម្លងតំណអញ្ជើញ" },
    revokeInvite: { [Locale.EN]: "Revoke Invite", [Locale.KM]: "ដកហូតតំណអញ្ជើញ" },
    membersHeading: { [Locale.EN]: "Members", [Locale.KM]: "សមាជិក" },
    you: { [Locale.EN]: "(you)", [Locale.KM]: "(អ្នក)" },
    removeMember: { [Locale.EN]: "Remove Member", [Locale.KM]: "ដកសមាជិកចេញ" },
  },

  notification: {
    permissionDenied: {
      [Locale.EN]: "Notification permission denied. Please enable it in your browser settings.",
      [Locale.KM]: "សិទ្ធិជូនដំណឹងត្រូវបានបដិសេធ។ សូមបើកវានៅក្នុងការកំណត់ browser ។",
    },
    permissionDeniedHint: {
      [Locale.EN]: "Notification permission denied. Please allow it in your browser settings.",
      [Locale.KM]: "សិទ្ធិជូនដំណឹងត្រូវបានបដិសេធ។ សូមអនុញ្ញាតវានៅក្នុងការកំណត់ browser របស់អ្នក ។",
    },
    notSupported: { [Locale.EN]: "Your browser does not support notifications.", [Locale.KM]: "browser របស់អ្នកមិនគាំទ្រការជូនដំណឹងទេ។" },
    sectionTitle: { [Locale.EN]: "Browser Notifications", [Locale.KM]: "ការជូនដំណឹងតាម Browser" },
    enable: { [Locale.EN]: "Enable notifications", [Locale.KM]: "បើកការជូនដំណឹង" },
    enableDescription: {
      [Locale.EN]: "Receive notifications when tasks complete while tab is in the background",
      [Locale.KM]: "ទទួលការជូនដំណឹងពេលភារកិច្ចបញ្ចប់ ខណៈ tab នៅផ្ទៃខាងក្រោយ",
    },
    notifyWhen: { [Locale.EN]: "Notify me when:", [Locale.KM]: "ជូនដំណឹងខ្ញុំពេល:" },
  },

  gateway: {
    sectionTitle: { [Locale.EN]: "Chat gateway bindings", [Locale.KM]: "Chat gateway bindings" },
    sectionHint: { [Locale.EN]: "Map Slack/Discord/Telegram/Lark/Teams team ids to a workspace agent.", [Locale.KM]: "Map Slack/Discord/Telegram/Lark/Teams team ids to a workspace agent." },
    parityNote: { [Locale.EN]: "Full commercial parity is not claimed.", [Locale.KM]: "Full commercial parity is not claimed." },
    provider: { [Locale.EN]: "Provider", [Locale.KM]: "Provider" },
    teamId: { [Locale.EN]: "External team / chat id", [Locale.KM]: "External team / chat id" },
    agent: { [Locale.EN]: "Agent", [Locale.KM]: "Agent" },
    botToken: { [Locale.EN]: "Bot token (vault)", [Locale.KM]: "Bot token (vault)" },
    botTokenHint: { [Locale.EN]: "Write-only. Never shown after save.", [Locale.KM]: "Write-only. Never shown after save." },
    outboundMode: { [Locale.EN]: "Outbound mode", [Locale.KM]: "Outbound mode" },
    outboundPreview: { [Locale.EN]: "Preview", [Locale.KM]: "Preview" },
    outboundLive: { [Locale.EN]: "Live", [Locale.KM]: "Live" },
    hasSecret: { [Locale.EN]: "Token vaulted", [Locale.KM]: "Token vaulted" },
    noSecret: { [Locale.EN]: "No token", [Locale.KM]: "No token" },
    saveToken: { [Locale.EN]: "Save token", [Locale.KM]: "Save token" },
    enableLive: { [Locale.EN]: "Set Live", [Locale.KM]: "Set Live" },
    setPreview: { [Locale.EN]: "Set Preview", [Locale.KM]: "Set Preview" },
    probe: { [Locale.EN]: "Probe", [Locale.KM]: "Probe" },
    probeOk: { [Locale.EN]: "Probe ok", [Locale.KM]: "Probe ok" },
    probeFailed: { [Locale.EN]: "Probe failed", [Locale.KM]: "Probe failed" },
    tokenSaved: { [Locale.EN]: "Bot token saved", [Locale.KM]: "Bot token saved" },
    updated: { [Locale.EN]: "Binding updated", [Locale.KM]: "Binding updated" },
    add: { [Locale.EN]: "Add binding", [Locale.KM]: "Add binding" },
    saving: { [Locale.EN]: "Saving…", [Locale.KM]: "Saving…" },
    empty: { [Locale.EN]: "No gateway bindings yet.", [Locale.KM]: "No gateway bindings yet." },
    created: { [Locale.EN]: "Binding created", [Locale.KM]: "Binding created" },
    deleted: { [Locale.EN]: "Binding deleted", [Locale.KM]: "Binding deleted" },
    delete: { [Locale.EN]: "Delete binding", [Locale.KM]: "Delete binding" },
    failedToLoad: { [Locale.EN]: "Failed to load gateway bindings", [Locale.KM]: "Failed to load gateway bindings" },
    failedToCreate: { [Locale.EN]: "Failed to create binding", [Locale.KM]: "Failed to create binding" },
    failedToDelete: { [Locale.EN]: "Failed to delete binding", [Locale.KM]: "Failed to delete binding" },
    failedToUpdate: { [Locale.EN]: "Failed to update binding", [Locale.KM]: "Failed to update binding" },
    missingFields: { [Locale.EN]: "Provider, team id, and agent are required", [Locale.KM]: "Provider, team id, and agent are required" },
    doctorTitle: { [Locale.EN]: "Dry-config doctor", [Locale.KM]: "Dry-config doctor" },
    doctorHint: { [Locale.EN]: "Binding and webhook-secret checks.", [Locale.KM]: "Binding and webhook-secret checks." },
    doctorOk: { [Locale.EN]: "Dry-config ok", [Locale.KM]: "Dry-config ok" },
    doctorWarning: { [Locale.EN]: "Dry-config warnings", [Locale.KM]: "Dry-config warnings" },
    doctorCritical: { [Locale.EN]: "Dry-config critical", [Locale.KM]: "Dry-config critical" },
    doctorBindingsSummary: { [Locale.EN]: "bindings", [Locale.KM]: "bindings" },
    doctorLiveRisk: { [Locale.EN]: "Live without vaulted token (risk)", [Locale.KM]: "Live without vaulted token (risk)" },
    doctorWebhookFailClosed: { [Locale.EN]: "Webhook fail-closed", [Locale.KM]: "Webhook fail-closed" },
    doctorMissingTeam: { [Locale.EN]: "Missing team id", [Locale.KM]: "Missing team id" },
    doctorMissingAgent: { [Locale.EN]: "Binding agent missing", [Locale.KM]: "Binding agent missing" },
    doctorEmpty: { [Locale.EN]: "No bindings — nothing to assess.", [Locale.KM]: "No bindings — nothing to assess." },
    liveRiskBadgeHint: { [Locale.EN]: "token required", [Locale.KM]: "token required" },
    peersTitle: { [Locale.EN]: "Peer allowlist", [Locale.KM]: "Peer allowlist" },
    peersHint: { [Locale.EN]: "Only these peer ids may DM the bot.", [Locale.KM]: "Only these peer ids may DM the bot." },
    peersEmpty: { [Locale.EN]: "No peers yet.", [Locale.KM]: "No peers yet." },
    peerId: { [Locale.EN]: "Peer id", [Locale.KM]: "Peer id" },
    peerAdd: { [Locale.EN]: "Add peer", [Locale.KM]: "Add peer" },
    peerRemove: { [Locale.EN]: "Remove", [Locale.KM]: "Remove" },
    peerAdded: { [Locale.EN]: "Peer added", [Locale.KM]: "Peer added" },
    peerRemoved: { [Locale.EN]: "Peer removed", [Locale.KM]: "Peer removed" },
    peerFailed: { [Locale.EN]: "Peer update failed", [Locale.KM]: "Peer update failed" },
    peersLoadFailed: { [Locale.EN]: "Failed to load peers", [Locale.KM]: "Failed to load peers" },
  },

  language: {
    sectionTitle: { [Locale.EN]: "Language", [Locale.KM]: "ភាសា" },
    uiLocaleLabel: { [Locale.EN]: "Interface Language", [Locale.KM]: "ភាសាផ្ទៃអន្តរកម្ម" },
    uiLocaleDescription: {
      [Locale.EN]: "Controls the language of the workspace UI and labels",
      [Locale.KM]: "គ្រប់គ្រងភាសានៃផ្ទៃអន្តរកម្ម workspace និងស្លាក",
    },
    agentLanguageLabel: { [Locale.EN]: "Agent Response Language", [Locale.KM]: "ភាសាឆ្លើយតបរបស់ភ្នាក់ងារ" },
    agentLanguageDescription: {
      [Locale.EN]: "How agents respond to user messages",
      [Locale.KM]: "របៀបដែលភ្នាក់ងារឆ្លើយតបចំពោះសាររបស់អ្នកប្រើ",
    },
  },

  pet: {
    sectionTitle: { [Locale.EN]: "Pet", [Locale.KM]: "សត្វចិញ្ចឹម" },
    preset: { [Locale.EN]: "Preset", [Locale.KM]: "គំរូ" },
  },
} as const;

// =============================================================================
// Helper functions
// =============================================================================

type ResolvedSettingsLabels = {
  [K in keyof typeof BILINGUAL_LABELS]: typeof BILINGUAL_LABELS[K] extends BilingualLabel
    ? string
    : typeof BILINGUAL_LABELS[K] extends BilingualRecord
      ? { [K2 in keyof typeof BILINGUAL_LABELS[K]]: string }
      : typeof BILINGUAL_LABELS[K];
};

/**
 * Returns the settings labels localized for the given locale.
 */
export function getSettingsLabels(locale: Locale): ResolvedSettingsLabels {
  const resolve = (label: BilingualLabel) => label[locale];

  return {
    title: resolve(BILINGUAL_LABELS.title),
    tabs: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.tabs).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["tabs"],
    general: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.general).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["general"],
    instruction: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.instruction).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["instruction"],
    members: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.members).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["members"],
    notification: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.notification).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["notification"],
    gateway: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.gateway).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["gateway"],
    language: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.language).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["language"],
    pet: Object.fromEntries(
      Object.entries(BILINGUAL_LABELS.pet).map(([key, value]) => [key, resolve(value as BilingualLabel)])
    ) as ResolvedSettingsLabels["pet"],
  };
}

// Keep original settingsTabLabel for backward compatibility
export function settingsTabLabel(id: string): string {
  return SETTINGS_LABELS.tabs[id] ?? id;
}

// Dynamic strings — keep the literal value the user must type or read unchanged.

export function slugUrlHint(slug: string, locale: Locale = Locale.KM): string {
  const labels = getSettingsLabels(locale);
  return `${labels.general.slugHintPrefix}/w/${slug}/`;
}

export function expiresLabel(date: string, locale: Locale = Locale.KM): string {
  const labels = getSettingsLabels(locale);
  return `${labels.members.expired} ${date}`;
}
