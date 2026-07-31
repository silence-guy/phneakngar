import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

export type PrivacyListItem = string | { lead: string; rest: string };

export type PrivacyBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "h4"; text: string }
  | { kind: "ul"; items: PrivacyListItem[] }
  | { kind: "cloudflare"; before: string; after: string }
  | { kind: "contact"; before: string; email: string; after: string };

export type PrivacySection = {
  heading: string;
  blocks: PrivacyBlock[];
};

export type PrivacyLabels = {
  title: string;
  lastUpdated: string;
  sections: PrivacySection[];
};

export const PRIVACY_LABELS = {
  [Locale.KM]: {
    title: "គោលការណ៍ឯកជនភាព",
    lastUpdated: "ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ៖ ១១ កក្កដា ២០២៦",
    sections: [
      {
        heading: "ការបកស្រាយ និងនិយមន័យ",
        blocks: [
          {
            kind: "p",
            text: "ក្នុងគោលការណ៍ឯកជនភាពនេះ \"ក្រុមហ៊ុន\" (ហៅថា \"យើង\" ឬ \"របស់យើង\") សំដៅលើ ភ្នាក់ងារ AI។ \"សេវាកម្ម\" សំដៅលើវេទិកា ភ្នាក់ងារ។ \"អ្នក\" សំដៅលើបុគ្គលដែលចូលប្រើ ឬប្រើប្រាស់សេវាកម្មរបស់យើង។ \"ទិន្នន័យផ្ទាល់ខ្លួន\" គឺជាព័ត៌មានណាមួយដែលទាក់ទងនឹង បុគ្គលដែលអាចកំណត់អត្តសញ្ញាណបាន។",
          },
        ],
      },
      {
        heading: "ការប្រមូល និងប្រើប្រាស់ទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នក",
        blocks: [
          { kind: "h3", text: "ប្រភេទទិន្នន័យដែលប្រមូល" },
          { kind: "h4", text: "ទិន្នន័យផ្ទាល់ខ្លួន" },
          {
            kind: "p",
            text: "នៅពេលប្រើសេវាកម្មរបស់យើង យើងអាចស្នើសុំព័ត៌មានដែលអាចកំណត់អត្តសញ្ញាណបុគ្គលបាន ដើម្បីទំនាក់ទំនង ឬកំណត់អត្តសញ្ញាណអ្នក រួមមានប៉ុន្តែមិនកំណត់ត្រឹម៖",
          },
          {
            kind: "ul",
            items: ["អាសយដ្ឋានអ៊ីមែល", "ឈ្មោះ", "ទិន្នន័យការប្រើប្រាស់"],
          },
          { kind: "h4", text: "ទិន្នន័យការប្រើប្រាស់" },
          {
            kind: "p",
            text: "ទិន្នន័យការប្រើប្រាស់ត្រូវបានប្រមូលដោយស្វ័យប្រវត្តិនៅពេលប្រើសេវាកម្ម។ វាអាចរួមមាន អាសយដ្ឋាន IP របស់ឧបករណ៍ ប្រភេទ និងកំណែកម្មវិធីរុករក ទំព័រនៃសេវាកម្មដែលអ្នកចូលមើល ពេលវេលា និងកាលបរិច្ឆេទនៃការចូលមើល រយៈពេលដែលចំណាយលើទំព័រនីមួយៗ និងទិន្នន័យ វិភាគ/វិភាគស្ថានភាពផ្សេងទៀត។",
          },
          { kind: "h4", text: "ព័ត៌មានពីការចូលតាមសេវាភាគីទីបី" },
          {
            kind: "p",
            text: "ភ្នាក់ងារ អនុញ្ញាតឱ្យអ្នកបង្កើតគណនី និងចូលតាមសេវាភាគីទីបី រួមមាន Google។ ប្រសិនបើអ្នក ជ្រើសចុះឈ្មោះ ឬផ្តល់សិទ្ធិចូលប្រើសេវាភាគីទីបី យើងអាចប្រមូលទិន្នន័យផ្ទាល់ខ្លួនដែលភ្ជាប់ នឹងគណនីនោះរួចហើយ ដូចជាឈ្មោះ និងអាសយដ្ឋានអ៊ីមែល។",
          },
          { kind: "h4", text: "បច្ចេកវិទ្យាតាមដាន និងខូគី" },
          {
            kind: "p",
            text: "យើងប្រើខូគី និងបច្ចេកវិទ្យាតាមដានស្រដៀងគ្នា ដើម្បីតាមដានសកម្មភាពលើសេវាកម្ម និងរក្សាទុក ព័ត៌មានមួយចំនួន។ ទាំងនេះប្រើសម្រាប់វិភាគនិន្នាការ គ្រប់គ្រងគេហទំព័រ និងប្រមូលព័ត៌មាន ប្រជាសាស្ត្រ។ អ្នកអាចកំណត់កម្មវិធីរុករកឱ្យបដិសេធខូគីទាំងអស់ ឬជូនដំណឹងនៅពេលខូគីត្រូវ បានផ្ញើ។",
          },
        ],
      },
      {
        heading: "ការប្រើប្រាស់ទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នក",
        blocks: [
          { kind: "p", text: "យើងអាចប្រើទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកសម្រាប់គោលបំណងដូចខាងក្រោម៖" },
          {
            kind: "ul",
            items: [
              { lead: "ផ្តល់ និងថែទាំសេវាកម្ម", rest: " រួមទាំងដំណើរការ និងបញ្ជូនភារកិច្ចភ្នាក់ងារ AI ក្នុងនាមអ្នក។" },
              { lead: "គ្រប់គ្រងគណនីរបស់អ្នក", rest: " និងផ្តល់សិទ្ធិចូលប្រើមុខងារសម្រាប់អ្នកប្រើដែលបាន ចុះឈ្មោះ។" },
              { lead: "ទំនាក់ទំនងអ្នក", rest: " តាមអ៊ីមែល ឬទម្រង់ទំនាក់ទំនងអេឡិចត្រូនិកស្រដៀងគ្នា អំពីបច្ចុប្បន្នភាព ឬព័ត៌មានទាក់ទងសេវាកម្ម។" },
              { lead: "គ្រប់គ្រងសំណើរបស់អ្នក", rest: " និងឆ្លើយតបសំណើណាមួយដែលអ្នកផ្ញើមកយើង។" },
              { lead: "សម្រាប់ការផ្ទេរអាជីវកម្ម", rest: " ទាក់ទងនឹងការរួមបញ្ចូល លក់ទ្រព្យសកម្ម ហិរញ្ញប្បទាន ឬទិញយកផ្នែកណាមួយនៃអាជីវកម្មរបស់យើង។" },
              { lead: "គោលបំណងផ្សេងទៀត", rest: " ដូចជាវិភាគទិន្នន័យ កំណត់និន្នាការប្រើប្រាស់ និងកែលម្អសេវាកម្ម។" },
            ],
          },
        ],
      },
      {
        heading: "ការចែករំលែកទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នក",
        blocks: [
          { kind: "p", text: "យើងអាចចែករំលែកព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នកក្នុងស្ថានភាពដូចខាងក្រោម៖" },
          {
            kind: "ul",
            items: [
              { lead: "ជាមួយអ្នកផ្តល់សេវា៖", rest: " យើងចែករំលែកទិន្នន័យជាមួយអ្នកផ្តល់ម៉ូដែល AI ភាគីទីបី ដើម្បីដំណើរការសមត្ថភាពភ្នាក់ងារ។ ទិន្នន័យដែលផ្ញើទៅអ្នកផ្តល់ទាំងនោះ ស្ថិតក្រោមគោលការណ៍ឯកជនភាពរបស់ពួកគេ។ យើងកាត់បន្ថយទិន្នន័យដែលចែករំលែក និងផ្ញើតែអ្វីដែលចាំបាច់សម្រាប់សំណើរបស់អ្នក។" },
              { lead: "សម្រាប់ការផ្ទេរអាជីវកម្ម៖", rest: " ក្នុងករណីរួមបញ្ចូល ទិញយក ឬលក់ទ្រព្យសកម្ម ទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកអាចត្រូវបានផ្ទេរ។" },
              { lead: "ដោយការយល់ព្រមរបស់អ្នក៖", rest: " យើងអាចបង្ហាញព័ត៌មានផ្ទាល់ខ្លួនសម្រាប់ គោលបំណងផ្សេងទៀត ប្រសិនបើអ្នកយល់ព្រម។" },
            ],
          },
          { kind: "p", text: "យើងមិនលក់ទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកទៅភាគីទីបីទេ។" },
        ],
      },
      {
        heading: "រយៈពេលរក្សាទុកទិន្នន័យផ្ទាល់ខ្លួន",
        blocks: [
          {
            kind: "p",
            text: "យើងរក្សាទុកទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកតែរយៈពេលដែលចាំបាច់សម្រាប់គោលបំណងដែលបាន កំណត់ក្នុងគោលការណ៍នេះ។ យើងរក្សា និងប្រើទិន្នន័យតាមកម្រិតចាំបាច់ ដើម្បីគោរព កាតព្វកិច្ចផ្លូវច្បាប់ ដោះស្រាយវិវាទ និងអនុវត្តកិច្ចព្រមព្រៀងរបស់យើង។",
          },
          {
            kind: "p",
            text: "ទិន្នន័យការប្រើប្រាស់ជាទូទៅត្រូវរក្សាទុករយៈពេលខ្លីជាង លើកលែងតែនៅពេលប្រើ ដើម្បីពង្រឹងសុវត្ថិភាព ឬកែលម្អមុខងារសេវាកម្ម។",
          },
        ],
      },
      {
        heading: "ទីតាំងទិន្នន័យ និងហេដ្ឋារចនាសម្ព័ន្ធ",
        blocks: [
          {
            kind: "cloudflare",
            before: "សេវាកម្មដែលយើងហូស (hosted) ដំណើរការលើ ",
            after: " ។ ទិន្នន័យកម្មវិធីចម្បង (គណនី លំហការងារ សារ និងកំណត់ត្រាគ្រប់គ្រងពាក់ព័ន្ធ) ត្រូវបានរក្សាទុកក្នុងតំបន់ អាស៊ី-ប៉ាស៊ីហ្វិក (APAC) នៃមូលដ្ឋានទិន្នន័យ D1 របស់ Cloudflare។ តំបន់នេះបម្រើអាស៊ី និងតំបន់ជិតខាង ហើយអាចរួមបញ្ចូលមជ្ឈមណ្ឌលដូចជា Singapore ប៉ុន្តែ មិនមែន ជាការធានាថាទិន្នន័យទាំងអស់ស្ថិតតែក្នុងទីក្រុងតែមួយ។",
          },
          {
            kind: "p",
            text: "សំណើ HTTP API និងគេហទំព័រត្រូវបានដំណើរការលើបណ្តាញ edge សកលរបស់ Cloudflare។ អ្នកប្រើនៅអាស៊ីអាគ្នេយ៍ ជាញឹកញាប់ត្រូវបានបម្រើពីចំណុចជិតខាង (ឧទាហរណ៍ Singapore ឬមជ្ឈមណ្ឌលតំបន់ផ្សេង) ដែលជួយកាត់បន្ថយពេលរង់ចាំ។ ការដំណើរការនៅ edge ខុសពីទីតាំង នៃមូលដ្ឋានទិន្នន័យចម្បង។",
          },
          {
            kind: "p",
            text: "ភ្នាក់ងារមូលដ្ឋាន៖ នៅពេលអ្នករត់ CLI និង chhlat របស់ ភ្នាក់ងារ លើម៉ាស៊ីនផ្ទាល់ខ្លួន ការប្រតិបត្តិកូដភ្នាក់ងារ និងឯកសារមូលដ្ឋាននៅតែលើឧបករណ៍របស់អ្នក។ ចរាចរណ៍ទៅអ្នកផ្តល់ AI (ឧទាហរណ៍ Claude, Codex, Grok ឬ OpenCode) ស្ថិតក្រោម គោលការណ៍របស់អ្នកផ្តល់ទាំងនោះ។ យើងមិនផ្ទេរកូដបេសរបស់អ្នកទៅម៉ាស៊ីនមេរបស់យើង សម្រាប់ការសន្និដ្ឋាន (inference) ទេ។",
          },
          {
            kind: "p",
            text: "ប្រសិនបើអ្នកហូសផ្ទាល់ (self-host) ស្រទាប់គ្រប់គ្រង ទីតាំងទិន្នន័យអនុវត្តតាម ហេដ្ឋារចនាសម្ព័ន្ធរបស់អ្នកផ្ទាល់ មិនមែនមូលដ្ឋានទិន្នន័យ APAC ដែលបានពណ៌នាខាងលើទេ។",
          },
        ],
      },
      {
        heading: "សុវត្ថិភាពទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នក",
        blocks: [
          {
            kind: "p",
            text: "សុវត្ថិភាពទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកមានសារៈសំខាន់ចំពោះយើង។ ទិន្នន័យរបស់អ្នកត្រូវបាន រក្សាទុកដោយប្រើការអ៊ិនគ្រីបតាមស្តង់ដារឧស្សាហកម្ម។ លំហការងារភ្នាក់ងារត្រូវបានញែក តាមអ្នកប្រើ។ ទោះជាយ៉ាងណា គ្មានវិធីសាស្ត្របញ្ជូនតាមអ៊ីនធឺណិត ឬរក្សាទុកអេឡិចត្រូនិក ណាមួយដែលមានសុវត្ថិភាព ១០០% ទេ។ ទោះយើងខិតខំប្រើមធ្យោបាយដែលទទួលយកបានពាណិជ្ជកម្ម ដើម្បីការពារទិន្នន័យផ្ទាល់ខ្លួន យើងមិនអាចធានាសុវត្ថិភាពពេញលេញបានទេ។",
          },
        ],
      },
      {
        heading: "ឯកជនភាពរបស់កុមារ",
        blocks: [
          {
            kind: "p",
            text: "សេវាកម្មរបស់យើងមិនផ្តោតលើអ្នកណាដែលមានអាយុក្រោម ១៣ ឆ្នាំទេ។ យើងមិនប្រមូល ព័ត៌មានដែលអាចកំណត់អត្តសញ្ញាណបានពីកុមារក្រោម ១៣ ឆ្នាំដោយចេតនាទេ។ ប្រសិនបើអ្នក ជាឪពុកម្តាយ ឬអាណាព្យាបាល ហើយដឹងថាកូនរបស់អ្នកបានផ្តល់ទិន្នន័យផ្ទាល់ខ្លួនមកយើង សូមទាក់ទងយើង។ ប្រសិនបើយើងដឹងថាបានប្រមូលទិន្នន័យពីកុមារក្រោម ១៣ ឆ្នាំ ដោយគ្មានការយល់ព្រមពីឪពុកម្តាយ យើងនឹងចាត់វិធានការដើម្បីលុបព័ត៌មាននោះ។",
          },
        ],
      },
      {
        heading: "សិទ្ធិទិន្នន័យរបស់អ្នក",
        blocks: [
          {
            kind: "p",
            text: "អ្នកមានសិទ្ធិចូលមើល ធ្វើបច្ចុប្បន្នភាព ឬលុបទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកនៅពេលណាក៏បាន។ អ្នកអាចគ្រប់គ្រងព័ត៌មានមួយចំនួនតាមការកំណត់គណនី ឬទាក់ទងយើងដោយផ្ទាល់ ដើម្បីស្នើជំនួយ។",
          },
        ],
      },
      {
        heading: "ការផ្លាស់ប្តូរគោលការណ៍ឯកជនភាពនេះ",
        blocks: [
          {
            kind: "p",
            text: "យើងអាចធ្វើបច្ចុប្បន្នភាពគោលការណ៍ឯកជនភាពនេះម្តងម្កាល។ យើងនឹងជូនដំណឹងអ្នក អំពីការផ្លាស់ប្តូរដោយបង្ហោះគោលការណ៍ថ្មីនៅលើទំព័រនេះ និងធ្វើបច្ចុប្បន្នភាពកាលបរិច្ឆេទ \"ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ\" នៅផ្នែកខាងលើ។ សូមពិនិត្យគោលការណ៍នេះជាប្រចាំ។",
          },
        ],
      },
      {
        heading: "ទាក់ទងយើង",
        blocks: [
          {
            kind: "contact",
            before: "ប្រសិនបើអ្នកមានសំណួរអំពីគោលការណ៍ឯកជនភាពនេះ សូមទាក់ទងយើងតាម ",
            email: "support@phneakngar.ai",
            after: " ។",
          },
        ],
      },
    ],
  },
  [Locale.EN]: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: July 11, 2026",
    sections: [
      {
        heading: "Interpretation and Definitions",
        blocks: [
          {
            kind: "p",
            text: "In this Privacy Policy, \"Company\" (referred to as \"we\", \"us\" or \"our\") refers to Phneakngar AI. \"Service\" refers to the Phneakngar platform. \"You\" refers to any individual who accesses or uses our Service. \"Personal Data\" is any information relating to an identifiable individual.",
          },
        ],
      },
      {
        heading: "Collection and Use of Your Personal Data",
        blocks: [
          { kind: "h3", text: "Types of Data Collected" },
          { kind: "h4", text: "Personal Data" },
          {
            kind: "p",
            text: "While using our Service, we may ask you to provide certain personally identifiable information that can be used to contact or identify you, including but not limited to:",
          },
          { kind: "ul", items: ["Email address", "Name", "Usage Data"] },
          { kind: "h4", text: "Usage Data" },
          {
            kind: "p",
            text: "Usage Data is collected automatically when using the Service. It may include your device's IP address, browser type and version, pages of our Service that you visit, the time and date of your visit, the time spent on those pages, and other diagnostic and analytics data.",
          },
          { kind: "h4", text: "Third-Party Sign-In Information" },
          {
            kind: "p",
            text: "Phneakngar allows you to create an account and sign in through third-party services, including Google. If you choose to register or grant us access to a third-party service, we may collect personal data already linked to that account, such as your name and email address.",
          },
          { kind: "h4", text: "Tracking Technologies and Cookies" },
          {
            kind: "p",
            text: "We use cookies and similar tracking technologies to track activity on our Service and store certain information. These are used to analyze trends, administer the website, and gather demographic information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.",
          },
        ],
      },
      {
        heading: "Use of Your Personal Data",
        blocks: [
          {
            kind: "p",
            text: "We may use your Personal Data for the following purposes:",
          },
          {
            kind: "ul",
            items: [
              { lead: "To provide and maintain our Service", rest: ", including operating and delivering AI agent tasks on your behalf." },
              { lead: "To manage your account", rest: " and provide access to features for registered users." },
              { lead: "To contact you", rest: " by email or similar electronic means regarding updates or Service-related information." },
              { lead: "To manage your requests", rest: " and respond to any inquiries you send us." },
              { lead: "For business transfers", rest: ", in connection with a merger, sale of assets, financing, or acquisition of any portion of our business." },
              { lead: "For other purposes", rest: ", such as data analysis, identifying usage trends, and improving our Service." },
            ],
          },
        ],
      },
      {
        heading: "Sharing Your Personal Data",
        blocks: [
          {
            kind: "p",
            text: "We may share your personal information in the following situations:",
          },
          {
            kind: "ul",
            items: [
              { lead: "With Service Providers:", rest: " We share data with third-party AI model providers to power agent capabilities. Data sent to those providers is governed by their privacy policies. We minimize what we share and send only what is necessary for your request." },
              { lead: "For business transfers:", rest: " In the event of a merger, acquisition, or sale of assets, your Personal Data may be transferred." },
              { lead: "With your consent:", rest: " We may disclose your personal information for other purposes if you consent." },
            ],
          },
          { kind: "p", text: "We do not sell your Personal Data to third parties." },
        ],
      },
      {
        heading: "Retention of Your Personal Data",
        blocks: [
          {
            kind: "p",
            text: "We retain your Personal Data only for as long as necessary for the purposes set out in this Policy. We retain and use your data to the extent required to comply with legal obligations, resolve disputes, and enforce our agreements.",
          },
          {
            kind: "p",
            text: "Usage Data is generally retained for a shorter period, except when it is used to strengthen security or improve the functionality of our Service.",
          },
        ],
      },
      {
        heading: "Data Location and Infrastructure",
        blocks: [
          {
            kind: "cloudflare",
            before: "The hosted Service runs on ",
            after: ". Primary application data (accounts, workspaces, messages, and related management records) is stored in the Asia-Pacific (APAC) region of Cloudflare's D1 database. This region serves Asia and nearby areas and may include locations such as Singapore, but is not a guarantee that all data resides in a single city.",
          },
          {
            kind: "p",
            text: "HTTP API and website requests are processed on Cloudflare's global edge network. Users in Southeast Asia are often served from nearby points (for example Singapore or another regional hub), which helps reduce latency. Edge processing is separate from where primary database data is stored.",
          },
          {
            kind: "p",
            text: "Local agents: when you run the Phneakngar CLI and chhlat on your own machine, agent code execution and local files stay on your device. Traffic to AI providers (for example Claude, Codex, Grok, or OpenCode) is subject to those providers' policies. We do not transfer your agent code to our servers for inference.",
          },
          {
            kind: "p",
            text: "If you self-host the control plane, data location follows your own infrastructure, not the APAC database described above.",
          },
        ],
      },
      {
        heading: "Security of Your Personal Data",
        blocks: [
          {
            kind: "p",
            text: "The security of your Personal Data is important to us. Your data is stored using industry-standard encryption. Agent workspaces are isolated per user. However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.",
          },
        ],
      },
      {
        heading: "Children's Privacy",
        blocks: [
          {
            kind: "p",
            text: "Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with Personal Data, please contact us. If we become aware that we have collected data from a child under 13 without parental consent, we will take steps to remove that information.",
          },
        ],
      },
      {
        heading: "Your Data Rights",
        blocks: [
          {
            kind: "p",
            text: "You have the right to access, update, or delete your Personal Data at any time. You can manage some of this information through your account settings, or contact us directly to request assistance.",
          },
        ],
      },
      {
        heading: "Changes to This Privacy Policy",
        blocks: [
          {
            kind: "p",
            text: "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the \"Last updated\" date at the top. Please review this Policy periodically.",
          },
        ],
      },
      {
        heading: "Contact Us",
        blocks: [
          {
            kind: "contact",
            before: "If you have any questions about this Privacy Policy, you can contact us at ",
            email: "support@phneakngar.ai",
            after: ".",
          },
        ],
      },
    ],
  },
} as const satisfies Record<SharedLocale, PrivacyLabels>;

export function getPrivacyLabels(locale?: string | null): PrivacyLabels {
  return PRIVACY_LABELS[resolveLocale(locale)];
}
