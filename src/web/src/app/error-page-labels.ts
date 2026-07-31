import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

// Bilingual labels for the global error and not-found landing pages.
// These render in the warm "landing" email-mock aesthetic; content is user-facing.
type ErrorPageLabels = {
  notFound: {
    subject: string;
    body: string;
  };
  error: {
    subject: string;
    body: string;
    tryAgain: string;
  };
  // shared email-mock header labels
  fromLabel: string;
  toLabel: string;
  subjectLabel: string;
  toRecipient: string;
  goHome: string;
};

export const ERROR_PAGE_LABELS = {
  [Locale.KM]: {
    notFound: {
      subject: "មិនអាចបញ្ជូនបាន — រកមិនឃើញទំព័រ",
      body: "ទំព័រដែលអ្នកកំពុងស្វែងរកមិនមាន ឬត្រូវបានផ្លាស់ប្តូរ។ សូមពិនិត្យអាសយដ្ឋាន ហើយព្យាយាមម្តងទៀត។",
    },
    error: {
      subject: "មានបញ្ហាកើតឡើង",
      body: "មានកំហុសដែលមិនបានរំពឹងទុកកើតឡើង។ ក្រុមការងាររបស់យើងត្រូវបានជូនដំណឹងហើយ។ អ្នកអាចព្យាយាមម្តងទៀត ឬត្រឡប់ទៅទំព័រដើម។",
      tryAgain: "ព្យាយាមម្តងទៀត",
    },
    fromLabel: "ពី៖",
    toLabel: "ទៅ៖",
    subjectLabel: "ប្រធានបទ៖",
    toRecipient: "អ្នក",
    goHome: "ទៅទំព័រដើម",
  },
  [Locale.EN]: {
    notFound: {
      subject: "Undeliverable — Page Not Found",
      body: "The page you're looking for doesn't exist or has been moved. Check the address and try again.",
    },
    error: {
      subject: "Something went wrong",
      body: "An unexpected error occurred. Our team has been notified. You can try again or return to the home page.",
      tryAgain: "Try Again",
    },
    fromLabel: "From:",
    toLabel: "To:",
    subjectLabel: "Subject:",
    toRecipient: "You",
    goHome: "Go Home",
  },
} as const satisfies Record<SharedLocale, ErrorPageLabels>;

export function getErrorPageLabels(locale?: string | null): ErrorPageLabels {
  return ERROR_PAGE_LABELS[resolveLocale(locale)];
}
