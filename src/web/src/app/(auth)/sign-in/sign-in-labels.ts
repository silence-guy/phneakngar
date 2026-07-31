import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

export type SignInLabels = {
  title: string;
  subtitle: string;
  surface: {
    heading: string;
    detail: string;
    status: string;
    email: string;
    local: string;
    galleryTitle: string;
  };
  prompt: {
    enterEmail: string;
    enterCode: string;
  };
  field: {
    email: string;
  };
  action: {
    sending: string;
    sendCode: string;
    signingIn: string;
    signIn: string;
    useDifferentEmail: string;
    orContinueWith: string;
  };
  sentCodeToPrefix: string;
  error: {
    failedToSendCode: string;
    invalidCode: string;
    failedToSignIn: string;
  };
  gallery: {
    collaboration: string;
    emailInbox: string;
    kanbanBoard: string;
    calendar: string;
    localAgent: string;
  };
};

export const SIGN_IN_LABELS = {
  [Locale.KM]: {
    title: "ចូល",
    subtitle: "ឬបង្កើតគណនីដើម្បីចាប់ផ្តើម",
    surface: {
      heading: "ក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក",
      detail: "ចូលទៅកាន់លំហការងារ ភ្នាក់ងារ ដើម្បីគ្រប់គ្រងភ្នាក់ងារ ការងារ អ៊ីមែល និងប្រតិទិន។",
      status: "លំហការងារសុវត្ថិភាព",
      email: "អ៊ីមែលភ្នាក់ងារ",
      local: "ដំណើរការលើម៉ាស៊ីនរបស់អ្នក",
      galleryTitle: "ផ្ទៃការងារដែលអ្នកនឹងបើក",
    },
    prompt: {
      enterEmail: "បញ្ចូលអ៊ីមែលរបស់អ្នក — យើងនឹងផ្ញើកូដផ្ទៀងផ្ទាត់ទៅអ្នក",
      enterCode: "បញ្ចូលកូដដែលយើងបានផ្ញើទៅអ្នក",
    },
    field: {
      email: "អ៊ីមែល",
    },
    action: {
      sending: "កំពុងផ្ញើ...",
      sendCode: "ផ្ញើកូដ",
      signingIn: "កំពុងចូល...",
      signIn: "ចូល",
      useDifferentEmail: "ប្រើអ៊ីមែលផ្សេង",
      orContinueWith: "ឬបន្តជាមួយ",
    },
    sentCodeToPrefix: "យើងបានផ្ញើកូដទៅ ",
    error: {
      failedToSendCode: "មិនអាចផ្ញើកូដបានទេ",
      invalidCode: "កូដមិនត្រឹមត្រូវ",
      failedToSignIn: "មិនអាចចូលបានទេ",
    },
    gallery: {
      collaboration: "ការសហការ",
      emailInbox: "ប្រអប់សារអ៊ីមែល",
      kanbanBoard: "ក្តារ Kanban",
      calendar: "ប្រតិទិន",
      localAgent: "ភ្នាក់ងារក្នុងម៉ាស៊ីន",
    },
  },
  [Locale.EN]: {
    title: "Sign in",
    subtitle: "or create an account to get started",
    surface: {
      heading: "Your company, always working",
      detail:
        "Enter your Phneakngar workspace to manage agents, tasks, email, and calendar.",
      status: "Secure workspace",
      email: "Agent email",
      local: "Runs on your machine",
      galleryTitle: "The workspace you'll be opening",
    },
    prompt: {
      enterEmail: "Enter your email — we'll send you a verification code",
      enterCode: "Enter the code we sent you",
    },
    field: {
      email: "Email",
    },
    action: {
      sending: "Sending...",
      sendCode: "Send code",
      signingIn: "Signing in...",
      signIn: "Sign in",
      useDifferentEmail: "Use a different email",
      orContinueWith: "or continue with",
    },
    sentCodeToPrefix: "We sent a code to ",
    error: {
      failedToSendCode: "Couldn't send the code",
      invalidCode: "Incorrect code",
      failedToSignIn: "Couldn't sign you in",
    },
    gallery: {
      collaboration: "Collaboration",
      emailInbox: "Email inbox",
      kanbanBoard: "Kanban board",
      calendar: "Calendar",
      localAgent: "On-machine agent",
    },
  },
} as const satisfies Record<SharedLocale, SignInLabels>;

export function getSignInLabels(locale?: string | null): SignInLabels {
  return SIGN_IN_LABELS[resolveLocale(locale)];
}

export function waitSecondsLabel(seconds: number, locale?: string | null): string {
  const resolved = resolveLocale(locale);
  return resolved === Locale.EN
    ? `Wait ${seconds} seconds`
    : `រង់ចាំ ${seconds} វិនាទី`;
}

export function tooManyRequestsLabel(seconds: number, locale?: string | null): string {
  const resolved = resolveLocale(locale);
  return resolved === Locale.EN
    ? `Too many requests. Please try again in ${seconds} seconds.`
    : `សំណើច្រើនពេក។ សូមព្យាយាមម្តងទៀតក្នុង ${seconds} វិនាទី។`;
}

export function showImageAriaLabel(label: string, locale?: string | null): string {
  const resolved = resolveLocale(locale);
  return resolved === Locale.EN ? `Show ${label}` : `បង្ហាញ ${label}`;
}
