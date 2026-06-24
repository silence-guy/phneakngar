import type { CalendarView } from "./calendar-view-switcher";

export const CALENDAR_LABELS = {
  view: {
    group: "ទិដ្ឋភាពប្រតិទិន",
    month: "ខែ",
    week: "សប្តាហ៍",
    agenda: "បញ្ជី",
  },
  actions: {
    today: "ថ្ងៃនេះ",
    previousMonth: "ខែមុន",
    nextMonth: "ខែបន្ទាប់",
    previousWeek: "សប្តាហ៍មុន",
    nextWeek: "សប្តាហ៍បន្ទាប់",
    jumpToDate: "ទៅកាលបរិច្ឆេទ",
    pickDate: "ជ្រើសកាលបរិច្ឆេទ",
    eventDate: "កាលបរិច្ឆេទព្រឹត្តិការណ៍",
    pickTime: "ជ្រើសម៉ោង",
    pickTimeSlot: "ជ្រើសចន្លោះម៉ោង",
    eventTime24h: "ម៉ោងព្រឹត្តិការណ៍ (24 ម៉ោង)",
    clear: "សម្អាត",
    cancel: "បោះបង់",
    createEvent: "បង្កើតព្រឹត្តិការណ៍",
    creating: "កំពុងបង្កើត...",
    save: "រក្សាទុក",
    saving: "កំពុងរក្សាទុក...",
    delete: "លុប",
    deleting: "កំពុងលុប...",
    update: "ធ្វើបច្ចុប្បន្នភាព",
  },
  empty: {
    noEvents: "មិនមានព្រឹត្តិការណ៍ក្នុងទិដ្ឋភាពនេះទេ។",
    switchView: "ប្តូរទៅទិដ្ឋភាពខែ ឬបង្កើតព្រឹត្តិការណ៍ថ្មីខាងលើ។",
  },
  event: {
    untitled: "ព្រឹត្តិការណ៍គ្មានចំណងជើង",
    newTitle: "ព្រឹត្តិការណ៍ថ្មី",
    titleAria: "ចំណងជើងព្រឹត្តិការណ៍",
    newA11yTitle: "ព្រឹត្តិការណ៍ប្រតិទិនថ្មី",
    notFound: "រកមិនឃើញព្រឹត្តិការណ៍ប្រតិទិន",
    descriptionPlaceholder: "បន្ថែមការពិពណ៌នា...",
    noAgents: "មិនមានភ្នាក់ងារ",
    selectAgent: "ជ្រើសភ្នាក់ងារ",
  },
  repeat: {
    doesNotRepeat: "មិនកើតឡើងដដែល",
    every: "រៀងរាល់",
    custom: "ផ្ទាល់ខ្លួន...",
    remove: "ដកការកើតឡើងដដែល",
    count: "ចំនួនដងកើតឡើងដដែល",
    noEndDate: "គ្មានថ្ងៃបញ្ចប់",
    stopDate: "ថ្ងៃបញ្ចប់",
    until: "រហូតដល់",
    recurring: "កើតឡើងដដែល",
    updateTitle: "ធ្វើបច្ចុប្បន្នភាពព្រឹត្តិការណ៍កើតឡើងដដែល",
    updateDescription: "តើការផ្លាស់ប្តូរនេះគួរអនុវត្តយ៉ាងដូចម្តេច?",
    deleteTitle: "លុបព្រឹត្តិការណ៍កើតឡើងដដែល",
    deleteDescription: "តើគួរលុបផ្នែកណានៃស៊េរីនេះ?",
    thisOnly: "ព្រឹត្តិការណ៍នេះប៉ុណ្ណោះ",
    thisAndFollowing: "ព្រឹត្តិការណ៍នេះ និងព្រឹត្តិការណ៍បន្ទាប់",
  },
  validation: {
    selectAgent: "សូមជ្រើសភ្នាក់ងារ",
    titleRequired: "ត្រូវការចំណងជើង",
    timeFormat: "ម៉ោងត្រូវមានទម្រង់ HH:MM ក្នុង 24 ម៉ោង",
    repeatCount: "ចំនួនកើតឡើងដដែលត្រូវតែជាលេខវិជ្ជមាន",
    stopRequiresRepeat: "ថ្ងៃបញ្ចប់ត្រូវការចន្លោះកើតឡើងដដែល",
    stopAfterStart: "ថ្ងៃបញ្ចប់ត្រូវស្ថិតនៅ ឬក្រោយពេលកើតឡើងលើកដំបូង",
  },
} as const;

export const CALENDAR_WEEKDAY_LABELS = [
  "អាទិត្យ",
  "ចន្ទ",
  "អង្គារ",
  "ពុធ",
  "ព្រហស្បតិ៍",
  "សុក្រ",
  "សៅរ៍",
] as const;

export const CALENDAR_WEEKDAY_NARROW = ["អា", "ច", "អ", "ព", "ព្រ", "សុ", "ស"] as const;

export function calendarViewLabel(view: CalendarView): string {
  return CALENDAR_LABELS.view[view];
}

export function hiddenEventsLabel(count: number): string {
  return `+${count} ទៀត`;
}

export function hiddenEventsAriaLabel(count: number): string {
  return `${count} ព្រឹត្តិការណ៍បន្ថែម`;
}

export function collapsedTodayLabel(count: number): string {
  return `× ${count} ថ្ងៃនេះ`;
}

export function recurringTitlePrefix(isRecurring: boolean): string {
  return isRecurring ? `${CALENDAR_LABELS.repeat.recurring} · ` : "";
}
