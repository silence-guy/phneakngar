/**
 * Live provider probe for a gateway binding (Telegram getMe / Slack auth.test).
 * Requires vaulted secret_ref. Never returns the secret.
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */

import { NextRequest } from "next/server";
import { queries, readGatewaySecret } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceOwner } from "@/lib/middleware/workspace";
import { writeError, writeJSON } from "@/lib/middleware/helpers";

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function probeProvider(
  provider: string,
  token: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ ok: boolean; error?: string; detail?: unknown; status?: number }> {
  if (!token.trim()) {
    return { ok: false, error: "missing token" };
  }
  if (!fetchImpl) {
    return { ok: false, error: "fetch unavailable" };
  }

  try {
    if (provider === "telegram") {
      const url = `https://api.telegram.org/bot${token}/getMe`;
      const res = await fetchImpl(url, { method: "GET" });
      const body = await safeJson(res);
      const okFlag =
        body && typeof body === "object" && (body as { ok?: boolean }).ok === true;
      if (!res.ok || !okFlag) {
        return { ok: false, error: "telegram getMe failed", status: res.status, detail: body };
      }
      return { ok: true, detail: body, status: res.status };
    }

    if (provider === "slack") {
      const res = await fetchImpl("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "",
      });
      const body = await safeJson(res);
      const okFlag =
        body && typeof body === "object" && (body as { ok?: boolean }).ok === true;
      if (!res.ok || !okFlag) {
        return { ok: false, error: "slack auth.test failed", status: res.status, detail: body };
      }
      return { ok: true, detail: body, status: res.status };
    }

    return { ok: false, error: `probe not implemented for ${provider}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export const POST = withAuth(async (req: NextRequest, ctx) => {
  // Owner-only: probing exercises the vaulted bot token against the live provider.
  const ws = await withWorkspaceOwner(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) return writeError("binding id is required", 400);

  const db = getDb(ctx.env.DB);
  const binding = await queries.gatewayBinding.getGatewayBinding(db, ws.workspaceId, id);
  if (!binding) return writeError("binding not found", 404);

  const token = readGatewaySecret(binding.secretRef, ctx.env.ENCRYPTION_KEY);
  if (!token) {
    return writeError("binding has no vaulted bot token", 400);
  }

  const result = await probeProvider(binding.provider, token);

  try {
    await queries.activityEvent.createActivityEvent(db, {
      workspaceId: ws.workspaceId,
      kind: result.ok ? "gateway_probe_ok" : "gateway_probe_fail",
      summary: result.ok
        ? `Probe ok for ${binding.provider} binding ${binding.id}`
        : `Probe failed for ${binding.provider} binding ${binding.id}: ${result.error}`,
      actorType: "user",
      actorId: ctx.userId,
      subjectType: "gateway_binding",
      subjectId: binding.id,
      payloadJson: JSON.stringify({
        provider: binding.provider,
        ok: result.ok,
        error: result.error ?? null,
      }),
    });
  } catch {
    // activity table may be missing pre-0054
  }

  if (!result.ok) {
    return writeJSON(
      {
        ok: false,
        provider: binding.provider,
        error: result.error,
        // Never echo token; detail may include provider bot metadata only.
        detail: result.detail ?? null,
      },
      502,
    );
  }

  return writeJSON({
    ok: true,
    provider: binding.provider,
    detail: result.detail ?? null,
  });
});
