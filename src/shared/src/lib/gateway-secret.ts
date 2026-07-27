import { decrypt, encrypt } from "../utils/crypto";

/**
 * Vaulting for gateway bot tokens (gateway_binding.secret_ref).
 *
 * The column is documented as a "vault pointer" but in practice holds live Slack/Telegram
 * bot tokens, so it is encrypted at rest with the same AES-256-GCM helper already used for
 * IMAP/SMTP credentials.
 *
 * Rows written before this change are plaintext. readGatewaySecret therefore attempts
 * decryption and falls back to treating the value as plaintext, so existing deployments keep
 * working without a data migration. New writes are always encrypted.
 */

/** Encrypt a bot token for storage. Null/blank clears the secret. */
export function sealGatewaySecret(
  secretRef: string | null | undefined,
  encryptionKey: string,
): string | null {
  const trimmed = secretRef?.trim();
  if (!trimmed) return null;
  return encrypt(trimmed, encryptionKey);
}

/**
 * Decrypt a stored bot token, tolerating legacy plaintext rows.
 * Returns "" when there is no secret.
 */
export function readGatewaySecret(
  stored: string | null | undefined,
  encryptionKey: string,
): string {
  const trimmed = stored?.trim();
  if (!trimmed) return "";
  try {
    return decrypt(trimmed, encryptionKey).trim();
  } catch {
    // Legacy plaintext row written before secret_ref was encrypted.
    return trimmed;
  }
}
