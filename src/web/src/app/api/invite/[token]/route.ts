import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { invalidate, cacheKeys } from "@/lib/cache";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const { token } = ctx.params!;

  const db = getDb(ctx.env.DB);

  const invite = await queries.workspaceInvite.getInviteByTokenForUser(db, token, ctx.userId);
  if (!invite) return writeError("invite not found", 404);
  if (invite.usedBy && invite.usedBy !== ctx.userId) {
    return writeError("invite already used", 410);
  }
  if (!invite.usedBy && new Date(invite.expiresAt) < new Date()) {
    return writeError("invite expired", 410);
  }

  return writeJSON({
    workspace_name: invite.workspaceName,
    workspace_id: invite.workspaceId,
    invited_by: invite.creatorName || invite.creatorEmail,
  });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const { token } = ctx.params!;

  const db = getDb(ctx.env.DB);
  let result: Awaited<ReturnType<typeof queries.workspaceInvite.redeemInviteForUser>>;
  try {
    result = await queries.workspaceInvite.redeemInviteForUser(db, token, ctx.userId);
  } catch {
    return writeError("invite redemption temporarily unavailable", 503);
  }

  if (result.status === "not_found") return writeError("invite not found", 404);
  if (result.status === "expired") return writeError("invite expired", 410);
  if (result.status === "already_member") {
    return writeError("already a member of this workspace", 409);
  }
  if (result.status === "capacity_full") {
    return writeError("workspace capacity reached", 409);
  }
  if (result.status === "used" || result.status === "inconsistent") {
    return writeError("invite already used", 410);
  }

  await invalidate(cacheKeys.allMembers(result.workspaceId));

  return writeJSON({
    workspace_id: result.workspaceId,
    workspace_slug: result.workspaceSlug,
  });
});
