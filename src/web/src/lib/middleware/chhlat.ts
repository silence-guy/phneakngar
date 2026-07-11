import { NextResponse } from "next/server";
import { queries } from "@phneakngar/shared";
import type { AuthContext } from "./auth";

type Database = Parameters<typeof queries.machine.getMachineByChhlat>[0];

type ChhlatAuthResult = { workspaceId: string; chhlatId: string };
type TaskAccessResult = {
  workspaceId: string;
  task: NonNullable<Awaited<ReturnType<typeof queries.task.getTask>>>;
};

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function withChhlatMachine(
  db: Database,
  auth: AuthContext,
  chhlatId: string,
): Promise<ChhlatAuthResult | NextResponse> {
  if (auth.authType !== "machine" || !auth.workspaceId) {
    return forbidden("machine token required");
  }

  const machine = await queries.machine.getMachineByChhlat(db, chhlatId, auth.workspaceId);
  if (machine?.ownerId && machine.ownerId !== auth.userId) {
    return forbidden("chhlat_id does not match token owner");
  }

  return { workspaceId: auth.workspaceId, chhlatId };
}

export async function withChhlatTaskAccess(
  db: Database,
  auth: AuthContext,
  taskId: string,
): Promise<TaskAccessResult | NextResponse> {
  if (auth.authType !== "machine" || !auth.workspaceId) {
    return forbidden("machine token required");
  }

  const task = await queries.task.getTask(db, taskId, auth.workspaceId);
  if (!task) {
    return NextResponse.json({ error: "task not found" }, { status: 404 });
  }

  // Scope by workspace + owner in one query. getAgentRuntimeForWorkspace permits
  // a NULL machine.ownerId (orphaned runtime / migration owner-backfill fallback)
  // so legitimate chhlats are not permanently locked out of task lifecycle
  // endpoints; it only rejects a runtime owned by a DIFFERENT user.
  const runtime = await queries.runtime.getAgentRuntimeForWorkspace(
    db,
    task.runtimeId,
    auth.workspaceId,
    auth.userId,
  );
  if (!runtime) {
    return forbidden("task runtime does not match token owner");
  }

  return { workspaceId: auth.workspaceId, task };
}
