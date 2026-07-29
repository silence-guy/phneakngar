declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    EMAIL_BUCKET: R2Bucket
    WS_DO_WORKER: Fetcher
    EMAIL_WORKER: Fetcher
    WORKER_SELF_REFERENCE: Fetcher
    NEXT_INC_CACHE_R2_BUCKET: R2Bucket
    NEXT_TAG_CACHE_D1: D1Database
    NEXT_CACHE_DO_QUEUE: DurableObjectNamespace
    GITHUB_CLIENT_ID: string
    GITHUB_CLIENT_SECRET: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    AUTH_TRUSTED_ORIGINS?: string
    ENCRYPTION_KEY: string
    EMAIL_NOTIFY_SECRET: string
    /**
     * Optional JSON map of external chat team/guild/chat ids to workspace bindings.
     * Shape: { "slack:T123": { "workspaceId": "...", "agentId": "...", "userId": "..." }, ... }
     * Legacy bootstrap path; D1 gateway_binding is the product source of truth.
     * Does NOT affect whether webhook authentication runs — see gateway-verify.ts.
     */
    GATEWAY_TEAM_MAP?: string
    /**
     * Shared fallback secret for chat gateway webhooks (header x-gateway-secret or Bearer).
     * Used when a provider has no native signature secret configured. Every gateway webhook
     * requires either its provider secret below or this one, otherwise the route fails closed.
     */
    GATEWAY_WEBHOOK_SECRET?: string
    /** Telegram Bot API webhook secret_token (x-telegram-bot-api-secret-token). */
    TELEGRAM_WEBHOOK_SECRET?: string
    /** Slack signing secret for x-slack-signature HMAC. */
    SLACK_SIGNING_SECRET?: string
    /** Discord application public key (hex) for x-signature-ed25519 verification. */
    DISCORD_PUBLIC_KEY?: string
    /** Lark/Feishu event-subscription verification token for x-lark-signature HMAC. */
    LARK_APP_SECRET?: string
    /** Microsoft Teams outgoing-webhook HMAC secret (base64, from the Teams app config). */
    TEAMS_APP_PASSWORD?: string
    WS_SERVICE_SECRET: string
    RATE_LIMIT_KV: KVNamespace
    CACHE_KV: KVNamespace
    AUTH_OTP_RATE_LIMIT_MAX?: string
    AUTH_OTP_RATE_LIMIT_WINDOW_SEC?: string
    RUNTIME_MODEL_OPTIONS?: string
    MIN_CLI_VERSION?: string
    DEVICE_CLIENT_IDS?: string
    /** Server email domain for agent addresses. cieee.xyz is live-testing only. */
    PHNEAKNGAR_DOMAIN?: string
    /** Browser email domain; must match PHNEAKNGAR_DOMAIN. */
    NEXT_PUBLIC_PHNEAKNGAR_DOMAIN?: string
    /** Browser build/runtime identity mode; local app bundles use development. */
    NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT?: string
    NODE_ENV?: string
  }
}

type Env = CloudflareEnv
