export const EMAIL_SETUP_LABELS = {
  heading: "មគ្គុទ្ទេសក៍ដំឡើងអ៊ីមែល",
  subtitle: "របៀបទទួលបាន IMAP/SMTP credentials សម្រាប់ provider អ៊ីមែលរបស់អ្នក",
  imap: "IMAP",
  smtp: "SMTP",
} as const;

type ProviderCopy = {
  steps: readonly string[];
  note: string | null;
};

export const EMAIL_SETUP_PROVIDER_COPY = {
  gmail: {
    steps: [
      "បើក 2-Step Verification នៅក្នុង Google Account របស់អ្នក (Security > 2-Step Verification)។",
      "ចូលទៅ https://myaccount.google.com/apppasswords រួចបង្កើត App Password។",
      'បញ្ចូលឈ្មោះ (ឧ. "ភ្នាក់ងារ") រួចចុច Generate។',
      "ចម្លងពាក្យសម្ងាត់ 16 តួអក្សរ — ប្រើវាជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP។",
      "Username គឺជាអាសយដ្ឋាន Gmail ពេញរបស់អ្នក (ឧ. you@gmail.com)។",
    ],
    note: "Gmail លែងគាំទ្រពាក្យសម្ងាត់ធម្មតាសម្រាប់កម្មវិធីភាគីទីបីទៀតហើយ។ អ្នកត្រូវតែប្រើ App Password។",
  },
  outlook: {
    steps: [
      "ចូលគណនីនៅ https://account.microsoft.com/security។",
      "ចូលទៅ Security > Advanced Security Options > App Passwords។",
      "បង្កើត App Password រួចប្រើវាជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP។",
      "Username គឺជាអាសយដ្ឋានអ៊ីមែលពេញរបស់អ្នក (ឧ. you@outlook.com)។",
    ],
    note: "ប្រសិនបើស្ថាប័នរបស់អ្នកប្រើ Microsoft 365 អ្នកគ្រប់គ្រងរបស់អ្នកប្រហែលជាត្រូវបើក App Passwords ឬការចូលប្រើ IMAP។",
  },
  yahoo: {
    steps: [
      "ចូលទៅ https://login.yahoo.com/account/security។",
      'បើក "Allow apps that use less secure sign in" ឬបង្កើត App Password។',
      "ប្រើ App Password ជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP។",
      "Username គឺជាអាសយដ្ឋានអ៊ីមែល Yahoo ពេញរបស់អ្នក។",
    ],
    note: null,
  },
  icloud: {
    steps: [
      "ចូលទៅ https://appleid.apple.com រួចចូលគណនី។",
      "ចូលទៅ Sign-In and Security > App-Specific Passwords។",
      "បង្កើត App-Specific Password។",
      "ប្រើពាក្យសម្ងាត់ដែលបង្កើតបានជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP។",
      "Username គឺជាអាសយដ្ឋានអ៊ីមែល iCloud ពេញរបស់អ្នក (ឧ. you@icloud.com)។",
    ],
    note: "ត្រូវតែបើក Two-factor authentication នៅលើ Apple ID របស់អ្នក។",
  },
  qq: {
    steps: [
      "ចូល QQ Mail (mail.qq.com)។",
      "ចូលទៅ Settings > Account > POP3/IMAP/SMTP/Exchange/CardDAV។",
      "បើកសេវា IMAP/SMTP — អ្នកប្រហែលជាត្រូវផ្ញើ SMS ដើម្បីផ្ទៀងផ្ទាត់។",
      "បន្ទាប់ពីផ្ទៀងផ្ទាត់ QQ Mail នឹងបង្ហាញ authorization code។",
      "ប្រើ authorization code ជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP (មិនមែនពាក្យសម្ងាត់ QQ របស់អ្នកទេ)។",
      "Username គឺជាអាសយដ្ឋានអ៊ីមែល QQ ពេញរបស់អ្នក (ឧ. 123456789@qq.com)។",
    ],
    note: null,
  },
  "163": {
    steps: [
      "ចូល 163 Mail (mail.163.com)។",
      "ចូលទៅ Settings > POP3/SMTP/IMAP។",
      "បើកសេវា IMAP/SMTP រួចកំណត់ authorization password។",
      "ប្រើ authorization password ជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP។",
      "Username គឺជាអាសយដ្ឋានអ៊ីមែល 163 ពេញរបស់អ្នក (ឧ. you@163.com)។",
    ],
    note: "SMTP ប្រើ port 465 ជាមួយ SSL ជំនួសឱ្យ 587 ធម្មតា។",
  },
  feishu: {
    steps: [
      "ចូល Feishu Admin Console។",
      "ចូលទៅ Security > Application Password ឬសុំឱ្យអ្នកគ្រប់គ្រងរបស់អ្នកបើក IMAP/SMTP។",
      "បង្កើត application-specific password។",
      "ប្រើ application password ជាពាក្យសម្ងាត់ទាំង IMAP និង SMTP។",
      "Username គឺជាអាសយដ្ឋានអ៊ីមែល Feishu ពេញរបស់អ្នក។",
    ],
    note: "SMTP ប្រើ port 465 ជាមួយ SSL។ អ្នកគ្រប់គ្រងស្ថាប័នរបស់អ្នកត្រូវតែបើកការចូលប្រើ IMAP។",
  },
  other: {
    steps: [
      "ពិនិត្យឯកសារជំនួយរបស់ provider អ៊ីមែលអ្នកសម្រាប់ការកំណត់ server IMAP/SMTP។",
      "IMAP ជាធម្មតាស្ថិតនៅ port 993 (SSL/TLS) ឯ SMTP នៅ port 587 (STARTTLS) ឬ 465 (SSL)។",
      "ប្រសិនបើ provider របស់អ្នកគាំទ្រ App Passwords សូមបង្កើតមួយ រួចប្រើវាជំនួសឱ្យពាក្យសម្ងាត់គណនីរបស់អ្នក។",
      "Username ជាធម្មតាគឺជាអាសយដ្ឋានអ៊ីមែលពេញរបស់អ្នក។",
    ],
    note: null,
  },
} as const satisfies Record<string, ProviderCopy>;

export type EmailSetupProviderId = keyof typeof EMAIL_SETUP_PROVIDER_COPY;

export function emailSetupProviderCopy(id: EmailSetupProviderId): ProviderCopy {
  return EMAIL_SETUP_PROVIDER_COPY[id];
}
