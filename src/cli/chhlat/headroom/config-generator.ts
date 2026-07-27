import type { HeadroomRuntimeConfig } from "./config.js";

/**
 * Official provider endpoints, always allowed.
 *
 * The upstream base_url is server-pushed in the task payload and decides where the headroom
 * proxy forwards requests carrying the operator's real ANTHROPIC_API_KEY / OPENAI_API_KEY.
 * A hostile or compromised control plane could otherwise point it at any host and capture
 * every credentialed LLM call, so the destination has to be approved locally rather than
 * simply trusted.
 *
 * Custom gateways (LiteLLM, OpenRouter, a corporate proxy) remain supported, but the
 * operator opts into them via PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS — the server cannot choose
 * an arbitrary host on its own. Suffix match, so subdomains of an allowed host are fine.
 */
const DEFAULT_UPSTREAM_HOSTS: Record<"claude" | "openai", string[]> = {
  claude: ["anthropic.com"],
  openai: ["openai.com", "openai.azure.com"],
};

/** Operator-approved extra hosts (comma-separated), applying to either provider. */
function operatorApprovedHosts(): string[] {
  return (process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
}

function hostAllowed(host: string, provider: "claude" | "openai"): boolean {
  const h = host.toLowerCase();
  const allowed = [...DEFAULT_UPSTREAM_HOSTS[provider], ...operatorApprovedHosts()];
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

/**
 * Validate a server-supplied upstream base_url.
 * Returns the URL when acceptable, or null when it must not be used.
 */
export function validateUpstreamBaseUrl(
  value: string | undefined,
  provider: "claude" | "openai",
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/[\r\n]/.test(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  // https only: the API key travels over this connection.
  if (parsed.protocol !== "https:") return null;
  // Embedded credentials would be sent to the upstream as-is.
  if (parsed.username || parsed.password) return null;
  if (!hostAllowed(parsed.hostname, provider)) return null;
  return raw;
}

/**
 * Check if the config has any upstream providers defined.
 */
export function hasUpstreamConfig(config: HeadroomRuntimeConfig): boolean {
  return Boolean(config.upstream?.claude || config.upstream?.openai);
}

/**
 * Generate YAML configuration for Headroom upstream providers.
 * Headroom expects this in HEADROOM_CONFIG_DIR/upstream.yaml
 *
 * Upstream URLs that are not locally approved are dropped with an actionable warning
 * rather than written, so a malicious base_url cannot capture the operator's API keys.
 */
export function generateUpstreamConfig(config: HeadroomRuntimeConfig): string {
  if (!hasUpstreamConfig(config)) {
    return "";
  }

  const claude = validateUpstreamBaseUrl(config.upstream?.claude, "claude");
  const openai = validateUpstreamBaseUrl(config.upstream?.openai, "openai");

  for (const [provider, requested, accepted] of [
    ["claude", config.upstream?.claude, claude],
    ["openai", config.upstream?.openai, openai],
  ] as const) {
    if (requested && !accepted) {
      console.warn(
        `[headroom] refusing ${provider} upstream base_url ${requested}: host is not approved. ` +
          `Add it to PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS to allow it.`,
      );
    }
  }

  const lines: string[] = [];

  if (claude) {
    lines.push("anthropic:");
    lines.push(`  base_url: ${claude}`);
  }

  if (claude && openai) {
    lines.push(""); // blank line between sections
  }

  if (openai) {
    lines.push("openai:");
    lines.push(`  base_url: ${openai}`);
  }

  if (lines.length === 0) return "";

  return lines.join("\n") + "\n";
}
