import {
  Locale,
  coreEntityLabels,
  defaultLocale,
  getLocalizedLabel,
  issueStatusLabels,
  localeDisplayLabels,
  resolveLocale,
  taskStatusLabels,
  taskTypeLabels,
} from "@phneakngar/shared";
import type { Locale as SharedLocale, LocaleLabels } from "@phneakngar/shared";

export type WebLocale = SharedLocale;

export const DEFAULT_WEB_LOCALE = defaultLocale;

export const webNavigationLabels = {
  dashboard: {
    [Locale.EN]: "Dashboard",
    [Locale.KM]: "ផ្ទាំងគ្រប់គ្រង",
  },
  agents: {
    [Locale.EN]: "Agents",
    [Locale.KM]: "ភ្នាក់ងារ",
  },
  inbox: {
    [Locale.EN]: "Inbox",
    [Locale.KM]: "ប្រអប់សារ",
  },
  calendar: {
    [Locale.EN]: "Calendar",
    [Locale.KM]: "ប្រតិទិន",
  },
  issues: {
    [Locale.EN]: "Issues",
    [Locale.KM]: "បញ្ហា",
  },
  approvals: {
    [Locale.EN]: "Approvals",
    [Locale.KM]: "ការអនុម័ត",
  },
  activity: {
    [Locale.EN]: "Activity",
    [Locale.KM]: "សកម្មភាព",
  },
  automations: {
    [Locale.EN]: "Automations",
    [Locale.KM]: "ស្វ័យប្រវត្តិកម្ម",
  },
  playbooks: {
    [Locale.EN]: "Playbooks",
    [Locale.KM]: "សៀវភៅដំណើរការ",
  },
  settings: {
    [Locale.EN]: "Settings",
    [Locale.KM]: "ការកំណត់",
  },
} as const satisfies Record<string, LocaleLabels>;

export const onboardingCopy = {
  focusQuestion: {
    [Locale.EN]: "What will your company focus on?",
    [Locale.KM]: "តើក្រុមហ៊ុនរបស់អ្នកនឹងផ្តោតលើអ្វី?",
  },
  browseTemplates: {
    [Locale.EN]: "Browse templates",
    [Locale.KM]: "មើលគំរូ",
  },
  companyCreated: {
    [Locale.EN]: "Company created!",
    [Locale.KM]: "បានបង្កើតក្រុមហ៊ុនរួចហើយ!",
  },
  failedToCreateCompany: {
    [Locale.EN]: "Failed to create company",
    [Locale.KM]: "មិនអាចបង្កើតក្រុមហ៊ុនបានទេ",
  },
  failedToGenerateToken: {
    [Locale.EN]: "Failed to generate token",
    [Locale.KM]: "មិនអាចបង្កើតថូខឹនបានទេ",
  },
  autoRegistrationFailed: {
    [Locale.EN]: "Auto-registration failed",
    [Locale.KM]: "ការចុះឈ្មោះដោយស្វ័យប្រវត្តិបរាជ័យ",
  },
} as const satisfies Record<string, LocaleLabels>;

export const appShellCopy = {
  openSidebar: {
    [Locale.EN]: "Open sidebar",
    [Locale.KM]: "បើករបារចំហៀង",
  },
  home: {
    [Locale.EN]: "Home",
    [Locale.KM]: "ទំព័រដើម",
  },
  calendar: webNavigationLabels.calendar,
  issues: webNavigationLabels.issues,
  approvals: webNavigationLabels.approvals,
  activity: webNavigationLabels.activity,
  automations: webNavigationLabels.automations,
  playbooks: webNavigationLabels.playbooks,
  runtimes: {
    [Locale.EN]: "Runtimes",
    [Locale.KM]: "បរិស្ថានដំណើរការ",
  },
  settings: webNavigationLabels.settings,
  toggleTheme: {
    [Locale.EN]: "Toggle theme",
    [Locale.KM]: "ប្តូររចនាបថ",
  },
  switchWorkspace: {
    [Locale.EN]: "Switch workspace",
    [Locale.KM]: "ប្តូរកន្លែងធ្វើការ",
  },
  createGroup: {
    [Locale.EN]: "Create group",
    [Locale.KM]: "បង្កើតក្រុម",
  },
  moveTo: {
    [Locale.EN]: "Move to",
    [Locale.KM]: "ផ្លាស់ទីទៅ",
  },
  ungroupAgents: {
    [Locale.EN]: "Ungroup agents",
    [Locale.KM]: "បំបែកភ្នាក់ងារ",
  },
  done: {
    [Locale.EN]: "Done",
    [Locale.KM]: "រួចរាល់",
  },
  cancel: {
    [Locale.EN]: "Cancel",
    [Locale.KM]: "បោះបង់",
  },
  createFirstAgent: {
    [Locale.EN]: "Create your first agent",
    [Locale.KM]: "បង្កើតភ្នាក់ងារដំបូង",
  },
  newAgent: {
    [Locale.EN]: "New agent",
    [Locale.KM]: "ភ្នាក់ងារថ្មី",
  },
} as const satisfies Record<string, LocaleLabels>;

export const connectMachineCopy = {
  copiedToClipboard: {
    [Locale.EN]: "Copied to clipboard",
    [Locale.KM]: "បានចម្លងទៅ clipboard",
  },
  registeredSuccessfully: {
    [Locale.EN]: "Registered successfully",
    [Locale.KM]: "បានចុះឈ្មោះដោយជោគជ័យ",
  },
  registrationFailed: {
    [Locale.EN]: "Registration failed",
    [Locale.KM]: "ការចុះឈ្មោះបរាជ័យ",
  },
  failedToExecuteRegistration: {
    [Locale.EN]: "Failed to execute registration",
    [Locale.KM]: "មិនអាចដំណើរការការចុះឈ្មោះបានទេ",
  },
  computerConnected: {
    [Locale.EN]: "Computer connected",
    [Locale.KM]: "កុំព្យូទ័របានភ្ជាប់",
  },
  connectComputer: {
    [Locale.EN]: "Connect a computer",
    [Locale.KM]: "ភ្ជាប់កុំព្យូទ័រ",
  },
  desktopDescription: {
    [Locale.EN]: "Click to register this machine for the current workspace.",
    [Locale.KM]: "ចុចដើម្បីចុះឈ្មោះម៉ាស៊ីននេះសម្រាប់កន្លែងធ្វើការបច្ចុប្បន្ន។",
  },
  terminalDescription: {
    [Locale.EN]: "Run this in your terminal to register this machine for the current workspace.",
    [Locale.KM]: "ដំណើរការពាក្យបញ្ជានេះក្នុង terminal ដើម្បីចុះឈ្មោះម៉ាស៊ីននេះសម្រាប់កន្លែងធ្វើការបច្ចុប្បន្ន។",
  },
  generatingToken: {
    [Locale.EN]: "Generating token...",
    [Locale.KM]: "កំពុងបង្កើតថូខឹន...",
  },
  registering: {
    [Locale.EN]: "Registering...",
    [Locale.KM]: "កំពុងចុះឈ្មោះ...",
  },
  register: {
    [Locale.EN]: "Register",
    [Locale.KM]: "ចុះឈ្មោះ",
  },
  clickToCopy: {
    [Locale.EN]: "Click to copy",
    [Locale.KM]: "ចុចដើម្បីចម្លង",
  },
  copyCommand: {
    [Locale.EN]: "Copy Command",
    [Locale.KM]: "ចម្លងពាក្យបញ្ជា",
  },
  nextStepsTitle: {
    [Locale.EN]: "Next steps",
    [Locale.KM]: "ជំហានបន្ទាប់",
  },
  nextStepRegisterTerminal: {
    [Locale.EN]: "Paste and run the register command above.",
    [Locale.KM]: "បិទភ្ជាប់ និងដំណើរការពាក្យបញ្ជា register ខាងលើ។",
  },
  nextStepRegisterDesktop: {
    [Locale.EN]: "Click Register above to link this machine.",
    [Locale.KM]: "ចុច «ចុះឈ្មោះ» ខាងលើដើម្បីភ្ជាប់ម៉ាស៊ីននេះ។",
  },
  nextStepChhlat: {
    [Locale.EN]: "If needed, start the local bridge (chhlat start).",
    [Locale.KM]: "បើចាំបាច់ ចាប់ផ្តើមស្ពានក្នុងម៉ាស៊ីន (chhlat start)។",
  },
  nextStepWait: {
    [Locale.EN]: "Wait until this page shows Computer connected.",
    [Locale.KM]: "រង់ចាំរហូតទាល់តែទំព័រនេះបង្ហាញ «កុំព្យូទ័របានភ្ជាប់»។",
  },
  nextStepWebBrain: {
    [Locale.EN]: "Optional: phneakngar web wire-mcp for live web tools.",
    [Locale.KM]: "ស្រេចចិត្ត៖ phneakngar web wire-mcp សម្រាប់ឧបករណ៍វេបផ្ទាល់។",
  },
  agentWorkdirNote: {
    [Locale.EN]:
      "Agents only use a sandboxed agent workspace folder on this computer—not your entire filesystem.",
    [Locale.KM]:
      "ភ្នាក់ងារប្រើតែថត workspace របស់ភ្នាក់ងារ (sandboxed) លើកុំព្យូទ័រនេះ—មិនមែនប្រព័ន្ធឯកសារទាំងមូលទេ។",
  },
  generateRegisterCommand: {
    [Locale.EN]: "Generate register command",
    [Locale.KM]: "បង្កើតពាក្យបញ្ជា register",
  },
  optionalConnectTitle: {
    [Locale.EN]: "Optional: connect this computer",
    [Locale.KM]: "ស្រេចចិត្ត៖ ភ្ជាប់កុំព្យូទ័រនេះ",
  },
  optionalConnectDescription: {
    [Locale.EN]:
      "You already have web access. Connect only if you want agents to run on this machine.",
    [Locale.KM]:
      "អ្នកមានសិទ្ធិប្រើតាមគេហទំព័ររួចហើយ។ ភ្ជាប់តែបើអ្នកចង់ឱ្យភ្នាក់ងាររត់លើម៉ាស៊ីននេះ។",
  },
} as const satisfies Record<string, LocaleLabels>;

export const agentFormCopy = {
  agentNamePlaceholder: {
    [Locale.EN]: "Agent name",
    [Locale.KM]: "ឈ្មោះភ្នាក់ងារ",
  },
  randomizeName: {
    [Locale.EN]: "Randomize name",
    [Locale.KM]: "ចៃដន្យឈ្មោះ",
  },
  descriptionPlaceholder: {
    [Locale.EN]: "Add a description...",
    [Locale.KM]: "បន្ថែមការពិពណ៌នា...",
  },
  roleTitle: {
    [Locale.EN]: "Teammate role",
    [Locale.KM]: "តួនាទីសហការី",
  },
  roleTitlePlaceholder: {
    [Locale.EN]: "e.g. Day Planner",
    [Locale.KM]: "ឧ. អ្នករៀបចំផែនការប្រចាំថ្ងៃ",
  },
  responsibility: {
    [Locale.EN]: "Responsibility",
    [Locale.KM]: "ការទទួលខុសត្រូវ",
  },
  responsibilityPlaceholder: {
    [Locale.EN]: "What this teammate owns...",
    [Locale.KM]: "អ្វីដែលសហការីនេះទទួលខុសត្រូវ...",
  },
  runtime: {
    [Locale.EN]: "Runtime",
    [Locale.KM]: "បរិស្ថានដំណើរការ (Runtime)",
  },
  noRuntimes: {
    [Locale.EN]: "No runtimes - start chhlat first",
    [Locale.KM]: "មិនមាន Runtime ទេ - សូមចាប់ផ្តើម chhlat ជាមុន",
  },
  offline: {
    [Locale.EN]: "offline",
    [Locale.KM]: "ក្រៅបណ្តាញ",
  },
  instructions: {
    [Locale.EN]: "Instructions",
    [Locale.KM]: "សេចក្តីណែនាំ",
  },
  instructionsPlaceholder: {
    [Locale.EN]: "System prompt or instructions...",
    [Locale.KM]: "System prompt ឬសេចក្តីណែនាំ...",
  },
  model: {
    [Locale.EN]: "Model",
    [Locale.KM]: "ម៉ូឌែល (Model)",
  },
  defaultRuntimeModel: {
    [Locale.EN]: "Default (runtime model)",
    [Locale.KM]: "លំនាំដើម (ម៉ូឌែលរបស់ Runtime)",
  },
  modelDefaultHint: {
    [Locale.EN]: "Optional. Leave blank to use the runtime's default model.",
    [Locale.KM]: "មិនចាំបាច់បំពេញទេ។ ទុកទទេដើម្បីប្រើម៉ូឌែលលំនាំដើមរបស់ Runtime។",
  },
  contextOptimization: {
    [Locale.EN]: "Context Optimization",
    [Locale.KM]: "ការបង្កើនប្រសិទ្ធភាពបរិបទ",
  },
  contextOptimizationHint: {
    [Locale.EN]: "Route this agent through a local Headroom proxy to reduce repeated tool, log, and file context.",
    [Locale.KM]: "បញ្ជូនភ្នាក់ងារនេះតាម Headroom proxy ក្នុងម៉ាស៊ីន ដើម្បីកាត់បន្ថយបរិបទ tool, log និង file ដែលស្ទួន។",
  },
  ambiguousToIssue: {
    [Locale.EN]: "Ambiguous DMs → issue",
    [Locale.KM]: "DM មិនច្បាស់ → issue",
  },
  ambiguousToIssueHint: {
    [Locale.EN]: "When a request lacks a clear owner or outcome, file an owned issue instead of freeform chat only.",
    [Locale.KM]: "នៅពេលសំណើមិនមានម្ចាស់ ឬលទ្ធផលច្បាស់ បង្កើត issue ដែលមានម្ចាស់ ជំនួសការជជែកសេរីតែប៉ុណ្ណោះ។",
  },
  approvalHold: {
    [Locale.EN]: "Hold tools until approved",
    [Locale.KM]: "ផ្អាកឧបករណ៍រហូតមានការអនុម័ត",
  },
  approvalHoldHint: {
    [Locale.EN]:
      "High-stakes tools pause until you decide in Approvals. Missing config still means ON (product default). This toggle saves runtime_config.approvalHold. Force off on the machine with CHHLAT_APPROVAL_HOLD=0.",
    [Locale.KM]:
      "ឧបករណ៍ហានិភ័យខ្ពស់ផ្អាករហូតអ្នកសម្រេចក្នុងប្រអប់អនុម័ត។ បើមិនទាន់កំណត់ នៅតែបើក (លំនាំដើមផលិតផល)។ Toggle នេះរក្សាទុក runtime_config.approvalHold។ បិទលើម៉ាស៊ីនដោយ CHHLAT_APPROVAL_HOLD=0។",
  },
  requireContextOptimization: {
    [Locale.EN]: "Require optimization",
    [Locale.KM]: "តម្រូវឱ្យប្រើការបង្កើនប្រសិទ្ធភាព",
  },
  requireContextOptimizationHint: {
    [Locale.EN]: "Fail the task instead of running direct when the local proxy is unavailable.",
    [Locale.KM]: "បើ proxy ក្នុងម៉ាស៊ីនមិនអាចប្រើបាន កុំដំណើរការផ្ទាល់ តែបង្ហាញថា task បរាជ័យ។",
  },
  shapeOutput: {
    [Locale.EN]: "Shape output",
    [Locale.KM]: "កែសម្រួលចម្លើយ",
  },
  shapeOutputHint: {
    [Locale.EN]: "Ask Headroom to trim repetitive response text. Keep off until you have verified the agent's style.",
    [Locale.KM]: "ឱ្យ Headroom កាត់អត្ថបទចម្លើយដែលស្ទួន។ ទុកបិទរហូតដល់អ្នកបានផ្ទៀងផ្ទាត់រចនាបថរបស់ភ្នាក់ងារ។",
  },
  mcpTools: {
    [Locale.EN]: "MCP tools",
    [Locale.KM]: "ឧបករណ៍ MCP",
  },
  mcpToolsHint: {
    [Locale.EN]:
      "MCP tools are configured on the agent machine — not managed in this dashboard. For live web (search, fetch, extract, crawl, diff), run `phneakngar web wire-mcp` on the PC so Codex/Claude load the lean web-brain tools, or add other MCP servers in the local runtime config.",
    [Locale.KM]:
      "ឧបករណ៍ MCP ត្រូវបានកំណត់នៅលើម៉ាស៊ីនភ្នាក់ងារ — មិនគ្រប់គ្រងក្នុង dashboard នេះទេ។ សម្រាប់វេបផ្ទាល់ (search, fetch, extract, crawl, diff) សូមរត់ `phneakngar web wire-mcp` លើ PC ដើម្បីឱ្យ Codex/Claude ផ្ទុក lean web-brain ឬបន្ថែម MCP servers ផ្សេងទៀតក្នុង runtime/config មូលដ្ឋាន។",
  },
  advanced: {
    [Locale.EN]: "Advanced",
    [Locale.KM]: "កម្រិតខ្ពស់",
  },
  email: {
    [Locale.EN]: "Email",
    [Locale.KM]: "អ៊ីមែល",
  },
  invalidHandle: {
    [Locale.EN]: "Must be 3+ characters, letters/numbers/hyphens only",
    [Locale.KM]: "ត្រូវមាន 3+ តួអក្សរ ហើយប្រើតែអក្សរ លេខ ឬសញ្ញា hyphen",
  },
  nameRequired: {
    [Locale.EN]: "Name is required",
    [Locale.KM]: "ត្រូវបញ្ចូលឈ្មោះ",
  },
  runtimeRequired: {
    [Locale.EN]: "Select an online runtime",
    [Locale.KM]: "ជ្រើសរើស Runtime ដែល online",
  },
  nameTourTitle: {
    [Locale.EN]: "Name your agent",
    [Locale.KM]: "ដាក់ឈ្មោះភ្នាក់ងារ",
  },
  nameTourDescription: {
    [Locale.EN]: "Give your agent a name - this is how you'll identify it.",
    [Locale.KM]: "ផ្តល់ឈ្មោះឱ្យភ្នាក់ងារ ដើម្បីងាយសម្គាល់។",
  },
  runtimeTourTitle: {
    [Locale.EN]: "Choose a runtime",
    [Locale.KM]: "ជ្រើសរើស Runtime",
  },
  runtimeTourDescription: {
    [Locale.EN]: "Select which machine and provider will run this agent.",
    [Locale.KM]: "ជ្រើសរើសម៉ាស៊ីន និង provider ដែលនឹងដំណើរការភ្នាក់ងារនេះ។",
  },
  cancel: appShellCopy.cancel,
  create: {
    [Locale.EN]: "Create",
    [Locale.KM]: "បង្កើត",
  },
  creating: {
    [Locale.EN]: "Creating...",
    [Locale.KM]: "កំពុងបង្កើត...",
  },
  save: {
    [Locale.EN]: "Save",
    [Locale.KM]: "រក្សាទុក",
  },
  saving: {
    [Locale.EN]: "Saving...",
    [Locale.KM]: "កំពុងរក្សាទុក...",
  },
  general: {
    [Locale.EN]: "General",
    [Locale.KM]: "ទូទៅ",
  },
  instruction: {
    [Locale.EN]: "Instruction",
    [Locale.KM]: "សេចក្តីណែនាំ",
  },
  permission: {
    [Locale.EN]: "Permission",
    [Locale.KM]: "សិទ្ធិ",
  },
  integrations: {
    [Locale.EN]: "Integrations",
    [Locale.KM]: "ការតភ្ជាប់",
  },
  failedToSaveInstructions: {
    [Locale.EN]: "Failed to save instructions",
    [Locale.KM]: "មិនអាចរក្សាទុកសេចក្តីណែនាំបានទេ",
  },
  writeInstructionsPlaceholder: {
    [Locale.EN]: "Write instructions for this agent...",
    [Locale.KM]: "សរសេរសេចក្តីណែនាំសម្រាប់ភ្នាក់ងារនេះ...",
  },
  instructionHelp: {
    [Locale.EN]: "Agent-specific instruction. Your global instruction is prepended automatically.",
    [Locale.KM]: "សេចក្តីណែនាំជាក់លាក់សម្រាប់ភ្នាក់ងារ។ សេចក្តីណែនាំសកលរបស់អ្នកនឹងត្រូវបានដាក់ខាងមុខដោយស្វ័យប្រវត្តិ។",
  },
  setAtCreation: {
    [Locale.EN]: "Set at creation",
    [Locale.KM]: "កំណត់ពេលបង្កើត",
  },
  notConfigured: {
    [Locale.EN]: "Not configured",
    [Locale.KM]: "មិនបានកំណត់",
  },
  allowedSendersTitle: {
    [Locale.EN]: "Allowed Senders",
    [Locale.KM]: "អ្នកផ្ញើដែលអនុញ្ញាត",
  },
  allowedSendersDescription: {
    [Locale.EN]: "Only emails from these addresses will trigger this agent. Applies to the platform address and every configured custom email address.",
    [Locale.KM]: "មានតែអ៊ីមែលពីអាសយដ្ឋានទាំងនេះប៉ុណ្ណោះដែលនឹងបើកដំណើរការភ្នាក់ងារនេះ។ អនុវត្តចំពោះអាសយដ្ឋាន platform និង custom email ទាំងអស់ដែលបានកំណត់។",
  },
  agentsCanEmailEachOther: {
    [Locale.EN]: "Agents in this workspace can already email each other - no whitelist entry needed.",
    [Locale.KM]: "ភ្នាក់ងារនៅក្នុង workspace នេះអាចផ្ញើអ៊ីមែលទៅគ្នារួចហើយ - មិនចាំបាច់បន្ថែម whitelist ទេ។",
  },
  failedToLoadWhitelist: {
    [Locale.EN]: "Failed to load whitelist",
    [Locale.KM]: "មិនអាចផ្ទុក whitelist បានទេ",
  },
  failedToAddEmail: {
    [Locale.EN]: "Failed to add email",
    [Locale.KM]: "មិនអាចបន្ថែមអ៊ីមែលបានទេ",
  },
  failedToRemoveEmail: {
    [Locale.EN]: "Failed to remove email",
    [Locale.KM]: "មិនអាចដកអ៊ីមែលចេញបានទេ",
  },
  adding: {
    [Locale.EN]: "Adding...",
    [Locale.KM]: "កំពុងបន្ថែម...",
  },
  add: {
    [Locale.EN]: "Add",
    [Locale.KM]: "បន្ថែម",
  },
  noAllowedSenders: {
    [Locale.EN]: "No allowed senders - all inbound emails will be rejected.",
    [Locale.KM]: "គ្មានអ្នកផ្ញើដែលអនុញ្ញាត - អ៊ីមែលចូលទាំងអស់នឹងត្រូវបដិសេធ។",
  },
  failedToLoadAccessList: {
    [Locale.EN]: "Failed to load access list",
    [Locale.KM]: "មិនអាចផ្ទុកបញ្ជីសិទ្ធិបានទេ",
  },
  agentIsPublic: {
    [Locale.EN]: "Agent is now public",
    [Locale.KM]: "ភ្នាក់ងារនេះបានក្លាយជាសាធារណៈ",
  },
  agentIsPrivate: {
    [Locale.EN]: "Agent is now private",
    [Locale.KM]: "ភ្នាក់ងារនេះបានក្លាយជាឯកជន",
  },
  failedToUpdateVisibility: {
    [Locale.EN]: "Failed to update visibility",
    [Locale.KM]: "មិនអាចធ្វើបច្ចុប្បន្នភាពភាពមើលឃើញបានទេ",
  },
  accessGranted: {
    [Locale.EN]: "Access granted",
    [Locale.KM]: "បានផ្តល់សិទ្ធិចូលប្រើ",
  },
  failedToGrantAccess: {
    [Locale.EN]: "Failed to grant access",
    [Locale.KM]: "មិនអាចផ្តល់សិទ្ធិចូលប្រើបានទេ",
  },
  accessRevokedAndRemovedFromWhitelist: {
    [Locale.EN]: "Access revoked and removed from whitelist",
    [Locale.KM]: "បានដកសិទ្ធិ និងដកចេញពី whitelist",
  },
  accessRevoked: {
    [Locale.EN]: "Access revoked",
    [Locale.KM]: "បានដកសិទ្ធិ",
  },
  failedToRevokeAccess: {
    [Locale.EN]: "Failed to revoke access",
    [Locale.KM]: "មិនអាចដកសិទ្ធិបានទេ",
  },
  visibility: {
    [Locale.EN]: "Visibility",
    [Locale.KM]: "ភាពមើលឃើញ",
  },
  visibilityPublicDescription: {
    [Locale.EN]: "All workspace members can use this agent",
    [Locale.KM]: "សមាជិក workspace ទាំងអស់អាចប្រើភ្នាក់ងារនេះ",
  },
  visibilityPrivateDescription: {
    [Locale.EN]: "Only authorized members can use this agent",
    [Locale.KM]: "មានតែសមាជិកដែលមានសិទ្ធិប៉ុណ្ណោះអាចប្រើភ្នាក់ងារនេះ",
  },
  public: {
    [Locale.EN]: "Public",
    [Locale.KM]: "សាធារណៈ",
  },
  private: {
    [Locale.EN]: "Private",
    [Locale.KM]: "ឯកជន",
  },
  authorizedMembers: {
    [Locale.EN]: "Authorized Members",
    [Locale.KM]: "សមាជិកដែលមានសិទ្ធិ",
  },
  owner: {
    [Locale.EN]: "Owner",
    [Locale.KM]: "ម្ចាស់",
  },
  addMember: {
    [Locale.EN]: "Add a member...",
    [Locale.KM]: "បន្ថែមសមាជិក...",
  },
  allMembersAdded: {
    [Locale.EN]: "All workspace members have been added. Invite new members from workspace settings.",
    [Locale.KM]: "សមាជិក workspace ទាំងអស់ត្រូវបានបន្ថែមរួចហើយ។ អញ្ជើញសមាជិកថ្មីពីការកំណត់ workspace។",
  },
  removeMemberAccess: {
    [Locale.EN]: "Remove Member Access",
    [Locale.KM]: "ដកសិទ្ធិសមាជិក",
  },
  removeMemberAccessPrefix: {
    [Locale.EN]: "Remove ",
    [Locale.KM]: "ដកសិទ្ធិ ",
  },
  removeMemberAccessSuffix: {
    [Locale.EN]: " from this agent?",
    [Locale.KM]: " ចេញពីភ្នាក់ងារនេះ?",
  },
  alsoRemoveFromEmailWhitelist: {
    [Locale.EN]: "Also remove from email whitelist",
    [Locale.KM]: "ដកចេញពី email whitelist ផងដែរ",
  },
  remove: {
    [Locale.EN]: "Remove",
    [Locale.KM]: "ដកចេញ",
  },
  customEmail: {
    [Locale.EN]: "Custom Email",
    [Locale.KM]: "អ៊ីមែលផ្ទាល់ខ្លួន",
  },
  customEmailTriggerDescription: {
    [Locale.EN]: "Connect your own mailbox via IMAP/SMTP",
    [Locale.KM]: "ភ្ជាប់ប្រអប់សារផ្ទាល់ខ្លួនតាម IMAP/SMTP",
  },
  loading: {
    [Locale.EN]: "Loading...",
    [Locale.KM]: "កំពុងផ្ទុក...",
  },
  emailAddress: {
    [Locale.EN]: "Email Address *",
    [Locale.KM]: "អាសយដ្ឋានអ៊ីមែល *",
  },
  displayName: {
    [Locale.EN]: "Display Name",
    [Locale.KM]: "ឈ្មោះបង្ហាញ",
  },
  imapReceive: {
    [Locale.EN]: "IMAP (Receive)",
    [Locale.KM]: "IMAP (ទទួល)",
  },
  smtpSend: {
    [Locale.EN]: "SMTP (Send)",
    [Locale.KM]: "SMTP (ផ្ញើ)",
  },
  usernameDefaultsToEmail: {
    [Locale.EN]: "Username (defaults to email)",
    [Locale.KM]: "Username (លំនាំដើមទៅអ៊ីមែល)",
  },
  appPassword: {
    [Locale.EN]: "App Password",
    [Locale.KM]: "App Password",
  },
  customEmailConfigured: {
    [Locale.EN]: "Custom email configured",
    [Locale.KM]: "បានកំណត់អ៊ីមែលផ្ទាល់ខ្លួន",
  },
  customEmailRemoved: {
    [Locale.EN]: "Custom email removed",
    [Locale.KM]: "បានដកអ៊ីមែលផ្ទាល់ខ្លួនចេញ",
  },
  failedToSave: {
    [Locale.EN]: "Failed to save",
    [Locale.KM]: "មិនអាចរក្សាទុកបានទេ",
  },
  failedToRemove: {
    [Locale.EN]: "Failed to remove",
    [Locale.KM]: "មិនអាចដកចេញបានទេ",
  },
  syncTriggered: {
    [Locale.EN]: "Sync triggered",
    [Locale.KM]: "បានចាប់ផ្តើម sync",
  },
  syncFailed: {
    [Locale.EN]: "Sync failed",
    [Locale.KM]: "Sync បរាជ័យ",
  },
  credentialHelp: {
    [Locale.EN]: "How to get IMAP/SMTP credentials",
    [Locale.KM]: "របៀបទទួលបាន IMAP/SMTP credentials",
  },
  customEmailDescription: {
    [Locale.EN]: "Connect your own mailbox to send and receive email as your identity.",
    [Locale.KM]: "ភ្ជាប់ប្រអប់សារផ្ទាល់ខ្លួន ដើម្បីផ្ញើ និងទទួលអ៊ីមែលជាអត្តសញ្ញាណរបស់អ្នក។",
  },
  syncNow: {
    [Locale.EN]: "Sync now",
    [Locale.KM]: "Sync ឥឡូវនេះ",
  },
  lastSynced: {
    [Locale.EN]: "Last synced",
    [Locale.KM]: "បាន sync ចុងក្រោយ",
  },
  pollInterval: {
    [Locale.EN]: "Poll interval",
    [Locale.KM]: "ចន្លោះពេលពិនិត្យ",
  },
  saveAndConnect: {
    [Locale.EN]: "Save & Connect",
    [Locale.KM]: "រក្សាទុក និងភ្ជាប់",
  },
  willConnectAfterCreating: {
    [Locale.EN]: "Will be connected after creating the agent.",
    [Locale.KM]: "នឹងត្រូវភ្ជាប់បន្ទាប់ពីបង្កើតភ្នាក់ងារ។",
  },
  emailAddressRequired: {
    [Locale.EN]: "Email address is required",
    [Locale.KM]: "ត្រូវបញ្ចូលអាសយដ្ឋានអ៊ីមែល",
  },
  imapHostRequired: {
    [Locale.EN]: "IMAP host is required",
    [Locale.KM]: "ត្រូវបញ្ចូល IMAP host",
  },
  imapCredentialsRequired: {
    [Locale.EN]: "IMAP credentials are required",
    [Locale.KM]: "ត្រូវបញ្ចូល IMAP credentials",
  },
  smtpHostRequired: {
    [Locale.EN]: "SMTP host is required",
    [Locale.KM]: "ត្រូវបញ្ចូល SMTP host",
  },
  smtpCredentialsRequired: {
    [Locale.EN]: "SMTP credentials are required",
    [Locale.KM]: "ត្រូវបញ្ចូល SMTP credentials",
  },
} as const satisfies Record<string, LocaleLabels>;

export const runtimeSelectCopy = {
  noRuntimes: agentFormCopy.noRuntimes,
  allOffline: {
    [Locale.EN]: "All runtimes offline",
    [Locale.KM]: "Runtime ទាំងអស់ក្រៅបណ្តាញ",
  },
  selectRuntime: {
    [Locale.EN]: "Select a runtime",
    [Locale.KM]: "ជ្រើសរើស Runtime",
  },
} as const satisfies Record<string, LocaleLabels>;

export function resolveWebLocale(locale?: string | null): WebLocale {
  return resolveLocale(locale);
}

export function webLabel(labels: LocaleLabels, locale?: string | null): string {
  return getLocalizedLabel(labels, locale);
}

export function runtimeSelectLabel(
  key: keyof typeof runtimeSelectCopy,
  locale?: string | null,
): string {
  return webLabel(runtimeSelectCopy[key], locale);
}

export function navigationLabel(
  key: keyof typeof webNavigationLabels,
  locale?: string | null,
): string {
  return webLabel(webNavigationLabels[key], locale);
}

export function onboardingLabel(
  key: keyof typeof onboardingCopy,
  locale?: string | null,
): string {
  return webLabel(onboardingCopy[key], locale);
}

export function appShellLabel(
  key: keyof typeof appShellCopy,
  locale?: string | null,
): string {
  return webLabel(appShellCopy[key], locale);
}

export function connectMachineLabel(
  key: keyof typeof connectMachineCopy,
  locale?: string | null,
): string {
  return webLabel(connectMachineCopy[key], locale);
}

export function agentFormLabel(
  key: keyof typeof agentFormCopy,
  locale?: string | null,
): string {
  return webLabel(agentFormCopy[key], locale);
}

export function formatAgentCount(count: number, locale?: string | null): string {
  const resolved = resolveWebLocale(locale);
  if (resolved === Locale.KM) return `${count} ${coreEntityLabels.agent[Locale.KM]}`;
  return `${count} agent${count === 1 ? "" : "s"}`;
}

export function issueStatusLabel(status: keyof typeof issueStatusLabels, locale?: string | null): string {
  return webLabel(issueStatusLabels[status], locale);
}

export function taskStatusLabel(status: keyof typeof taskStatusLabels, locale?: string | null): string {
  return webLabel(taskStatusLabels[status], locale);
}

export function taskTypeLabel(type: keyof typeof taskTypeLabels, locale?: string | null): string {
  return webLabel(taskTypeLabels[type], locale);
}

export function localeDisplayName(locale: WebLocale, displayLocale?: string | null): string {
  return webLabel(localeDisplayLabels[locale], displayLocale);
}
