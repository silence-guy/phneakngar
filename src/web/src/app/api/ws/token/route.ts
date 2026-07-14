import { NextRequest } from "next/server"
import { DEV_WS_DO_URL, issueWsConnectionTicket, WS_CHHLAT_TICKET_AUDIENCE } from "@phneakngar/shared"
import { withAuth } from "@/lib/middleware/auth"

export const GET = withAuth(async (req: NextRequest, ctx) => {
  if (!ctx.env.WS_SERVICE_SECRET) {
    return new Response("WebSocket ticket signing is not configured", { status: 503 })
  }

  const wsDoUrl = (ctx.env as unknown as Record<string, unknown>).DEV_WS_DO_URL as string | undefined
  let wsPort: number | undefined
  try {
    wsPort = new URL(wsDoUrl || DEV_WS_DO_URL).port ? Number(new URL(wsDoUrl || DEV_WS_DO_URL).port) : undefined
  } catch {}

  if (ctx.authType === "machine") {
    const chhlatId = req.nextUrl.searchParams.get("chhlat_id")?.trim()
    if (!chhlatId) return new Response("chhlat_id is required", { status: 400 })
    if (!ctx.workspaceId) return new Response("machine token workspace is required", { status: 403 })
    if (!ctx.machineTokenHostname) return new Response("machine token is not bound to a chhlat_id", { status: 403 })
    if (ctx.machineTokenHostname !== chhlatId) return new Response("chhlat_id does not match token hostname", { status: 403 })

    const { ticket, payload } = await issueWsConnectionTicket(ctx.env.WS_SERVICE_SECRET, {
      userId: ctx.userId,
      audience: WS_CHHLAT_TICKET_AUDIENCE,
      workspaceId: ctx.workspaceId,
      chhlatId,
    })
    return Response.json({
      chhlatId,
      workspaceId: ctx.workspaceId,
      ticket,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      ...(wsPort && { wsPort }),
    })
  }

  const { ticket, payload } = await issueWsConnectionTicket(ctx.env.WS_SERVICE_SECRET, {
    userId: ctx.userId,
  })

  return Response.json({
    userId: ctx.userId,
    ticket,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    ...(wsPort && { wsPort }),
  })
});
