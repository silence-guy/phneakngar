import { NextRequest } from "next/server";
import { queries, ActivateTokenRequestSchema, createLogger } from "@phneakngar/shared";
import { getDb } from "@/lib/db"
import { withEnv } from "@/lib/middleware/env";
import { writeJSON } from "@/lib/middleware/helpers";
import { runtimeToResponse } from "@/lib/api/responses";
import { broadcastToUser } from "@/lib/broadcast";
import { bindCacheKV, cacheKeys, invalidateMany } from "@/lib/cache";

const log = createLogger({ service: "machine-tokens/activate" });

type ActivationRuntime = { type: string; version: string };

function canonicalizeRuntimes(runtimes: Array<{ type: string; version?: string }>): ActivationRuntime[] {
  return runtimes
    .map((runtime) => ({ type: runtime.type, version: runtime.version || "" }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

export const POST = withEnv(async (req: NextRequest, ctx) => {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return writeJSON({ error: "invalid request body" }, 400);
  }

  const parsed = ActivateTokenRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return writeJSON({ error: "invalid payload", details: parsed.error.flatten() }, 400);
  }

  const { token } = parsed.data;
  const hostname = parsed.data.hostname.trim();
  const runtimes = canonicalizeRuntimes(parsed.data.runtimes);
  if (new Set(runtimes.map((runtime) => runtime.type)).size !== runtimes.length) {
    return writeJSON({ error: "duplicate runtime provider" }, 400);
  }
  const runtimesJson = JSON.stringify(runtimes);

  bindCacheKV(ctx.env.CACHE_KV ?? null);
  const db = getDb(ctx.env.DB);

  const foundToken = await queries.machineToken.getMachineTokenByToken(db, token);
  if (!foundToken) {
    return writeJSON({ error: "token not found" }, 404);
  }
  let mt = foundToken;
  if (!mt.workspaceId) {
    return writeJSON({ error: "token has no workspace_id — create workspace first" }, 422);
  }

  const workspaceId = mt.workspaceId;
  const claimMatches = (candidate: typeof mt) =>
    candidate.hostname === hostname && candidate.runtimesJson === runtimesJson;
  let finalizedByRequest = false;

  try {
    if (mt.status === "pending" && !claimMatches(mt)) {
      if (mt.hostname || mt.runtimesJson) {
        return writeJSON({ error: "token activation already claimed" }, 409);
      }
      const claimed = await queries.machineToken.claimMachineTokenActivation(
        db,
        mt.id,
        hostname,
        runtimesJson,
      );
      if (claimed) {
        mt = { ...mt, hostname: claimed.hostname, runtimesJson: claimed.runtimesJson };
      } else {
        const current = await queries.machineToken.getMachineTokenByToken(db, token);
        if (!current) return writeJSON({ error: "token not found" }, 404);
        mt = current;
      }
    }

    if (!claimMatches(mt)) {
      return writeJSON({ error: "token already used by another machine" }, 409);
    }
    if (mt.status !== "pending" && mt.status !== "active") {
      return writeJSON({ error: "token already used" }, 409);
    }

    if (mt.status === "pending") {
      const machine = await queries.machine.upsertMachineForActivation(db, {
        chhlatId: hostname,
        workspaceId,
        deviceInfo: hostname,
        ownerId: mt.userId,
      });
      if (!machine) {
        return writeJSON({ error: "machine belongs to another user" }, 409);
      }

      for (const runtime of runtimes) {
        await queries.runtime.upsertAgentRuntime(db, {
          workspaceId,
          chhlatId: hostname,
          runtimeMode: "local",
          provider: runtime.type,
          deviceInfo: hostname,
          metadata: { version: runtime.version },
        });
      }

      const claimedRuntimes = await queries.runtime.listAgentRuntimesByChhlatProviders(
        db,
        workspaceId,
        hostname,
        runtimes.map((runtime) => runtime.type),
      );
      const claimedProviders = new Set(claimedRuntimes.map((runtime) => runtime.provider));
      if (claimedRuntimes.length !== runtimes.length
        || runtimes.some((runtime) => !claimedProviders.has(runtime.type))) {
        throw new Error("claimed runtimes are not durably resolved");
      }

      const finalized = await queries.machineToken.finalizeMachineTokenActivation(
        db,
        mt.id,
        hostname,
        runtimesJson,
      );
      finalizedByRequest = Boolean(finalized);
      if (finalized) {
        mt = { ...mt, status: finalized.status };
      } else {
        const current = await queries.machineToken.getMachineTokenByToken(db, token);
        if (!current || current.status !== "active"
          || current.hostname !== hostname || current.runtimesJson !== runtimesJson) {
          return writeJSON({ error: "token activation could not be finalized" }, 409);
        }
        mt = current;
      }
    }

    const results = await queries.runtime.listAgentRuntimesByChhlatProviders(
      db,
      workspaceId,
      hostname,
      runtimes.map((runtime) => runtime.type),
    );
    const expectedProviders = new Set(runtimes.map((runtime) => runtime.type));
    if (results.length !== expectedProviders.size
      || results.some((runtime) => !expectedProviders.has(runtime.provider))) {
      throw new Error("persisted runtimes do not match activation claim");
    }

    await invalidateMany([
      cacheKeys.machineTokenByHash(mt.tokenHash),
      cacheKeys.machineTokenLastUsedByHash(mt.tokenHash),
      cacheKeys.runtimeIds(workspaceId, hostname),
      cacheKeys.allRuntimes(workspaceId),
    ]);

    if (finalizedByRequest) {
      broadcastToUser(mt.userId, {
        type: "runtime.registered",
        chhlatId: hostname,
        hostname,
        workspaceId,
      }).catch((err) => {
        log.warn("broadcast after activation failed", {
          userId: mt.userId,
          chhlatId: hostname,
          err: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return writeJSON({
      chhlat_id: hostname,
      workspace_id: workspaceId,
      runtimes: results.map(runtimeToResponse),
    });
  } catch (err) {
    log.warn("activation failed", {
      tokenId: mt.id,
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return writeJSON({ error: "token activation temporarily unavailable" }, 503);
  }
});
