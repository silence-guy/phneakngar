export interface EmailEnv {
  DB: D1Database
  EMAIL_BUCKET: R2Bucket
  WEB_SERVICE?: Fetcher
  WEB_ORIGIN?: string
  /** Explicit public email domain for this environment. cieee.xyz is live-testing only. */
  PHNEAKNGAR_DOMAIN?: string
  /** Runtime mode. Missing or unknown values are treated as production-safe. */
  NODE_ENV?: string
  SEND_EMAIL: SendEmail
  IMAP_POLLER: DurableObjectNamespace
  ENCRYPTION_KEY: string
  EMAIL_NOTIFY_SECRET: string
  /**
   * When "false"/"0"/"no", inbound mail is trusted on a whitelist match alone (legacy
   * behaviour: a spoofed From can trigger agent dispatch). Defaults to requiring a passing
   * DKIM/SPF/DMARC result aligned with the From domain.
   */
  EMAIL_REQUIRE_SENDER_AUTH?: string
}
