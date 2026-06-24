import { NextResponse } from "next/server";
import { queries } from "@alook/shared";
import type { AuthContext } from "./auth";

type Database = Parameters<typeof queries.machine.getMachineByDaemon>[0];

type DaemonAuthResult = { workspaceId: string; daemonId: string };
type TaskAccessResult = {
  workspaceId: string;
  task: NonNullable<Awaited<ReturnType<typeof queries.task.getTask>>>;
};

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function withDaemonMachine(
  db: Database,
  auth: AuthContext,
  daemonId: string,
): Promise<DaemonAuthResult | NextResponse> {
  if (auth.authType !== "machine" || !auth.workspaceId) {
    return forbidden("machine token required");
  }

  const machine = await queries.machine.getMachineByDaemon(db, daemonId, auth.workspaceId);
  if (machine?.ownerId && machine.ownerId !== auth.userId) {
    return forbidden("daemon_id does not match token owner");
  }

  return { workspaceId: auth.workspaceId, daemonId };
}

export async function withDaemonTaskAccess(
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
