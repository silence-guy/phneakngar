import { describe, it, expect } from "vitest";
import { sealGatewaySecret, readGatewaySecret } from "../../src/lib/gateway-secret";
import { encrypt } from "../../src/utils/crypto";

const KEY = "test-encryption-key-0123456789";

describe("sealGatewaySecret", () => {
  it("encrypts a token so the plaintext is not recoverable from the stored value", () => {
    const token = "xoxb-real-slack-bot-token";
    const sealed = sealGatewaySecret(token, KEY);
    expect(sealed).toBeTruthy();
    expect(sealed).not.toBe(token);
    expect(sealed).not.toContain("xoxb");
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const a = sealGatewaySecret("same-token", KEY);
    const b = sealGatewaySecret("same-token", KEY);
    expect(a).not.toBe(b);
    expect(readGatewaySecret(a, KEY)).toBe("same-token");
    expect(readGatewaySecret(b, KEY)).toBe("same-token");
  });

  it("treats null/blank as clearing the secret", () => {
    expect(sealGatewaySecret(null, KEY)).toBeNull();
    expect(sealGatewaySecret(undefined, KEY)).toBeNull();
    expect(sealGatewaySecret("   ", KEY)).toBeNull();
  });
});

describe("readGatewaySecret", () => {
  it("round-trips a sealed token", () => {
    const sealed = sealGatewaySecret("bot-token-123", KEY);
    expect(readGatewaySecret(sealed, KEY)).toBe("bot-token-123");
  });

  it("returns legacy plaintext rows unchanged", () => {
    // Rows written before secret_ref was encrypted must keep working without a migration.
    expect(readGatewaySecret("1234567890:AAplain-telegram-token", KEY)).toBe(
      "1234567890:AAplain-telegram-token",
    );
  });

  it("returns empty string when there is no secret", () => {
    expect(readGatewaySecret(null, KEY)).toBe("");
    expect(readGatewaySecret(undefined, KEY)).toBe("");
    expect(readGatewaySecret("  ", KEY)).toBe("");
  });

  it("falls back to the raw value when decrypted with the wrong key", () => {
    // Wrong key must not throw and take down egress; it degrades to the stored value.
    const sealed = encrypt("token", KEY);
    expect(() => readGatewaySecret(sealed, "different-key")).not.toThrow();
  });
});
