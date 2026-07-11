import { NextRequest } from "next/server";
import { queries, semverGte } from "@phneakngar/shared"
import { getDb, withD1Retry } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withChhlatMachine } from "@/lib/middleware/chhlat";
import { writeJSON, parseBody } from "@/lib/middleware/helpers";
import { runtimeToResponse } from "@/lib/api/responses";
import { RegisterChhlatRequestSchema } from "@phneakngar/shared";
import { broadcastToUser } from "@/lib/broadcast";
import { invalidate, cacheKeys } from "@/lib/cache";
import { log } from "@/lib/logger";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const db = getDb(ctx.env.DB)

  const [body, err] = await parseBody(req, RegisterChhlatRequestSchema);
  if (err) return err;

  const { chhlat_id: chhlatId, device_name: deviceName, cli_version: cliVersion, workspaces_root: workspacesRoot, runtimes } = body;
  let workspaceId = body.workspace_id;

  // Resolve workspace: use provided or fall back to auth context
  if (!workspaceId && ctx.workspaceId) {
    workspaceId = ctx.workspaceId;
  }

  if (!workspaceId) {
    return writeJSON({ error: "workspace_id is required" }, 400);
  }

  // When authenticated with a machine token, enforce workspace match
  if (ctx.workspaceId && ctx.workspaceId !== workspaceId) {
    return writeJSON({ error: "workspace_id does not match token" }, 403);
  }

  const chhlatAuth = await withChhlatMachine(db, ctx, chhlatId);
  if (chhlatAuth instanceof Response) return chhlatAuth;

  const membership = await withD1Retry(() => queries.member.getMemberByUserAndWorkspace(
    db,
    ctx.userId,
    workspaceId
  ));
  if (!membership) {
    return writeJSON({ error: "workspace not found" }, 404);
  }

  // Upsert machine row (1 write for liveness) — non-critical
  try {
    await queries.machine.upsertMachine(db, {
      chhlatId,
      workspaceId,
      deviceInfo: deviceName.trim(),
      ownerId: ctx.userId,
    });
  } catch (e) {
    log.warn("register: machine upsert failed", { chhlatId, err: String(e) });
  }

  // Clear pendingUpdateVersion if chhlat re-registered with a satisfying version
  if (cliVersion) {
    try {
      const machineRow = await queries.machine.getMachineByChhlat(db, chhlatId, workspaceId);
      if (machineRow?.pendingUpdateVersion && semverGte(cliVersion, machineRow.pendingUpdateVersion)) {
        await queries.machine.clearPendingUpdateVersion(db, chhlatId, workspaceId);
        broadcastToUser(ctx.userId, {
          type: "runtime.status",
          chhlatId,
          workspaceId,
          status: "online",
        }).catch(() => {});
      }
    } catch (e) {
      log.warn("register: pending version check failed", { chhlatId, err: String(e) });
    }
  }

  const results = [];
  for (const rt of runtimes) {
    const provider = (rt.type || rt.provider || "unknown").trim();
    const runtimeMode = rt.runtime_mode || "local";
    const deviceInfo = deviceName.trim();
    const metadata: Record<string, unknown> = {
      version: rt.version || "",
      ...(cliVersion ? { cli_version: cliVersion } : {}),
      ...(workspacesRoot ? { workspaces_root: workspacesRoot } : {}),
      ...(rt.headroom ? { headroom: rt.headroom } : {}),
    };

    const result = await withD1Retry(() => queries.runtime.upsertAgentRuntime(db, {
      workspaceId,
      chhlatId,
      runtimeMode,
      provider,
      deviceInfo,
      metadata,
    }));
    results.push({ ...result, machineLastSeenAt: new Date().toISOString() });
  }

  await Promise.all([
    invalidate(cacheKeys.runtimeIds(workspaceId, chhlatId)),
    invalidate(cacheKeys.allRuntimes(workspaceId)),
  ]);

  broadcastToUser(ctx.userId, {
    type: "runtime.registered",
    chhlatId,
    hostname: deviceName.trim(),
    workspaceId,
  }).catch(() => {});

  return writeJSON({ runtimes: results.map(runtimeToResponse), workspaceId });
});
