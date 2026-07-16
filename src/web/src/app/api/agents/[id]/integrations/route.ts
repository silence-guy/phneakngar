import { NextRequest } from "next/server";
import {
  CreateIntegrationRequestSchema,
  isUniqueConstraintError,
  queries,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = ctx.params?.id;
  if (!agentId) return writeError("agent id is required", 400);

  const agent = await queries.agent.getAgent(db, agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found", 404);

  const rows = await queries.agentIntegration.listIntegrationsForAgent(
    db,
    ws.workspaceId,
    agentId
  );

  return writeJSON({
    integrations: rows.map((row) => queries.agentIntegration.toPublicIntegration(row)),
  });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = ctx.params?.id;
  if (!agentId) return writeError("agent id is required", 400);

  const agent = await queries.agent.getAgent(db, agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found", 404);

  const [body, err] = await parseBody(req, CreateIntegrationRequestSchema);
  if (err) return err;

  try {
    const created = await queries.agentIntegration.createIntegration(db, {
      workspaceId: ws.workspaceId,
      agentId,
      provider: body.provider,
      status: body.status,
      config: body.config,
      secretRef: body.secret_ref ?? null,
    });
    return writeJSON(queries.agentIntegration.toPublicIntegration(created), 201);
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return writeError("integration for this provider already exists", 409);
    }
    throw e;
  }
});
