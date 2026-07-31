// Bilingual labels for the authenticated app shell (sidebar rail, mobile top bar,
// workspace nav chrome, user menu, inbox/flag popovers, agent context menus).
// Nav ids, slugs, URLs, and technical tokens stay in English; only display labels
// are localized. Mirrors the settings-labels / landing-labels bilingual pattern.

import { Locale, type LocaleLabels } from "@phneakngar/shared";

type BilingualLabel = LocaleLabels;

export const SHELL_LABELS = {
  nav: {
    home: { [Locale.EN]: "Home", [Locale.KM]: "ទំព័រដើម" } as BilingualLabel,
    inbox: { [Locale.EN]: "Inbox", [Locale.KM]: "ប្រអប់សារ" } as BilingualLabel,
    flagged: { [Locale.EN]: "Flagged", [Locale.KM]: "បានដាក់សញ្ញា" } as BilingualLabel,
    issues: { [Locale.EN]: "Issues", [Locale.KM]: "បញ្ហា" } as BilingualLabel,
    calendar: { [Locale.EN]: "Calendar", [Locale.KM]: "ប្រតិទិន" } as BilingualLabel,
    approvals: { [Locale.EN]: "Approvals", [Locale.KM]: "ការអនុម័ត" } as BilingualLabel,
    activity: { [Locale.EN]: "Activity", [Locale.KM]: "សកម្មភាព" } as BilingualLabel,
    automations: { [Locale.EN]: "Automations", [Locale.KM]: "ស្វ័យប្រវត្តិកម្ម" } as BilingualLabel,
    playbooks: { [Locale.EN]: "Playbooks", [Locale.KM]: "សៀវភៅដំណើរការ" } as BilingualLabel,
    runtimes: { [Locale.EN]: "Runtimes", [Locale.KM]: "បរិស្ថានដំណើរការ" } as BilingualLabel,
    settings: { [Locale.EN]: "Settings", [Locale.KM]: "ការកំណត់" } as BilingualLabel,
    help: { [Locale.EN]: "Help", [Locale.KM]: "ជំនួយ" } as BilingualLabel,
    switchWorkspace: { [Locale.EN]: "Switch workspace", [Locale.KM]: "ប្តូរកន្លែងធ្វើការ" } as BilingualLabel,
  },
  actions: {
    openSidebar: { [Locale.EN]: "Open sidebar", [Locale.KM]: "បើករបារចំហៀង" } as BilingualLabel,
    toggleTheme: { [Locale.EN]: "Toggle theme", [Locale.KM]: "ប្តូររចនាបថ" } as BilingualLabel,
    switchLanguage: { [Locale.EN]: "Switch language", [Locale.KM]: "ប្តូរភាសា" } as BilingualLabel,
    createGroup: { [Locale.EN]: "Create group", [Locale.KM]: "បង្កើតក្រុម" } as BilingualLabel,
    moveTo: { [Locale.EN]: "Move to", [Locale.KM]: "ផ្លាស់ទីទៅ" } as BilingualLabel,
    ungroupAgents: { [Locale.EN]: "Ungroup agents", [Locale.KM]: "បំបែកភ្នាក់ងារ" } as BilingualLabel,
    done: { [Locale.EN]: "Done", [Locale.KM]: "រួចរាល់" } as BilingualLabel,
    cancel: { [Locale.EN]: "Cancel", [Locale.KM]: "បោះបង់" } as BilingualLabel,
    createFirstAgent: { [Locale.EN]: "Create your first agent", [Locale.KM]: "បង្កើតភ្នាក់ងារដំបូង" } as BilingualLabel,
    newAgent: { [Locale.EN]: "New agent", [Locale.KM]: "ភ្នាក់ងារថ្មី" } as BilingualLabel,
  },
  agent: {
    unpin: { [Locale.EN]: "Unpin", [Locale.KM]: "ដកការខ្ទាស់" } as BilingualLabel,
    pinTop: { [Locale.EN]: "Pin to top", [Locale.KM]: "ខ្ទាស់ទៅលើ" } as BilingualLabel,
    removeFromGroup: { [Locale.EN]: "Remove from group", [Locale.KM]: "ដកចេញពីក្រុម" } as BilingualLabel,
  },
  user: {
    account: { [Locale.EN]: "Account", [Locale.KM]: "គណនី" } as BilingualLabel,
    logOut: { [Locale.EN]: "Log out", [Locale.KM]: "ចាកចេញ" } as BilingualLabel,
  },
  popover: {
    unread: { [Locale.EN]: "Unread", [Locale.KM]: "មិនទាន់អាន" } as BilingualLabel,
    flagged: { [Locale.EN]: "Flagged", [Locale.KM]: "បានដាក់សញ្ញា" } as BilingualLabel,
    noUnread: { [Locale.EN]: "No unread messages", [Locale.KM]: "គ្មានសារមិនទាន់អាន" } as BilingualLabel,
    noFlagged: { [Locale.EN]: "No flagged messages", [Locale.KM]: "គ្មានសារដែលដាក់សញ្ញា" } as BilingualLabel,
  },
} as const;

export type ShellLabelGroup = keyof typeof SHELL_LABELS;
export type ShellLabelKey<G extends ShellLabelGroup> = keyof (typeof SHELL_LABELS)[G];

type ResolvedShellLabels = {
  [G in ShellLabelGroup]: { [K in ShellLabelKey<G>]: string };
};

/**
 * Returns the app-shell labels localized for the given locale.
 */
export function getShellLabels(locale: Locale): ResolvedShellLabels {
  return Object.fromEntries(
    Object.entries(SHELL_LABELS).map(([group, labels]) => [
      group,
      Object.fromEntries(
        Object.entries(labels).map(([key, label]) => [
          key,
          label[locale],
        ]),
      ),
    ]),
  ) as unknown as ResolvedShellLabels;
}

/**
 * Resolves a single shell label for the given locale.
 */
export function shellLabel<G extends ShellLabelGroup>(
  group: G,
  key: ShellLabelKey<G>,
  locale: Locale,
): string {
  return (SHELL_LABELS[group][key] as BilingualLabel)[locale];
}
