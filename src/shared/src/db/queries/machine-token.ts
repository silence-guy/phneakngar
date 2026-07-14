import { eq, and, desc, isNull, or } from "drizzle-orm";
import { machineToken, user } from "../schema";
import type { Database } from "../index";
import { hashSecret } from "../../utils/secrets";

export async function createMachineToken(
  db: Database,
  data: {
    userId: string;
    workspaceId?: string | null;
    token: string;
    name: string;
    status?: string;
  }
) {
  const rows = await db
    .insert(machineToken)
    .values({
      userId: data.userId,
      workspaceId: data.workspaceId ?? null,
      token: data.token,
      tokenHash: hashSecret(data.token),
      name: data.name,
      status: data.status ?? "active",
    })
    .returning();
  return rows[0]!;
}

export async function getMachineTokenByToken(db: Database, token: string) {
  const tokenHash = hashSecret(token);
  const rows = await db
    .select({
      id: machineToken.id,
      userId: machineToken.userId,
      workspaceId: machineToken.workspaceId,
      tokenHash: machineToken.tokenHash,
      name: machineToken.name,
      status: machineToken.status,
      hostname: machineToken.hostname,
      runtimesJson: machineToken.runtimesJson,
      lastUsedAt: machineToken.lastUsedAt,
      createdAt: machineToken.createdAt,
      userEmail: user.email,
    })
    .from(machineToken)
    .innerJoin(user, eq(user.id, machineToken.userId))
    .where(or(eq(machineToken.tokenHash, tokenHash), eq(machineToken.token, token)));
  const found = rows[0] ?? null;
  if (!found) return null;

  if (!found.tokenHash) {
    await db
      .update(machineToken)
      .set({
        tokenHash,
        ...(found.status === "active" ? { token: `redacted:${found.id}` } : {}),
      })
      .where(eq(machineToken.id, found.id));
  }

  return { ...found, tokenHash };
}

export async function getPendingMachineToken(
  db: Database,
  userId: string,
  workspaceId?: string | null
) {
  const conditions = [
    eq(machineToken.userId, userId),
    eq(machineToken.status, "pending"),
  ];
  if (workspaceId) {
    conditions.push(eq(machineToken.workspaceId, workspaceId));
  } else {
    conditions.push(isNull(machineToken.workspaceId));
  }
  const rows = await db
    .select()
    .from(machineToken)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

export async function activateMachineToken(
  db: Database,
  id: string,
  hostname: string,
) {
  await db
    .update(machineToken)
    .set({ status: "active", hostname, token: `redacted:${id}` })
    .where(eq(machineToken.id, id));
}

export async function claimMachineTokenActivation(
  db: Database,
  id: string,
  hostname: string,
  runtimesJson: string,
) {
  const rows = await db
    .update(machineToken)
    .set({ hostname, runtimesJson })
    .where(
      and(
        eq(machineToken.id, id),
        eq(machineToken.status, "pending"),
        isNull(machineToken.hostname),
        isNull(machineToken.runtimesJson),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function finalizeMachineTokenActivation(
  db: Database,
  id: string,
  hostname: string,
  runtimesJson: string,
) {
  const rows = await db
    .update(machineToken)
    .set({ status: "active", token: `redacted:${id}` })
    .where(
      and(
        eq(machineToken.id, id),
        eq(machineToken.status, "pending"),
        eq(machineToken.hostname, hostname),
        eq(machineToken.runtimesJson, runtimesJson),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function getLatestTokenForUser(db: Database, userId: string, workspaceId?: string) {
  const conditions = [eq(machineToken.userId, userId)];
  if (workspaceId) conditions.push(eq(machineToken.workspaceId, workspaceId));
  const rows = await db
    .select({
      id: machineToken.id,
      status: machineToken.status,
      workspaceId: machineToken.workspaceId,
      token: machineToken.token,
      hostname: machineToken.hostname,
      runtimesJson: machineToken.runtimesJson,
      lastUsedAt: machineToken.lastUsedAt,
    })
    .from(machineToken)
    .where(and(...conditions))
    .orderBy(desc(machineToken.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listMachineTokens(
  db: Database,
  userId: string,
  workspaceId: string
) {
  return db
    .select()
    .from(machineToken)
    .where(
      and(
        eq(machineToken.userId, userId),
        eq(machineToken.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(machineToken.createdAt));
}

export async function deleteMachineToken(
  db: Database,
  id: string,
  userId: string,
  workspaceId: string,
) {
  await db
    .delete(machineToken)
    .where(
      and(
        eq(machineToken.id, id),
        eq(machineToken.userId, userId),
        eq(machineToken.workspaceId, workspaceId),
      ),
    );
}

export async function updateMachineTokenLastUsed(db: Database, id: string) {
  await db
    .update(machineToken)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(machineToken.id, id));
}
