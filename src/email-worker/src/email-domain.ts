import { resolveEmailDomain, type EmailDomainEnvironment } from "@phneakngar/shared"
import type { EmailEnv } from "./types"

function emailDomainEnvironment(nodeEnv: string | undefined): EmailDomainEnvironment {
  if (nodeEnv === "development") return "development"
  if (nodeEnv === "test") return "test"
  return "production"
}

export function resolveEmailWorkerDomain(
  env: Pick<EmailEnv, "PHNEAKNGAR_DOMAIN" | "NODE_ENV">,
): string {
  return resolveEmailDomain(
    env.PHNEAKNGAR_DOMAIN,
    emailDomainEnvironment(env.NODE_ENV),
  )
}
