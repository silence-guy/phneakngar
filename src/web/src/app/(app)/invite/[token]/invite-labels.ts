export const INVITE_LABELS = {
  invited: "អ្នកត្រូវបានអញ្ជើញ",
  workspace: "កន្លែងធ្វើការ",
  joinWorkspace: "ចូលរួមកន្លែងធ្វើការ",
  joiningWorkspace: "កំពុងចូលរួមកន្លែងធ្វើការ…",
  inviteUnavailable: "ការអញ្ជើញមិនអាចប្រើបាន",
  goToWorkspaces: "ទៅកាន់កន្លែងធ្វើការ",
  fallbackWorkspace: "កន្លែងធ្វើការ",
  errors: {
    invalidOrExpired: "តំណអញ្ជើញមិនត្រឹមត្រូវ ឬផុតកំណត់",
    joinFailed: "មិនអាចចូលរួមកន្លែងធ្វើការបានទេ",
  },
} as const;

export function invitedByLabel(name: string): string {
  return `${name} បានអញ្ជើញអ្នកឱ្យចូលរួម`;
}

export function joinedWorkspaceLabel(workspaceName: string): string {
  return `បានចូលរួម ${workspaceName}`;
}

/** After invite accept: membership is complete; CLI is optional. */
export function joinedWorkspaceAccessNote(): string {
  return "អ្នកអាចប្រើកន្លែងធ្វើការតាមគេហទំព័របានហើយ។ ការដំឡើង CLI ត្រូវការតែបើអ្នកចង់រត់ភ្នាក់ងារលើកុំព្យូទ័ររបស់អ្នក។";
}
