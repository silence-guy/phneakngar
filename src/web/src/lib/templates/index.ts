export type {
  TemplatePreset,
  TemplateCategory,
  TemplateScenarioGroupId,
  TemplateFilterId,
  HelioScenarioTemplateId,
} from "./types";
export {
  TEMPLATE_CATEGORIES,
  HELIO_SCENARIO_TEMPLATE_IDS,
  TEMPLATE_SCENARIO_GROUP_ORDER,
} from "./types";
export {
  isHelioScenario,
  getTemplateGroups,
  filterTemplatesByChip,
  type TemplateGroup,
} from "./groups";

import { Locale, defaultLocale, resolveLocale } from "@phneakngar/shared";
import { dayPlanner } from "./presets/day-planner";
import { taskDigest } from "./presets/task-digest";
import { inboxAi } from "./presets/inbox-ai";
import { feedbackLoop } from "./presets/feedback-loop";
import { contentPipeline } from "./presets/content-pipeline";
import { researchBrief } from "./presets/research-brief";
import { openSourceMaintainer } from "./presets/open-source-maintainer";
import { indieHackerShipCrew } from "./presets/indie-hacker-ship-crew";
import { devopsMonitor } from "./presets/devops-monitor";
import { dailyNewsletterOperator } from "./presets/daily-newsletter-operator";
import { technicalBlogPipeline } from "./presets/technical-blog-pipeline";
import { socialMediaManager } from "./presets/social-media-manager";
import { executiveAssistant } from "./presets/executive-assistant";
import { researchAnalyst } from "./presets/research-analyst";
import { clientOps } from "./presets/client-ops";
import { weeklyReportBot } from "./presets/weekly-report-bot";

import type { TemplatePreset } from "./types";
import {
  KHMER_ROLE_DESCRIPTIONS,
  khmerInstructionsForRole,
  khmerRelationshipForRole,
  type AgentInstructionRole,
} from "@/lib/agent-instruction-km";

export const TEMPLATES: TemplatePreset[] = [
  dayPlanner,
  taskDigest,
  inboxAi,
  feedbackLoop,
  contentPipeline,
  researchBrief,
  openSourceMaintainer,
  indieHackerShipCrew,
  devopsMonitor,
  dailyNewsletterOperator,
  technicalBlogPipeline,
  socialMediaManager,
  executiveAssistant,
  researchAnalyst,
  clientOps,
  weeklyReportBot,
];

type TemplateCopy = Pick<
  TemplatePreset,
  "name" | "description" | "longDescription" | "features" | "useCases"
>;

const KHMER_TEMPLATE_COPY = {
  "day-planner": {
    name: "អ្នករៀបចំថ្ងៃ",
    description: "ទទួលខុសត្រូវ morning brief៖ កាលវិភាគ អាទិភាព និង digest មុនចាប់ផ្តើមថ្ងៃ។",
    longDescription:
      "ភ្នាក់ងារ Day Planner ដែលភ្ជាប់នឹង calendar រៀបចំ morning brief និងផ្ញើ digest ទៅ channel ដើម្បីឱ្យម្ចាស់ចាប់ផ្តើមថ្ងៃដោយច្បាស់អាទិភាព ការប្រជុំ និងការត្រៀម។",
    features: [
      "Morning brief ផ្អែកលើ calendar",
      "អាទិភាព ការប្រជុំ និង prep ច្បាស់",
      "ផ្ញើ digest ទៅ channel",
      "តាមដាន commitment មុនៗ",
      "កាត់សំឡេងរំខានក្នុងកាលវិភាគ",
      "លើកឡើងតែពេលត្រូវការសម្រេចចិត្ត",
    ],
    useCases: [
      { title: "Founder", description: "ចាប់ផ្តើមថ្ងៃដោយ brief តែមួយ ជំនួសការបើកឧបករណ៍ច្រើន។" },
      { title: "អ្នកប្រតិបត្តិការ", description: "មើលការប្រជុំ និងការងារសំខាន់ក្នុង channel post តែមួយ។" },
      { title: "ក្រុមតូច", description: "មានរូបភាពព្រឹករួម ដោយមិនចាំបាច់ standup យូរ។" },
    ],
  },
  "task-digest": {
    name: "សង្ខេបភារកិច្ច",
    description: "ស្កេន issue ផ្ញើ digest ទៅ channel និងទទួលខុសត្រូវការងារដែល blocked។",
    longDescription:
      "ភ្នាក់ងារ Task Digest ដែលមើល board ជាប្រចាំ claim ការងារដែលខ្លួនកំពុងដឹកនាំ តាមដាន blocked items និងផ្ញើ digest ច្បាស់អំពី progress, risk និងការសម្រេចចិត្តដែលត្រូវការ។",
    features: [
      "ស្កេន board តាម status រួមទាំង blocked",
      "ផ្ញើ digest progress និង risk ទៅ channel",
      "ទទួលខុសត្រូវ blocked items",
      "Claim ការងារដែលកំពុងដឹកនាំ",
      "រំលឹកការងារដែលឈប់ផ្លាស់ទី",
      "Handback ច្បាស់ពេលមនុស្សត្រូវសម្រេច",
    ],
    useCases: [
      { title: "ក្រុម product", description: "ជំនួស status meeting ដោយ task digest ជាប់លាប់។" },
      { title: "Founder ម្នាក់ឯង", description: "ដឹងថាអ្វីជាប់គាំងដោយមិនបើក board ជានិច្ច។" },
      { title: "Ops lead", description: "លើកឡើងតែពេលខ្វះ ownership ឬសេចក្តីសម្រេច។" },
    ],
  },
  "inbox-ai": {
    name: "Inbox AI",
    description: "តម្រៀបអ៊ីមែល ព្រាងចម្លើយ និងមិនផ្ញើអ៊ីមែលសំខាន់ដោយគ្មានការអនុម័ត។",
    longDescription:
      "ភ្នាក់ងារ Inbox AI ដែលមានអត្តសញ្ញាណអ៊ីមែលពិត តម្រៀបសារចូល ព្រាងចម្លើយ តាមដាន follow-up និងដាក់ outbound mail ក្នុង approval queue មុនផ្ញើ។",
    features: [
      "តម្រៀបអ៊ីមែលតាម urgency និង importance",
      "ព្រាងចម្លើយតាម tone របស់អ្នកផ្ញើ",
      "ផ្ញើ outbound តែបន្ទាប់ពី human approval",
      "តាមដាន thread ដែលត្រូវ follow-up",
      "Daily inbox digest",
      "លើកឡើង pricing, legal និងហានិភ័យទំនាក់ទំនង",
    ],
    useCases: [
      { title: "Founder", description: "ឱ្យ inbox រត់បន្ត ដោយមិនជាប់អ៊ីមែលពេញមួយថ្ងៃ។" },
      { title: "តួនាទីបម្រើ client", description: "មាន draft រង់ចាំ approve ជំនួសភាពស្ងៀម។" },
      { title: "ក្រុមតូច", description: "មានស្តង់ដារ triage និង approval gate ច្បាស់។" },
    ],
  },
  "feedback-loop": {
    name: "រង្វិលជុំមតិ",
    description: "ប្រមូលមតិផលិតផល ក្រុមតាម theme និងផ្ញើ digest សម្រេចចិត្តទៅ channel។",
    longDescription:
      "ភ្នាក់ងារ Feedback Loop ដែលស្កេនមតិ និង issue ជាប្រចាំ ក្រុម theme តាម frequency និង severity រួចផ្ញើ digest ច្បាស់ទៅ channel ដើម្បីឱ្យមនុស្សសម្រេចចិត្តដោយមិនលង់ក្នុង noise។",
    features: [
      "ប្រមូល និងក្រុមមតិផលិតផល",
      "Theme និង severity callout",
      "Channel digest សម្រាប់សម្រេចចិត្ត",
      "ស្នើ owner / issue ថ្មី",
      "លុបសញ្ញា weak-signal ស្ងៀម",
    ],
    useCases: [
      { title: "ក្រុម product", description: "មើល theme មតិដោយមិនអាន ticket រាល់ថ្ងៃ។" },
      { title: "Founder", description: "រក្សារង្វិលជុំពីសំឡេងអ្នកប្រើទៅសម្រេចចិត្ត។" },
    ],
  },
  "content-pipeline": {
    name: "បំពង់ខ្លឹមសារ",
    description: "តាមដាន research → draft → review → publish និងផ្ញើ digest editorial ទៅ channel។",
    longDescription:
      "ភ្នាក់ងារ Content Pipeline ដែលធ្វើឱ្យ board editorial ច្បាស់៖ អ្វីរួចស្រេច publish អ្វីជាប់ review និងអ្វីនៅតែ research — ជា channel post ដែលអាចស្កេនបាន។",
    features: [
      "Digest តាម stage editorial",
      "Ready-to-publish callout",
      "Flag draft ចាស់/ជាប់",
      "Channel delivery សម្រាប់ visibility",
      "Escalate តែពេលត្រូវ human review",
    ],
    useCases: [
      { title: "Content lead", description: "មើលសុខភាព pipeline ដោយមិនបើក draft រាល់ឯកសារ។" },
      { title: "Creator ម្នាក់ឯង", description: "រក្សា cadence publish ជាមួយ board check ប្រចាំថ្ងៃ។" },
    ],
  },
  "research-brief": {
    name: "សង្ខេបស្រាវជ្រាវ",
    description: "បង្កើត brief មានប្រភព និងផ្ញើសំណួរ/next probe ទៅ channel។",
    longDescription:
      "ភ្នាក់ងារ Research Brief ដែលបំលែងសំណួរបើកទៅជា brief ខ្លីមានប្រភព — findings, contradiction និង next probe — ដើម្បីឱ្យមនុស្សសម្រេចចិត្តដោយមិនអាន note ទាំងអស់ឡើងវិញ។",
    features: [
      "រចនាសម្ព័ន្ធ research brief",
      "Finding មានប្រភពពេល context ផ្តល់",
      "Open question និង next probe",
      "Channel delivery សម្រាប់ orientation",
      "មិនបង្កើត citation ក្លែង",
    ],
    useCases: [
      { title: "Analyst", description: "បំលែង note រញ៉េរញ៉ៃទៅ brief សម្រេចចិត្ត។" },
      { title: "Founder", description: "ទទួល pulse ស្រាវជ្រាវប្រចាំសប្តាហ៍ដោយមិនត្រូវ report ពេញ។" },
    ],
  },
  "open-source-maintainer": {
    name: "អ្នកថែទាំគម្រោង Open Source",
    description: "ជួយតម្រៀបបញ្ហា ពិនិត្យ PR សរសេរ changelog និងគ្រប់គ្រង release។",
    longDescription:
      "ក្រុមភ្នាក់ងារ AI សម្រាប់ថែទាំគម្រោង open source៖ ដឹកនាំការតម្រៀប issue និង PR ស្រាវជ្រាវបញ្ហា ពិនិត្យកូដ និងរៀបចំ release notes ដោយរក្សា command, file path, API name និង status value ដើម។",
    features: [
      "តម្រៀប issue និង PR ជាភាសាខ្មែរ",
      "ពិនិត្យកូដ និងផ្ទៀងផ្ទាត់តេស្ត",
      "សង្ខេប discussion និង bug reproduction",
      "រៀបចំ changelog និង release checklist",
    ],
    useCases: [
      { title: "អ្នកថែទាំម្នាក់ឯង", description: "រក្សាគម្រោងឱ្យឆ្លើយតបបានលឿនដោយមិនលើសកម្លាំង។" },
      { title: "ក្រុមតូច", description: "បន្ថែម first-pass review និង context gathering ជាមួយក្រុមមនុស្ស។" },
    ],
  },
  "indie-hacker-ship-crew": {
    name: "ក្រុម Ship សម្រាប់ Indie Hacker",
    description: "ជួយសម្រេចគំនិត ផែនការ កូដ ការបោះផ្សាយ និងការសិក្សាពីអ្នកប្រើ។",
    longDescription:
      "ក្រុម AI សម្រាប់ founder ឬ maker ដែលចង់ ship ឱ្យលឿន៖ បំបែកគំនិតទៅជា plan, build, launch, feedback loop ហើយសង្ខេបលទ្ធផលជាភាសាខ្មែរ។",
    features: [
      "បំបែកគំនិតទៅជា task តូចៗ",
      "ជួយកូដ និងផ្ទៀងផ្ទាត់ release",
      "រៀបចំ launch copy និង follow-up",
      "សង្ខេប feedback និង next action",
    ],
    useCases: [
      { title: "Founder ម្នាក់ឯង", description: "មានក្រុម AI តូចសម្រាប់គិត បង្កើត និងបោះផ្សាយ។" },
      { title: "MVP ថ្មី", description: "បង្កើតផែនការ build-measure-learn ជាភាសាខ្មែរ។" },
    ],
  },
  "devops-monitor": {
    name: "អ្នកត្រួតពិនិត្យ DevOps",
    description: "តាមដាន alert, incident, release risk និងរៀបចំសេចក្តីរាយការណ៍ប្រតិបត្តិការ។",
    longDescription:
      "ក្រុម AI សម្រាប់ DevOps និង site reliability៖ សង្ខេប signal ពី alert, log, deployment និង incident ដោយរក្សា command, log, metric name និង service name ដើម។",
    features: [
      "សង្ខេប alert និង incident context",
      "ជួយរៀបចំ runbook action",
      "តាមដាន release និង regression risk",
      "រាយការណ៍ status ជាភាសាខ្មែរ",
    ],
    useCases: [
      { title: "On-call rotation", description: "ធ្វើឱ្យ alert ច្បាស់ និងអាចអនុវត្តបាន។" },
      { title: "Release monitoring", description: "សង្ខេបហានិភ័យ និង next step បន្ទាប់ពី deploy។" },
    ],
  },
  "daily-newsletter-operator": {
    name: "ប្រតិបត្តិករ Newsletter ប្រចាំថ្ងៃ",
    description: "ស្រាវជ្រាវ តម្រៀប សរសេរ និងរៀបចំ newsletter ប្រចាំថ្ងៃ។",
    longDescription:
      "ក្រុម AI សម្រាប់ newsletter៖ ស្រាវជ្រាវប្រភពថ្មីៗ តម្រៀបអត្ថបទសំខាន់ សរសេរ summary និងរៀបចំការផ្ញើអ៊ីមែលជាភាសាខ្មែរ។",
    features: [
      "ស្រាវជ្រាវ និងតម្រៀបប្រភព",
      "សរសេរ digest ខ្លី និងច្បាស់",
      "រៀបចំ subject line និង email body",
      "តាមដានអ្វីដែលបាន publish",
    ],
    useCases: [
      { title: "Newsletter niche", description: "បង្កើត digest រាល់ថ្ងៃដោយមាន citation និង judgment។" },
      { title: "Team update", description: "សង្ខេបព័ត៌មានសំខាន់សម្រាប់ក្រុមជាភាសាខ្មែរ។" },
    ],
  },
  "technical-blog-pipeline": {
    name: "បំពង់ការងារ Technical Blog",
    description: "ស្រាវជ្រាវ ព្រាង ពិនិត្យ និងបោះផ្សាយអត្ថបទបច្ចេកទេស។",
    longDescription:
      "ក្រុម AI សម្រាប់ technical content៖ ស្រាវជ្រាវ code/docs, រៀបចំ outline, សរសេរ draft និងពិនិត្យភាពត្រឹមត្រូវ ដោយរក្សា code identifier និង command ដើម។",
    features: [
      "បង្កើត outline និង draft",
      "ពិនិត្យ technical accuracy",
      "រៀបចំ code snippet និង citation",
      "តាមដាន publication workflow",
    ],
    useCases: [
      { title: "Developer blog", description: "បង្កើតអត្ថបទបច្ចេកទេសដែលច្បាស់ និងបានផ្ទៀងផ្ទាត់។" },
      { title: "Documentation article", description: "បំលែងការរកឃើញបច្ចេកទេសទៅជាមាតិកាអាចអានបាន។" },
    ],
  },
  "social-media-manager": {
    name: "អ្នកគ្រប់គ្រងបណ្តាញសង្គម",
    description: "រៀបចំគំនិតមាតិកា សរសេរ post និងតាមដាន calendar បោះផ្សាយ។",
    longDescription:
      "ក្រុម AI សម្រាប់ social media៖ ស្រាវជ្រាវ signal, បង្កើត post ideas, សរសេរ caption និងរៀបចំ schedule ជាភាសាខ្មែរ ឬភាសារបស់ audience។",
    features: [
      "បង្កើត content calendar",
      "សរសេរ post និង caption",
      "កែសម្រួល tone តាម platform",
      "សង្ខេប performance insight",
    ],
    useCases: [
      { title: "Creator workflow", description: "រក្សាការបោះផ្សាយឱ្យជាប់លាប់។" },
      { title: "Startup updates", description: "ប្រែក្លាយការងារក្រុមទៅជា post ដែលអាចផ្សព្វផ្សាយបាន។" },
    ],
  },
  "executive-assistant": {
    name: "ជំនួយការប្រតិបត្តិ",
    description: "ជួយអ៊ីមែល កាលវិភាគ ការសង្ខេប និងការតាមដានការងារសំខាន់។",
    longDescription:
      "ជំនួយការ AI សម្រាប់ការងារប្រតិបត្តិ៖ សរសេរ និងសង្ខេបអ៊ីមែល រៀបចំ meeting context តាមដាន follow-up និងរក្សាព័ត៌មានសំខាន់ឱ្យច្បាស់ជាភាសាខ្មែរ។",
    features: [
      "សង្ខេប inbox និង meeting notes",
      "រៀបចំ draft email និង follow-up",
      "ជួយកំណត់អាទិភាពការងារ",
      "រក្សា action items ឱ្យច្បាស់",
    ],
    useCases: [
      { title: "Founder assistant", description: "ជួយកាត់បន្ថយការងារអ៊ីមែល និង scheduling។" },
      { title: "Team coordination", description: "តាមដាន action items និង next steps ជាប្រចាំ។" },
    ],
  },
  "research-analyst": {
    name: "អ្នកវិភាគស្រាវជ្រាវ",
    description: "តាមដានគូប្រកួត និន្នាការ និងរៀបចំ research digest ជាភាសាខ្មែរ។",
    longDescription:
      "ក្រុម AI សម្រាប់ market intelligence៖ ស្រាវជ្រាវប្រភពសាធារណៈ តាមដានគូប្រកួត បែងចែក fact និង interpretation ហើយផ្ញើ insight ដែលអាចអនុវត្តបាន។",
    features: [
      "តាមដាន competitor និង market signal",
      "វាយតម្លៃភាពជឿទុកចិត្តប្រភព",
      "សរសេរ digest និង deep-dive report",
      "ផ្ដល់ recommended actions",
    ],
    useCases: [
      { title: "Product team", description: "យល់ពីចលនាគូប្រកួត និងនិន្នាការផលិតផល។" },
      { title: "Founder strategy", description: "ទទួលបាន signal សំខាន់សម្រាប់សម្រេចចិត្ត។" },
    ],
  },
  "client-ops": {
    name: "ប្រតិបត្តិការអតិថិជន",
    description: "គ្រប់គ្រងសារ client, follow-up, deliverable និង status update។",
    longDescription:
      "ក្រុម AI សម្រាប់ client operations៖ រៀបចំ request, សង្ខេប context, draft response, តាមដាន deliverable និងជួយឱ្យការទំនាក់ទំនងជាភាសាខ្មែរ ឬភាសារបស់ client មានស្ថេរភាព។",
    features: [
      "សង្ខេប client context",
      "រៀបចំ response និង follow-up",
      "តាមដាន deliverable និង blocker",
      "បង្កើត weekly status update",
    ],
    useCases: [
      { title: "Agency workflow", description: "រក្សា client communication ឱ្យច្បាស់ និងទាន់ពេល។" },
      { title: "Freelancer delivery", description: "តាមដាន scope, deadline និង next step។" },
    ],
  },
  "weekly-report-bot": {
    name: "ភ្នាក់ងារ Report ប្រចាំសប្តាហ៍",
    description: "ប្រមូលការអាប់ដេត សង្ខេប progress និងផ្ញើ report ប្រចាំសប្តាហ៍។",
    longDescription:
      "ក្រុម AI សម្រាប់ weekly reporting៖ ប្រមូល signal ពី task, email, meeting និង notes សង្ខេប progress/blocker/next step ហើយរៀបចំ report ជាភាសាខ្មែរ។",
    features: [
      "ប្រមូល progress ពីប្រភពជាច្រើន",
      "សង្ខេប blocker និង next action",
      "រៀបចំ executive summary",
      "ផ្ញើ report តាម cadence",
    ],
    useCases: [
      { title: "Team updates", description: "ទទួលបានសេចក្តីសង្ខេបសប្តាហ៍ដែលអាចអានបានលឿន។" },
      { title: "Client reporting", description: "បង្កើត report ជាប់លាប់សម្រាប់ stakeholder។" },
    ],
  },
} as const satisfies Record<string, TemplateCopy>;

type KhmerTemplateId = keyof typeof KHMER_TEMPLATE_COPY;

function isKhmerTemplateId(id: string): id is KhmerTemplateId {
  return id in KHMER_TEMPLATE_COPY;
}

function localizeTemplate(template: TemplatePreset, locale?: string | null): TemplatePreset {
  if (resolveLocale(locale) !== Locale.KM || !isKhmerTemplateId(template.id)) return template;
  const copy = KHMER_TEMPLATE_COPY[template.id];
  return {
    ...template,
    ...copy,
    members: template.members.map((member) => {
      const role = member.role as AgentInstructionRole;
      return {
        ...member,
        description: KHMER_ROLE_DESCRIPTIONS[role],
        instructions: khmerInstructionsForRole(role),
        relationship:
          khmerRelationshipForRole(role) ??
          (member.relationship
            ? `រាយការណ៍ជាភាសាខ្មែរ។ រក្សា acceptance criteria, CLI commands, JSON keys, file paths, និង status values ឱ្យត្រឹមត្រូវ។\n\n${member.relationship}`
            : undefined),
      };
    }),
  };
}

export const TEMPLATES_KM: TemplatePreset[] = TEMPLATES.map((template) =>
  localizeTemplate(template, Locale.KM),
);

export function getTemplates(locale: string | null = defaultLocale): TemplatePreset[] {
  return resolveLocale(locale) === Locale.KM ? TEMPLATES_KM : TEMPLATES;
}

export function getTemplateById(
  id: string,
  locale: string | null = defaultLocale,
): TemplatePreset | undefined {
  return getTemplates(locale).find((t) => t.id === id);
}
