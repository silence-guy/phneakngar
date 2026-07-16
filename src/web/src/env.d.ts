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
     * When set, GATEWAY_WEBHOOK_SECRET is required.
     */
    GATEWAY_TEAM_MAP?: string
    /** Shared secret for chat gateway webhooks (header x-gateway-secret or Bearer). */
    GATEWAY_WEBHOOK_SECRET?: string
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
