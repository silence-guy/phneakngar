import { DurableObject } from "cloudflare:workers"
import { createDb, queries, createLogger } from "@phneakngar/shared"

const log = createLogger({ service: "ws-do" })
const MAX_WS_MESSAGE_BYTES = 256 * 1024
const MAX_CONNECTIONS_PER_OBJECT = 256
const MAX_UNAUTHENTICATED_CONNECTIONS = 32

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

type ConnectionState =
  | { type: "user"; userId: string; authenticated: boolean }
  | { type: "chhlat"; chhlatId: string; userId: string; authenticated: boolean }

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
    if (!chhlatId && !userId) {
      return new Response("userId or chhlatId required", { status: 400 })
    }

    const existingSockets = this.ctx.getWebSockets()
    if (existingSockets.length >= MAX_CONNECTIONS_PER_OBJECT) {
      return new Response("Connection capacity reached", { status: 503 })
    }
    const unauthenticatedCount = existingSockets.reduce((count, socket) => {
      const state = socket.deserializeAttachment() as ConnectionState | undefined
      return count + (state?.authenticated ? 0 : 1)
    }, 0)
    if (unauthenticatedCount >= MAX_UNAUTHENTICATED_CONNECTIONS) {
      return new Response("Authentication capacity reached", { status: 429 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    const initialState: ConnectionState = chhlatId
      ? { type: "chhlat", chhlatId, userId: "", authenticated: false }
      : { type: "user", userId: userId!, authenticated: false }
    server.serializeAttachment(initialState)

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
    }
    const msgChhlatId = msg.chhlatId

    if (msg.type === "auth") {
      if (msg.machineToken && msgChhlatId) {
        if (state?.type !== "chhlat" || state.chhlatId !== msgChhlatId) {
          log.warn("chhlat websocket route mismatch", { chhlatId: msgChhlatId })
          ws.close(1008, "Unauthorized")
          return
        }

        const authResult = await this.validateMachineToken(msg.machineToken, msgChhlatId)
        if (!authResult) {
          log.warn("chhlat websocket auth failed", { chhlatId: msgChhlatId })
          ws.close(1008, "Unauthorized")
          return
        }
        ws.serializeAttachment({ type: "chhlat", chhlatId: msgChhlatId, userId: authResult.userId, authenticated: true } as ConnectionState)
        log.info("chhlat websocket authenticated", { chhlatId: msgChhlatId })
        ws.send(JSON.stringify({ type: "auth.ok" }))

        this.notifyUserDO(authResult.userId, { type: "runtime.status", status: "online", chhlatId: msgChhlatId }).catch(() => {})
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
      const chhlatId = await this.getChhlatIdForUser(state.userId)
      if (chhlatId) {
        try {
          const doId = this.env.WS_DO.idFromName("chhlat:" + chhlatId)
          const stub = this.env.WS_DO.get(doId)
          const resp = await stub.fetch(new Request("http://internal/check-alive"))
          const body = await resp.json() as { alive: boolean }
          if (body.alive) {
            ws.send(JSON.stringify({ type: "runtime.status", status: "online", chhlatId }))
          }
        } catch {
          log.debug("check_chhlat_status: failed to reach chhlat DO", { chhlatId })
        }
      }
      return
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const state = ws.deserializeAttachment() as ConnectionState
    if (state?.type === "chhlat" && state.authenticated) {
      log.info("chhlat websocket closed", { chhlatId: state.chhlatId })
      this.notifyUserDO(state.userId, { type: "runtime.status", status: "offline", chhlatId: state.chhlatId }).catch(() => {})
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

  private async getChhlatIdForUser(userId: string): Promise<string | null> {
    const db = createDb(this.env.DB)
    const token = await queries.machineToken.getLatestTokenForUser(db, userId)
    return token?.hostname || null
  }

  private async validateToken(token: string): Promise<string | null> {
    const db = createDb(this.env.DB)
    return queries.session.getValidSession(db, token)
  }

  private async validateMachineToken(token: string, chhlatId: string): Promise<{ userId: string } | null> {
    if (!token.startsWith("al_")) return null
    const db = createDb(this.env.DB)
    const mt = await queries.machineToken.getMachineTokenByToken(db, token)
    if (!mt) return null
    if (mt.status !== "active" || !mt.workspaceId) return null

    const machine = await queries.machine.getMachineByChhlat(db, chhlatId, mt.workspaceId)
    if (!machine || machine.ownerId !== mt.userId) return null

    const runtimes = await queries.runtime.getRuntimeIdsByChhlat(db, chhlatId, mt.workspaceId)
    return runtimes.length > 0 ? { userId: mt.userId } : null
  }
}
