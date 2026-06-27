export const SIGN_IN_LABELS = {
  title: "ចូល",
  subtitle: "ឬបង្កើតគណនីដើម្បីចាប់ផ្តើម",
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
} as const;

export function waitSecondsLabel(seconds: number): string {
  return `រង់ចាំ ${seconds} វិនាទី`;
}

export function tooManyRequestsLabel(seconds: number): string {
  return `សំណើច្រើនពេក។ សូមព្យាយាមម្តងទៀតក្នុង ${seconds} វិនាទី។`;
}

export function showImageAriaLabel(label: string): string {
  return `បង្ហាញ ${label}`;
}
