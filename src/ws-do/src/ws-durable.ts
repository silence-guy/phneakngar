import { DurableObject } from "cloudflare:workers"
import {
  createDb,
  queries,
  createLogger,
  validateWsConnectionTicket,
  WS_CHHLAT_TICKET_AUDIENCE,
  WS_TICKET_TTL_SECONDS,
  WS_USER_TICKET_AUDIENCE,
  type WsConnectionTicketPayload,
} from "@phneakngar/shared"

const log = createLogger({ service: "ws-do" })
const MAX_WS_MESSAGE_BYTES = 256 * 1024
const MAX_CONNECTIONS_PER_OBJECT = 256
const WS_TICKET_NONCE_PREFIX = "ws-ticket-nonce:"
const WS_TICKET_CLEANUP_LIMIT = 64

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

type ConnectionState =
  | { type: "user"; userId: string; authenticated: boolean }
  | { type: "chhlat"; workspaceId: string; chhlatId: string; userId: string; authenticated: boolean }

function chhlatDoName(workspaceId: string, chhlatId: string): string {
  return `chhlat:${workspaceId}:${chhlatId}`
}

export class WebSocketDurableObject extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const declaredLength = Number(request.headers.get("Content-Length") ?? "0")
      if (Number.isFinite(declaredLength) && declaredLength > MAX_WS_MESSAGE_BYTES) {
        return new Response("Payload too large", { status: 413 })
      }
      const body = await request.text()
      if (utf8ByteLength(body) > MAX_WS_MESSAGE_BYTES) {
        return new Response("Payload too large", { status: 413 })
      }
      const sent = this.broadcast(body)
      return new Response(JSON.stringify({ sent }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.pathname === "/check-alive") {
      const hasAuthChhlat = this.ctx.getWebSockets().some(ws => {
        const s = ws.deserializeAttachment() as ConnectionState
        return s?.type === "chhlat" && s.authenticated
      })
      return new Response(JSON.stringify({ alive: hasAuthChhlat }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }

    const chhlatId = url.searchParams.get("chhlatId")
    const userId = url.searchParams.get("userId")
    const workspaceId = url.searchParams.get("workspaceId")
    const ticket = url.searchParams.get("ticket")
    if (!chhlatId && !userId) {
      return new Response("userId or chhlatId required", { status: 400 })
    }
    if (chhlatId && (!userId || !workspaceId)) {
      return new Response("chhlat ticket identity required", { status: 400 })
    }

    const ticketResult = chhlatId
      ? await validateWsConnectionTicket(this.env.WS_SERVICE_SECRET, ticket, {
          expectedAudience: WS_CHHLAT_TICKET_AUDIENCE,
          expectedSubject: userId!,
          expectedWorkspaceId: workspaceId!,
          expectedChhlatId: chhlatId,
        })
      : await validateWsConnectionTicket(this.env.WS_SERVICE_SECRET, ticket, {
          expectedAudience: WS_USER_TICKET_AUDIENCE,
          expectedSubject: userId!,
        })
    if (!ticketResult.ok) {
      return new Response("Unauthorized", { status: 401 })
    }
    const consumed = await this.consumeTicketNonce(ticketResult.payload)
    if (!consumed) {
      return new Response("Unauthorized", { status: 401 })
    }

    const existingSockets = this.ctx.getWebSockets()
    if (existingSockets.length >= MAX_CONNECTIONS_PER_OBJECT) {
      return new Response("Connection capacity reached", { status: 503 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    const initialState: ConnectionState = chhlatId
      ? { type: "chhlat", workspaceId: workspaceId!, chhlatId, userId: userId!, authenticated: true }
      : { type: "user", userId: userId!, authenticated: true }
    server.serializeAttachment(initialState)
    server.send(JSON.stringify({ type: "auth.ok" }))

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    )

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      ws.close(1003, "Binary messages are not supported")
      return
    }
    if (utf8ByteLength(message) > MAX_WS_MESSAGE_BYTES) {
      ws.close(1009, "Message too large")
      return
    }

    let parsed: unknown
    try { parsed = JSON.parse(message) } catch { ws.close(1008, "Invalid JSON"); return }

    const state = ws.deserializeAttachment() as ConnectionState

    const msg = parsed as {
      type: string
      token?: string
      machineToken?: string
      chhlatId?: string
      workspaceId?: string
    }
    const msgChhlatId = msg.chhlatId

    if (msg.type === "auth") {
      if (state?.type === "user" && state.authenticated) {
        ws.send(JSON.stringify({ type: "auth.ok" }))
        return
      }
      if (state?.type === "chhlat" && state.authenticated) {
        ws.send(JSON.stringify({ type: "auth.ok" }))
        return
      }
      if (msg.machineToken && msgChhlatId) {
        if (state?.type !== "chhlat" || state.chhlatId !== msgChhlatId || (msg.workspaceId && state.workspaceId !== msg.workspaceId)) {
          log.warn("chhlat websocket route mismatch", { chhlatId: msgChhlatId })
          ws.close(1008, "Unauthorized")
          return
        }

        const authResult = await this.validateMachineToken(msg.machineToken, state.workspaceId, msgChhlatId)
        if (!authResult) {
          log.warn("chhlat websocket auth failed", { chhlatId: msgChhlatId })
          ws.close(1008, "Unauthorized")
          return
        }
        ws.serializeAttachment({ type: "chhlat", workspaceId: state.workspaceId, chhlatId: msgChhlatId, userId: authResult.userId, authenticated: true } as ConnectionState)
        log.info("chhlat websocket authenticated", { workspaceId: state.workspaceId, chhlatId: msgChhlatId })
        ws.send(JSON.stringify({ type: "auth.ok" }))

        this.notifyUserDO(authResult.userId, { type: "runtime.status", workspaceId: state.workspaceId, status: "online", chhlatId: msgChhlatId }).catch(() => {})
        return
      }

      if (!msg.token || state?.type !== "user") {
        ws.close(1008, "Unauthorized")
        return
      }
      const userId = await this.validateToken(msg.token)
      if (!userId || userId !== state.userId) {
        log.warn("websocket auth failed")
        ws.close(1008, "Unauthorized")
        return
      }
      ws.serializeAttachment({ type: "user", userId, authenticated: true } as ConnectionState)
      log.info("websocket authenticated", { userId })
      ws.send(JSON.stringify({ type: "auth.ok" }))
      return
    }

    if (!state.authenticated) {
      ws.close(1008, "Not authenticated")
      return
    }

    if (msg.type === "check_chhlat_status" && state.type === "user") {
      const workspaceId = msg.workspaceId
      if (!workspaceId) return
      const chhlatId = await this.getChhlatIdForUser(state.userId, workspaceId)
      if (chhlatId) {
        try {
          const doId = this.env.WS_DO.idFromName(chhlatDoName(workspaceId, chhlatId))
          const stub = this.env.WS_DO.get(doId)
          const resp = await stub.fetch(new Request("http://internal/check-alive"))
          const body = await resp.json() as { alive: boolean }
          if (body.alive) {
            ws.send(JSON.stringify({ type: "runtime.status", workspaceId, status: "online", chhlatId }))
          }
        } catch {
          log.debug("check_chhlat_status: failed to reach chhlat DO", { workspaceId, chhlatId })
        }
      }
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const state = ws.deserializeAttachment() as ConnectionState
    if (state?.type === "chhlat" && state.authenticated) {
      log.info("chhlat websocket closed", { workspaceId: state.workspaceId, chhlatId: state.chhlatId })
      this.notifyUserDO(state.userId, { type: "runtime.status", workspaceId: state.workspaceId, status: "offline", chhlatId: state.chhlatId }).catch(() => {})
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    log.error("websocket error", { err: error instanceof Error ? error : String(error) })
    try { ws.close(1011, "Internal error") } catch {}
  }

  private broadcast(message: string): number {
    let sent = 0
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment() as ConnectionState
      if (state.authenticated) {
        try {
          ws.send(message)
          sent++
        } catch {}
      }
    }
    return sent
  }

  private async notifyUserDO(userId: string, payload: unknown): Promise<void> {
    const userDoId = this.env.WS_DO.idFromName("user:" + userId)
    const userStub = this.env.WS_DO.get(userDoId)
    await userStub.fetch(new Request("http://internal/broadcast", {
      method: "POST",
      body: JSON.stringify(payload),
    }))
  }

  private async getChhlatIdForUser(userId: string, workspaceId: string): Promise<string | null> {
    const db = createDb(this.env.DB)
    const token = await queries.machineToken.getLatestTokenForUser(db, userId, workspaceId)
    return token?.hostname || null
  }

  private async validateToken(token: string): Promise<string | null> {
    const db = createDb(this.env.DB)
    return queries.session.getValidSession(db, token)
  }

  private async consumeTicketNonce(payload: WsConnectionTicketPayload): Promise<boolean> {
    const key = `${WS_TICKET_NONCE_PREFIX}${payload.aud}:${payload.nonce}`
    const nowSeconds = Math.floor(Date.now() / 1000)
    await this.cleanupExpiredTicketNonces(nowSeconds)
    const existing = await this.ctx.storage.get<{ expiresAt: number }>(key)
    if (existing && existing.expiresAt > nowSeconds) return false
    if (existing) await this.ctx.storage.delete(key)
    await this.ctx.storage.put(key, { expiresAt: payload.exp + WS_TICKET_TTL_SECONDS })
    return true
  }

  private async cleanupExpiredTicketNonces(nowSeconds: number): Promise<void> {
    const entries = await this.ctx.storage.list<{ expiresAt: number }>({
      prefix: WS_TICKET_NONCE_PREFIX,
      limit: WS_TICKET_CLEANUP_LIMIT,
    })
    const expiredKeys: string[] = []
    for (const [key, value] of entries) {
      if (value.expiresAt <= nowSeconds) expiredKeys.push(key)
    }
    await Promise.all(expiredKeys.map((key) => this.ctx.storage.delete(key)))
  }

  private async validateMachineToken(token: string, workspaceId: string, chhlatId: string): Promise<{ userId: string } | null> {
    if (!token.startsWith("al_")) return null
    const db = createDb(this.env.DB)
    const mt = await queries.machineToken.getMachineTokenByToken(db, token)
    if (!mt) return null
    if (mt.status !== "active" || mt.workspaceId !== workspaceId) return null
    if (mt.hostname !== chhlatId) return null

    const machine = await queries.machine.getMachineByChhlat(db, chhlatId, mt.workspaceId)
    if (!machine || machine.ownerId !== mt.userId) return null

    const runtimes = await queries.runtime.getRuntimeIdsByChhlat(db, chhlatId, mt.workspaceId)
    return runtimes.length > 0 ? { userId: mt.userId } : null
  }
}
