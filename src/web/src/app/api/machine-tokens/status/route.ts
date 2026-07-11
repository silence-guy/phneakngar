import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON } from "@/lib/middleware/helpers";

const CHHLAT_ONLINE_THRESHOLD_MS = 120_000;

export const GET = withAuth(async (_req, ctx) => {
  const db = getDb(ctx.env.DB);

  const token = await queries.machineToken.getLatestTokenForUser(db, ctx.userId);
  if (!token) {
    return writeJSON({ status: null });
  }

  const chhlatOnline = token.lastUsedAt
    ? Date.now() - new Date(token.lastUsedAt).getTime() < CHHLAT_ONLINE_THRESHOLD_MS
    : false;

  return writeJSON({
    status: token.status,
    token: token.status === "pending" ? token.token : undefined,
    workspace_id: token.workspaceId || undefined,
    hostname: token.hostname || undefined,
    chhlat_online: chhlatOnline,
  });
});
