// Khmer labels for the global error and not-found landing pages.
// These render in the warm "landing" email-mock aesthetic; content is user-facing.
export const ERROR_PAGE_LABELS = {
  notFound: {
    subject: "មិនអាចបញ្ជូនបាន — រកមិនឃើញទំព័រ",
    body: "ទំព័រដែលអ្នកកំពុងស្វែងរកមិនមាន ឬត្រូវបានផ្លាស់ប្តូរ។ សូមពិនិត្យអាសយដ្ឋាន ហើយព្យាយាមម្តងទៀត។",
  },
  error: {
    subject: "មានបញ្ហាកើតឡើង",
    body: "មានកំហុសដែលមិនបានរំពឹងទុកកើតឡើង។ ក្រុមការងាររបស់យើងត្រូវបានជូនដំណឹងហើយ។ អ្នកអាចព្យាយាមម្តងទៀត ឬត្រឡប់ទៅទំព័រដើម។",
    tryAgain: "ព្យាយាមម្តងទៀត",
  },
  // shared email-mock header labels
  fromLabel: "ពី៖",
  toLabel: "ទៅ៖",
  subjectLabel: "ប្រធានបទ៖",
  toRecipient: "អ្នក",
  goHome: "ទៅទំព័រដើម",
} as const;
