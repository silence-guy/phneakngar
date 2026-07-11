import type { HeadroomRuntimeConfig } from "./config.js";

/**
 * Check if the config has any upstream providers defined.
 */
export function hasUpstreamConfig(config: HeadroomRuntimeConfig): boolean {
  return Boolean(config.upstream?.claude || config.upstream?.openai);
}

/**
 * Generate YAML configuration for Headroom upstream providers.
 * Headroom expects this in HEADROOM_CONFIG_DIR/upstream.yaml
 */
export function generateUpstreamConfig(config: HeadroomRuntimeConfig): string {
  if (!hasUpstreamConfig(config)) {
    return "";
  }

  const lines: string[] = [];

  if (config.upstream?.claude) {
    lines.push("anthropic:");
    lines.push(`  base_url: ${config.upstream.claude}`);
  }

  if (config.upstream?.claude && config.upstream?.openai) {
    lines.push(""); // blank line between sections
  }

  if (config.upstream?.openai) {
    lines.push("openai:");
    lines.push(`  base_url: ${config.upstream.openai}`);
  }

  return lines.join("\n") + "\n";
}
