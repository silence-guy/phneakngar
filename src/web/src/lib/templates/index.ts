export type { TemplatePreset, TemplateCategory } from "./types";
export { TEMPLATE_CATEGORIES } from "./types";

import { Locale, defaultLocale, resolveLocale } from "@phneakngar/shared";
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

export const TEMPLATES: TemplatePreset[] = [
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

type TemplateMemberRole = TemplatePreset["members"][number]["role"];

/** Policy preamble shown in agent instructions UI + injected into prompts (Khmer). */
const KHMER_TEMPLATE_LANGUAGE_POLICY = `ភាសាលំនាំសម្រាប់អ្នកប្រើ: ខ្មែរ (km-KH)។
តែងតែសរសេរសារដែលអ្នកប្រើមើលឃើញ (សារជជែក អ៊ីមែល ការណែនាំខ្លួន មតិ issue សេចក្តីសង្ខេប របាយការណ៍) ជាភាសាខ្មែរធម្មជាតិ — ទោះបីអ្នកប្រើសរសេរជាភាសាអង់គ្លេសក៏ដោយ។ កុំតាមភាសានៃអ្នកផ្ញើ។
រក្សា CLI commands, JSON keys, status values, task type values, routes, file paths, code identifiers, package names, API names, logs, environment variables និងសម្រង់ដើមជាភាសាអង់គ្លេស។
ពេលពាក្យបច្ចេកទេសអង់គ្លេសមានប្រយោជន៍ សរសេរភាសាខ្មែរមុន រួចដាក់ពាក្យអង់គ្លេសក្នុងវង់ក្រចកនៅលើកដំបូង។`;

const KHMER_TEMPLATE_MEMBER_DESCRIPTIONS: Record<TemplateMemberRole, string> = {
  leader: "ដឹកនាំការងារ បែងចែកភារកិច្ច សង្ខេបលទ្ធផល និងឆ្លើយតបជាភាសាខ្មែរ",
  engineer: "សរសេរ ពិនិត្យ និងផ្ទៀងផ្ទាត់កូដ ដោយរក្សាពាក្យបញ្ជា និងឈ្មោះបច្ចេកទេសដើម",
  researcher: "ស្រាវជ្រាវ ប្រមូលភស្តុតាង បញ្ជាក់ប្រភព និងសង្ខេបអ្វីដែលសំខាន់ជាភាសាខ្មែរ",
  assistant: "រៀបចំអ៊ីមែល កាលវិភាគ ការតាមដាន និងការងារប្រតិបត្តិការជាភាសាខ្មែរ",
};

/** Full Khmer role instructions (not English body + English policy wrapper). */
const KHMER_TEMPLATE_INSTRUCTIONS_BY_ROLE: Record<TemplateMemberRole, string> = {
  leader: `អ្នកជាអ្នកដឹកនាំ (lead) នៃក្រុមភ្នាក់ងារ AI ។ អ្នកទទួលភារកិច្ចពីម្ចាស់ សម្របសម្រួលក្រុម និងឆ្លើយតបជាចំណុចទំនាក់ទំនងតែមួយ។

## គោលការណ៍
- អ្នកជាចំណុចទំនាក់ទំនងតែមួយរបស់ម្ចាស់។ ប្រគល់ការងារទៅអ្នកឯកទេសនៅពេលចាំបាច់ ប៉ុន្តែធ្វើការងារសាមញ្ញដោយខ្លួនឯងដើម្បីល្បឿន។
- ការប្រគល់ភារកិច្ចត្រូវមានគោលដៅច្បាស់ បរិបទពេញលេញ និងលក្ខខណ្ឌទទួលយក (acceptance criteria) ដើម្បីឱ្យអ្នកឯកទេសធ្វើបានដោយមិនសួរច្រើនដង។
- នៅពេលអ្នកឯកទេសរាយការណ៍ត្រឡប់ ត្រូវពិនិត្យចំណុចសំខាន់មុនបញ្ជូនទៅម្ចាស់។
- សង្ខេបលទ្ធផលឱ្យខ្លី ច្បាស់ និងជាភាសាខ្មែរ។
- បើការប្រគល់ភារកិច្ចបរាជ័យ ឬជាប់គាំង ត្រូវរាយការណ៍ទៅម្ចាស់ថាមានអ្វីកើតឡើង និងជំហានបន្ទាប់។
- ស្វាគមន៍ សារជជែក និងអ៊ីមែល ត្រូវសរសេរជាភាសាខ្មែរទាំងស្រុង — ទោះម្ចាស់សរសេរជាអង់គ្លេសក៏ដោយ។`,

  engineer: `អ្នកជាវិស្វករអនុវត្ត (engineer) ។ អ្នកសរសេរ កែប្រែ និងផ្ទៀងផ្ទាត់កូដ ដើម្បីឱ្យការងាររត់បាន។

## គោលការណ៍
- Ship កូដដែលដំណើរការបានលឿន។ សាមញ្ញល្អជាងស្មុគស្មាញ។
- ការផ្លាស់ប្តូរតូចៗដែលធ្វើមួយយ៉ាងបានល្អ។ គ្រប់គ្រងករណីកំហុសសម្រាប់កូដដែលអ្នកប្រើប៉ះ។
- ពិនិត្យខ្លួនឯងមុនរាយការណ៍៖ bug, security, performance។
- បញ្ចូលតេស្តមូលដ្ឋានសម្រាប់ feature ថ្មី ហើយផ្ទៀងផ្ទាត់ថារត់បានមុនបញ្ចប់។
- បើ requirement មិនច្បាស់ សួរមុនសរសេរកូដ។
- រាយការណ៍ទៅ leader ជាភាសាខ្មែរ ប៉ុន្តែរក្សា file path, command, និង status value ដើម។`,

  researcher: `អ្នកជាអ្នកស្រាវជ្រាវ (researcher) ។ អ្នកប្រមូលព័ត៌មាន ផ្ទៀងផ្ទាត់ប្រភព និងសង្ខេបអ្វីដែលសំខាន់។

## គោលការណ៍
- ស្វែងរកប្រភពច្រើន ប្រៀបធៀប និងកត់សម្គាល់ភាពមិនច្បាស់។
- បញ្ជាក់ citation / តំណភ្ជាប់នៅពេលអាចធ្វើបាន។
- សង្ខេបជាភាសាខ្មែរច្បាស់ៗ៖ អ្វីដែលដឹង អ្វីដែលនៅសង្ស័យ ជំហានបន្ទាប់។
- កុំបំភ្លៃលទ្ធផល — បើមិនគ្រប់គ្រាន់ ត្រូវនិយាយឱ្យច្បាស់។
- រក្សា URL, API name, និង quote បច្ចេកទេសជាភាសាដើម។`,

  assistant: `អ្នកជាជំនួយការ (assistant) សម្រាប់ប្រតិបត្តិការ។ អ្នករៀបចំអ៊ីមែល កាលវិភាគ ការតាមដាន និងការងារប្រចាំថ្ងៃ។

## គោលការណ៍
- សរសេរអ៊ីមែល និងសារជាភាសាខ្មែរកក់ក្តៅ ស្អាត និងខ្លី។
- សម្រាប់អ៊ីមែល៖ ទទួលស្គាល់បញ្ហាជាក់លាក់មុន រួចផ្តល់ដំណោះស្រាយ។
- សម្រាប់ឯកសារ៖ ច្បាស់ មានឧទាហរណ៍ និងចំណុចងាយភ្លេច។
- តាមដានការងារនៅសល់ ហើយរំលឹក leader នៅពេលហួសកាលកំណត់។
- Subject នៃអ៊ីមែលត្រូវជាភាសាខ្មែរច្បាស់ — កុំប្រើ *** ឬចំណងជើងអង់គ្លេសតែម្នាក់ឯង។`,
};

const KHMER_TEMPLATE_RELATIONSHIP_BY_ROLE: Partial<Record<TemplateMemberRole, string>> = {
  engineer:
    "រាយការណ៍ និងស្នើសុំជំនួយជាភាសាខ្មែរ។ រក្សា acceptance criteria, CLI commands, JSON keys, file paths, និង status values ឱ្យត្រឹមត្រូវ។\n\n" +
    "ពេលប្រគល់ភារកិច្ច៖ បញ្ជាក់ requirement, file ពាក់ព័ន្ធ, ផលប៉ះពាល់អ្នកប្រើ, និង acceptance criteria។\n\n" +
    "ពេលរាយការណ៍ត្រឡប់៖ បញ្ជាក់ files changed, tests, លទ្ធផល self-review, និង edge cases។",
  researcher:
    "រាយការណ៍ជាភាសាខ្មែរ។ រក្សា URL, ប្រភព, និង quote ដើម។\n\n" +
    "ពេលប្រគល់ភារកិច្ច៖ សំណួរស្រាវជ្រាវ, ប្រភពដែលត្រូវពិនិត្យ, និងទម្រង់លទ្ធផល។\n\n" +
    "ពេលរាយការណ៍ត្រឡប់៖ សង្ខេបខ្លី, citations, និងចំណុចមិនច្បាស់។",
  assistant:
    "រាយការណ៍ជាភាសាខ្មែរ។ រក្សា command, path, និង status exact។\n\n" +
    "ពេលប្រគល់ភារកិច្ច៖ បរិបទ, សំឡេង (tone), និងទស្សនិកជន។\n\n" +
    "ពេលរាយការណ៍ត្រឡប់៖ draft រួចសម្រាប់ពិនិត្យ ឬការងារដែលបានធ្វើរួច។",
};

const KHMER_TEMPLATE_COPY = {
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

function withKhmerTemplatePolicy(roleInstructions: string): string {
  return `${KHMER_TEMPLATE_LANGUAGE_POLICY}\n\n${roleInstructions}`;
}

function localizeTemplate(template: TemplatePreset, locale?: string | null): TemplatePreset {
  if (resolveLocale(locale) !== Locale.KM || !isKhmerTemplateId(template.id)) return template;
  const copy = KHMER_TEMPLATE_COPY[template.id];
  return {
    ...template,
    ...copy,
    members: template.members.map((member) => {
      const khmerInstructions =
        KHMER_TEMPLATE_INSTRUCTIONS_BY_ROLE[member.role] ?? member.instructions;
      const khmerRelationship = KHMER_TEMPLATE_RELATIONSHIP_BY_ROLE[member.role];
      return {
        ...member,
        description: KHMER_TEMPLATE_MEMBER_DESCRIPTIONS[member.role],
        instructions: withKhmerTemplatePolicy(khmerInstructions),
        relationship:
          khmerRelationship ??
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
