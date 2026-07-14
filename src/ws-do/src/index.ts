import {
  createLogger,
  validateWsConnectionTicket,
  WS_CHHLAT_TICKET_AUDIENCE,
  WS_SERVICE_SECRET_HEADER,
  WS_USER_TICKET_AUDIENCE,
} from "@phneakngar/shared"
import { safeEqualSecret } from "@phneakngar/shared/secrets"

export { WebSocketDurableObject } from "./ws-durable"

const log = createLogger({ service: "ws-do" })

function isLocalWebSocketUpgrade(request: Request, url: URL): boolean {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return false
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]"
}

function chhlatDoName(workspaceId: string, chhlatId: string): string {
  return `chhlat:${workspaceId}:${chhlatId}`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok" })
    }

    if (!isLocalWebSocketUpgrade(request, url)) {
      if (!env.WS_SERVICE_SECRET) {
        return Response.json({ error: "internal authentication is not configured" }, { status: 503 })
      }
      if (!safeEqualSecret(request.headers.get(WS_SERVICE_SECRET_HEADER), env.WS_SERVICE_SECRET)) {
        return Response.json({ error: "unauthorized" }, { status: 401 })
      }
    }

    const traceId = request.headers.get("X-Trace-Id") ?? undefined

    const chhlatBroadcast = url.pathname.match(/^\/broadcast\/chhlat\/([^/]+)\/(.+)$/)
    if (chhlatBroadcast && request.method === "POST") {
      const workspaceId = decodeURIComponent(chhlatBroadcast[1]!)
      const chhlatId = decodeURIComponent(chhlatBroadcast[2]!)
      const reqLog = log.child({ traceId, workspaceId, chhlatId })
      reqLog.debug("broadcasting to chhlat")
      const doId = env.WS_DO.idFromName(chhlatDoName(workspaceId, chhlatId))
      const stub = env.WS_DO.get(doId)
      return stub.fetch(
        new Request("http://internal/broadcast", {
          method: "POST",
          body: request.body,
          duplex: "half",
        } as RequestInit),
      )
    }

    const userBroadcast = url.pathname.match(/^\/broadcast\/user\/(.+)$/)
    if (userBroadcast && request.method === "POST") {
      const userId = userBroadcast[1]
      const reqLog = log.child({ traceId, userId })
      reqLog.debug("broadcasting to user")
      const doId = env.WS_DO.idFromName("user:" + userId)
      const stub = env.WS_DO.get(doId)
      return stub.fetch(
        new Request("http://internal/broadcast", {
          method: "POST",
          body: request.body,
          duplex: "half",
        } as RequestInit),
      )
    }

    const ticket = url.searchParams.get("ticket")
    if (!ticket) return new Response("ticket required", { status: 400 })
    const audienceHint = url.pathname === "/api/ws/chhlat" ? WS_CHHLAT_TICKET_AUDIENCE : undefined
    const ticketResult = await validateWsConnectionTicket(env.WS_SERVICE_SECRET, ticket, {
      ...(audienceHint ? { expectedAudience: audienceHint } : {}),
    })
    if (!ticketResult.ok) {
      log.warn("websocket ticket rejected", { traceId, reason: ticketResult.reason })
      return new Response("Unauthorized", { status: 401 })
    }

    if (ticketResult.payload.aud === WS_CHHLAT_TICKET_AUDIENCE) {
      const chhlatId = ticketResult.payload.chhlatId
      const workspaceId = ticketResult.payload.workspaceId
      if (!chhlatId || !workspaceId) return new Response("Unauthorized", { status: 401 })
      const queryChhlatId = url.searchParams.get("chhlatId")
      if (queryChhlatId && queryChhlatId !== chhlatId) {
        log.warn("chhlat websocket ticket route mismatch", { traceId })
        return new Response("Unauthorized", { status: 401 })
      }
      const reqLog = log.child({ traceId, workspaceId, chhlatId })
      reqLog.info("chhlat websocket upgrade")
      const doId = env.WS_DO.idFromName(chhlatDoName(workspaceId, chhlatId))
      const stub = env.WS_DO.get(doId)
      const routedUrl = new URL(request.url)
      routedUrl.searchParams.set("chhlatId", chhlatId)
      routedUrl.searchParams.set("workspaceId", workspaceId)
      routedUrl.searchParams.set("userId", ticketResult.payload.sub)
      return stub.fetch(new Request(routedUrl.toString(), request))
    }

    if (ticketResult.payload.aud !== WS_USER_TICKET_AUDIENCE) {
      return new Response("Unauthorized", { status: 401 })
    }
    const queryUserId = url.searchParams.get("userId")
    if (queryUserId && queryUserId !== ticketResult.payload.sub) {
      log.warn("websocket ticket subject mismatch", { traceId })
      return new Response("Unauthorized", { status: 401 })
    }

    const userId = ticketResult.payload.sub
    const reqLog = log.child({ traceId, userId })
    reqLog.info("websocket upgrade")
    const doId = env.WS_DO.idFromName("user:" + userId)
    const stub = env.WS_DO.get(doId)
    const routedUrl = new URL(request.url)
    routedUrl.searchParams.set("userId", userId)
    return stub.fetch(new Request(routedUrl.toString(), request))
  },
}
