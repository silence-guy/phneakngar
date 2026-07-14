import {
  resolveEmailDomain,
  toPhneakngarAddress,
  type EmailDomainEnvironment,
} from "@phneakngar/shared";

function emailDomainEnvironment(nodeEnv: string | undefined): EmailDomainEnvironment {
  if (nodeEnv === "development" || nodeEnv === undefined) return "development";
  if (nodeEnv === "test") return "test";
  return "production";
}

export function resolveServerEmailDomain(
  env: Pick<Cloudflare.Env, "PHNEAKNGAR_DOMAIN" | "NODE_ENV">,
  nodeEnv: string | undefined = env.NODE_ENV ?? process.env.NODE_ENV,
): string {
  return resolveEmailDomain(env.PHNEAKNGAR_DOMAIN, emailDomainEnvironment(nodeEnv));
}

export function resolvePublicEmailDomain(
  configuredDomain: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  return resolveEmailDomain(configuredDomain, emailDomainEnvironment(nodeEnv));
}

/** The only browser-facing resolver for NEXT_PUBLIC_PHNEAKNGAR_DOMAIN. */
export function getPublicEmailDomain(): string {
  return resolvePublicEmailDomain(
    process.env.NEXT_PUBLIC_PHNEAKNGAR_DOMAIN,
    process.env.NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT ?? process.env.NODE_ENV,
  );
}

export function toPublicPhneakngarAddress(handle: string): string {
  return toPhneakngarAddress(handle, getPublicEmailDomain());
}
