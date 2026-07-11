import { eq, and, sql } from "drizzle-orm";
import { machine } from "../schema";
import type { Database } from "../index";

export async function upsertMachine(
  db: Database,
  data: {
    chhlatId: string;
    workspaceId: string;
    deviceInfo: string;
    lastSeenAt?: string | null;
    ownerId?: string;
  }
) {
  const now = new Date().toISOString();
  const lastSeenAt = data.lastSeenAt === undefined ? now : data.lastSeenAt;
  const rows = await db
    .insert(machine)
    .values({
      chhlatId: data.chhlatId,
      workspaceId: data.workspaceId,
      deviceInfo: data.deviceInfo,
      lastSeenAt,
      createdAt: now,
      updatedAt: now,
      ownerId: data.ownerId,
    })
    .onConflictDoUpdate({
      target: [machine.workspaceId, machine.chhlatId],
      set: {
        deviceInfo: data.deviceInfo,
        lastSeenAt,
        updatedAt: now,
        ownerId: sql`COALESCE(${machine.ownerId}, ${data.ownerId ?? null})`,
      },
    })
    .returning();
  return rows[0]!;
}

export async function updateMachineLastSeen(
  db: Database,
  chhlatId: string,
  workspaceId: string
) {
  const now = new Date().toISOString();
  await db
    .update(machine)
    .set({ lastSeenAt: now, updatedAt: now })
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId))
    );
}

export async function setMachineLastSeenNull(
  db: Database,
  chhlatId: string,
  workspaceId: string
) {
  const now = new Date().toISOString();
  await db
    .update(machine)
    .set({ lastSeenAt: null, updatedAt: now })
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId))
    );
}

export async function getMachineByChhlat(
  db: Database,
  chhlatId: string,
  workspaceId: string
) {
  const rows = await db
    .select()
    .from(machine)
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId))
    );
  return rows[0] ?? null;
}

export async function listMachinesForWorkspace(
  db: Database,
  workspaceId: string,
  userId?: string
) {
  const conditions = [eq(machine.workspaceId, workspaceId)];
  if (userId) conditions.push(eq(machine.ownerId, userId));
  return db
    .select()
    .from(machine)
    .where(and(...conditions));
}

export async function deleteMachine(
  db: Database,
  chhlatId: string,
  workspaceId: string
) {
  await db
    .delete(machine)
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId))
    );
}

export async function setPendingUpdateVersion(
  db: Database,
  chhlatId: string,
  workspaceId: string,
  version: string
) {
  const now = new Date().toISOString();
  await db
    .update(machine)
    .set({ pendingUpdateVersion: version, updatedAt: now })
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId))
    );
}

export async function clearPendingUpdateVersion(
  db: Database,
  chhlatId: string,
  workspaceId: string
) {
  const now = new Date().toISOString();
  await db
    .update(machine)
    .set({ pendingUpdateVersion: null, updatedAt: now })
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId))
    );
}

export async function setPendingRescan(
  db: Database,
  chhlatId: string,
  workspaceId: string,
) {
  const now = new Date().toISOString();
  await db
    .update(machine)
    .set({ pendingRescan: true, updatedAt: now })
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId)),
    );
}

export async function clearPendingRescan(
  db: Database,
  chhlatId: string,
  workspaceId: string,
) {
  const now = new Date().toISOString();
  await db
    .update(machine)
    .set({ pendingRescan: false, updatedAt: now })
    .where(
      and(eq(machine.chhlatId, chhlatId), eq(machine.workspaceId, workspaceId)),
    );
}
