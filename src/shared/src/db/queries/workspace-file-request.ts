import { eq, and, inArray, lt, asc } from "drizzle-orm";
import { workspaceFileRequest } from "../schema";
import type { Database } from "../index";
import { MAX_POLL_FILE_REQUESTS } from "../../constants";

export async function createRequest(
  db: Database,
  data: {
    workspaceId: string;
    agentId: string;
    requestType: string;
    path: string;
  },
) {
  const rows = await db
    .insert(workspaceFileRequest)
    .values(data)
    .returning();
  return rows[0]!;
}

export async function getPendingByWorkspace(
  db: Database,
  workspaceId: string,
  limit = MAX_POLL_FILE_REQUESTS,
) {
  return db
    .select()
    .from(workspaceFileRequest)
    .where(
      and(
        eq(workspaceFileRequest.workspaceId, workspaceId),
        eq(workspaceFileRequest.status, "pending"),
      ),
    )
    .orderBy(asc(workspaceFileRequest.createdAt), asc(workspaceFileRequest.id))
    .limit(Math.max(1, Math.min(limit, MAX_POLL_FILE_REQUESTS)));
}

export async function claimPendingByWorkspace(
  db: Database,
  workspaceId: string,
  limit = MAX_POLL_FILE_REQUESTS,
) {
  const selected = await getPendingByWorkspace(db, workspaceId, limit);
  if (selected.length === 0) return [];

  const now = new Date().toISOString();
  const selectedOrder = new Map(selected.map((row, index) => [row.id, index]));
  const claimed = (
    await Promise.all(
      selected.map((row) =>
        db
          .update(workspaceFileRequest)
          .set({ status: "dispatched", updatedAt: now })
          .where(
            and(
              eq(workspaceFileRequest.id, row.id),
              eq(workspaceFileRequest.workspaceId, workspaceId),
              eq(workspaceFileRequest.status, "pending"),
            ),
          )
          .returning(),
      ),
    )
  ).flat();

  return claimed.sort((left, right) =>
    (selectedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
    - (selectedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
}

export async function markDispatched(db: Database, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(workspaceFileRequest)
    .set({ status: "dispatched", updatedAt: new Date().toISOString() })
    .where(inArray(workspaceFileRequest.id, ids));
}

export async function completeRequest(
  db: Database,
  id: string,
  result: unknown,
) {
  const rows = await db
    .update(workspaceFileRequest)
    .set({
      status: "completed",
      result: JSON.stringify(result),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workspaceFileRequest.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function completeRequestForWorkspace(
  db: Database,
  workspaceId: string,
  id: string,
  result: unknown,
) {
  const rows = await db
    .update(workspaceFileRequest)
    .set({
      status: "completed",
      result: JSON.stringify(result),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(workspaceFileRequest.workspaceId, workspaceId),
        eq(workspaceFileRequest.id, id),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function getRequest(db: Database, id: string) {
  const rows = await db
    .select()
    .from(workspaceFileRequest)
    .where(eq(workspaceFileRequest.id, id));
  return rows[0] ?? null;
}

export async function getRequestForWorkspace(
  db: Database,
  workspaceId: string,
  id: string,
) {
  const rows = await db
    .select()
    .from(workspaceFileRequest)
    .where(
      and(
        eq(workspaceFileRequest.workspaceId, workspaceId),
        eq(workspaceFileRequest.id, id),
      ),
    );
  return rows[0] ?? null;
}

export async function expireStale(db: Database, workspaceId: string) {
  const cutoff = new Date(Date.now() - 30_000).toISOString();
  await db
    .delete(workspaceFileRequest)
    .where(
      and(
        eq(workspaceFileRequest.workspaceId, workspaceId),
        lt(workspaceFileRequest.createdAt, cutoff),
      ),
    );
}
