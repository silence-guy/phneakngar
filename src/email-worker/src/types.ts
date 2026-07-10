export interface EmailEnv {
  DB: D1Database
  EMAIL_BUCKET: R2Bucket
  WEB_SERVICE?: Fetcher
  WEB_ORIGIN?: string
  SEND_EMAIL: SendEmail
  IMAP_POLLER: DurableObjectNamespace
  ENCRYPTION_KEY: string
  EMAIL_NOTIFY_SECRET: string
}
