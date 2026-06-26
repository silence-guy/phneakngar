const DOMAIN = `@${process.env.PHNEAKNGAR_DOMAIN || "phneakngar.ai"}`
const HANDLE_RE = /^[a-zA-Z0-9-]{3,}$/

const RESERVED_HANDLES = new Set([
  "no-reply",
  "noreply",
  "admin",
  "support",
  "help",
  "info",
  "postmaster",
  "abuse",
  "security",
  "mailer-daemon",
  "root",
  "webmaster",
  "hostmaster",
  "system",
  "phneakngar",
])

export function parseEmailHandle(a: string) { return a.endsWith(DOMAIN) ? a.slice(0, -DOMAIN.length) : "" }
export function toPhneakngarAddress(h: string) { return `${h}${DOMAIN}` }
export function isValidHandle(h: string) { return HANDLE_RE.test(h) && !RESERVED_HANDLES.has(h.toLowerCase()) }
