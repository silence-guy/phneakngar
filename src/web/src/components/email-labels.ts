export const EMAIL_LABELS = {
  compose: {
    title: "អ៊ីមែលថ្មី",
    discard: "បោះបង់",
    send: "ផ្ញើ",
    from: "ពី",
    to: "ទៅ",
    subject: "ប្រធានបទ",
    subjectPlaceholder: "ប្រធានបទអ៊ីមែល",
    bodyPlaceholder: "សរសេរអ៊ីមែលរបស់អ្នក...",
    attachFile: "ភ្ជាប់ឯកសារ",
    uploadFailed: "ផ្ទុកឯកសារភ្ជាប់មិនបាន",
    fileTooLarge: (filename: string) => `${filename} លើសកំណត់ 10 MB`,
  },
  toolbar: {
    bold: "ដិត",
    italic: "ទ្រេត",
    underline: "គូសបន្ទាត់ក្រោម",
    strikethrough: "គូសបន្ទាត់កាត់",
    heading1: "ចំណងជើង 1",
    heading2: "ចំណងជើង 2",
    bulletList: "បញ្ជីចំណុច",
    orderedList: "បញ្ជីលេខរៀង",
    alignLeft: "តម្រឹមឆ្វេង",
    alignCenter: "តម្រឹមកណ្តាល",
    alignRight: "តម្រឹមស្តាំ",
    insertLink: "បញ្ចូលតំណ",
    removeLink: "ដកតំណ",
    insertImage: "បញ្ចូលរូបភាព",
    horizontalRule: "បន្ទាត់ផ្តេក",
    validUrl: "សូមបញ្ចូល URL ត្រឹមត្រូវ",
    displayText: "អត្ថបទបង្ហាញ",
    insert: "បញ្ចូល",
  },
  page: {
    // folders
    inbox: "ប្រអប់សារ",
    sent: "បានផ្ញើ",
    untrust: "មិនទុកចិត្ត",
    // sidebar / compose entry
    newEmail: "អ៊ីមែលថ្មី",
    noEmailConfigured: "មិនបានកំណត់អ៊ីមែល",
    clickToCopy: "ចុចដើម្បីចម្លង",
    copyAddress: "ចម្លងអាសយដ្ឋាន",
    composeNewEmail: "សរសេរអ៊ីមែលថ្មី",
    configureEmailHint: "កំណត់អ៊ីមែលក្នុងការកំណត់ភ្នាក់ងារ ដើម្បីផ្ញើអ៊ីមែល",
    // reading pane
    selectEmail: "ជ្រើសអ៊ីមែលដើម្បីមើល",
    bodyNotAvailable: "(មិនមានខ្លឹមសារ)",
    noSubject: "(គ្មានប្រធានបទ)",
    from: "ពី",
    to: "ទៅ",
    sent2: "បានផ្ញើ",
    received: "បានទទួល",
    // toolbar tooltips
    trustEmail: "ទុកចិត្តអ៊ីមែលនេះ",
    reply: "ឆ្លើយតប",
    forward: "បញ្ជូនបន្ត",
    delete: "លុប",
    // list empty states
    noTrustedEmails: "គ្មានអ៊ីមែលពីអ្នកផ្ញើដែលទុកចិត្ត",
    noSentEmails: "មិនទាន់បានផ្ញើអ៊ីមែលទេ",
    noUntrustedEmails: "គ្មានអ៊ីមែលដែលមិនទុកចិត្ត",
    // status badges
    unread: "មិនទាន់អាន",
    read: "បានអាន",
    // delete dialog
    deleteTitle: "លុបអ៊ីមែល",
    deleteDescription: "នេះនឹងលុបអ៊ីមែលនេះជាអចិន្ត្រៃយ៍។",
    // toasts
    loadFailed: "មិនអាចផ្ទុកអ៊ីមែលបានទេ",
    deleted: "បានលុបអ៊ីមែល",
    deleteFailed: "មិនអាចលុបអ៊ីមែលបានទេ",
    sent3: "បានផ្ញើអ៊ីមែល",
    sendFailed: "មិនអាចផ្ញើអ៊ីមែលបានទេ",
    trusted: "បានទុកចិត្ត និងផ្ញើទៅភ្នាក់ងារ",
    trustFailed: "មិនអាចទុកចិត្តអ៊ីមែលបានទេ",
    copyFailed: "មិនអាចចម្លងបានទេ",
  },
  // agent-chat event card (event-cards/email-card.tsx)
  card: {
    fromPrefix: "ពី ",
    toPrefix: "ទៅ ",
    inbound: "ចូល",
    sent: "បានផ្ញើ",
  },
  // agent-chat email event sheet (agent-chat/email-event-sheet.tsx)
  eventSheet: {
    notFound: "រកមិនឃើញអ៊ីមែល",
    loading: "កំពុងផ្ទុក...",
    title: "អ៊ីមែល",
    from: "ពី៖",
    to: "ទៅ៖",
    date: "កាលបរិច្ឆេទ៖",
  },
  // email body iframe (email-body-frame.tsx)
  frame: {
    iframeTitle: "មាតិកាអ៊ីមែល",
  },
} as const;

export function emailAttachmentsLabel(count: number): string {
  return `ឯកសារភ្ជាប់ ${count}`;
}
