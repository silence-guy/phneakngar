import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockCtx, createMockWebSocket } from "./__mocks__/cf"

// --- Cloudflare Workers globals that don't exist in Node ---

// Replace the global Response with one that allows status 101 and a webSocket property
class CFResponse {
  status: number
  webSocket: unknown
  private _body: BodyInit | null
  private _headers: Headers

  constructor(body: BodyInit | null = null, init: ResponseInit & { webSocket?: unknown } = {}) {
    this._body = body
    this._headers = new Headers(init.headers)
    this.status = init.status ?? 200
    this.webSocket = (init as { webSocket?: unknown }).webSocket
  }

  async text(): Promise<string> {
    if (this._body == null) return ""
    if (typeof this._body === "string") return this._body
    return ""
  }

  async json(): Promise<unknown> {
    return JSON.parse(await this.text())
  }

  get headers() { return this._headers }
}

globalThis.Response = CFResponse as unknown as typeof Response

// WebSocketPair — creates a paired (client, server) mock
globalThis.WebSocketPair = class {
  0: ReturnType<typeof createMockWebSocket>
  1: ReturnType<typeof createMockWebSocket>
  constructor() {
    this[0] = createMockWebSocket()
    this[1] = createMockWebSocket()
  }
} as unknown as typeof WebSocketPair

// WebSocketRequestResponsePair — used for the ping/pong auto-response
globalThis.WebSocketRequestResponsePair = class {
  constructor(public request: string, public response: string) {}
} as unknown as typeof WebSocketRequestResponsePair

// --- Module mocks ---

// Mock cloudflare:workers DurableObject base class
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown
    env: unknown
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx
      this.env = env
    }
  },
}))

// Mock @phneakngar/shared
const mockGetValidSession = vi.fn<(db: unknown, token: string) => Promise<string | null>>()
const mockGetMachineTokenByToken = vi.fn()
const mockGetLatestTokenForUser = vi.fn()
const mockGetRuntimeIdsByChhlat = vi.fn()
const mockGetMachineByChhlat = vi.fn()
const mockCreateDb = vi.fn().mockReturnValue({})
const mockValidateWsConnectionTicket = vi.fn()

vi.mock("@phneakngar/shared", () => {
  const noopLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => noopLogger,
  }
  return {
    createDb: (d1: unknown) => mockCreateDb(d1),
    createLogger: () => noopLogger,
    validateWsConnectionTicket: (...a: any[]) => mockValidateWsConnectionTicket(...a),
    WS_CHHLAT_TICKET_AUDIENCE: "chhlat-ws",
    WS_TICKET_TTL_SECONDS: 60,
    WS_USER_TICKET_AUDIENCE: "user-ws",
    queries: {
      session: { getValidSession: (db: unknown, token: string) => mockGetValidSession(db, token) },
      machineToken: {
        getMachineTokenByToken: (...a: any[]) => mockGetMachineTokenByToken(...a),
        getLatestTokenForUser: (...a: any[]) => mockGetLatestTokenForUser(...a),
      },
      machine: { getMachineByChhlat: (...a: any[]) => mockGetMachineByChhlat(...a) },
      runtime: { getRuntimeIdsByChhlat: (...a: any[]) => mockGetRuntimeIdsByChhlat(...a) },
    },
  }
})

// Import after mocks
import { WebSocketDurableObject } from "./ws-durable"

const mockStubFetch = vi.fn().mockResolvedValue(new (globalThis.Response as any)(JSON.stringify({ sent: 1 })))
const mockCheckAliveFetch = vi.fn().mockResolvedValue(new (globalThis.Response as any)(JSON.stringify({ alive: true })))

function createDO() {
  const { ctx, getWebSockets, storage, storageMap } = createMockCtx()
  const stubGet = vi.fn().mockReturnValue({ fetch: mockStubFetch })
  const env = {
    DB: {} as D1Database,
    WS_DO: {
      idFromName: vi.fn().mockReturnValue("mock-do-id"),
      get: stubGet,
    } as unknown as DurableObjectNamespace,
    WS_SERVICE_SECRET: "ws-service-secret",
  }
  const durable = new WebSocketDurableObject(ctx, env)
  return { durable, ctx, getWebSockets, env, stubGet, storage, storageMap }
}

describe("WebSocketDurableObject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMachineByChhlat.mockResolvedValue({ ownerId: "u1" })
    mockValidateWsConnectionTicket.mockResolvedValue({
      ok: true,
      payload: { aud: "user-ws", sub: "u1", nonce: "nonce-1", exp: Math.floor(Date.now() / 1000) + 60 },
    })
  })

  describe("fetch — WebSocket upgrade", () => {
    it("returns 101 for valid WebSocket upgrade", async () => {
      const { durable } = createDO()
      const req = new Request("http://internal/?userId=u1&ticket=t1", {
        headers: { Upgrade: "websocket" },
      })

      const res = await durable.fetch(req)

      expect(res.status).toBe(101)
      expect((res as unknown as CFResponse).webSocket).toBeDefined()
    })

    it("returns 426 for non-WebSocket request", async () => {
      const { durable } = createDO()
      const req = new Request("http://internal/")

      const res = await durable.fetch(req)

      expect(res.status).toBe(426)
    })

    it("attaches an authenticated user ConnectionState on upgrade", async () => {
      const { durable, ctx } = createDO()
      const req = new Request("http://internal/?userId=u1&ticket=t1", {
        headers: { Upgrade: "websocket" },
      })

      await durable.fetch(req)

      const acceptCall = (ctx.acceptWebSocket as ReturnType<typeof vi.fn>).mock.calls[0]
      const serverWs = acceptCall[0]
      expect(serverWs.deserializeAttachment()).toEqual({ type: "user", userId: "u1", authenticated: true })
      expect(serverWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "auth.ok" }))
    })

    it("rejects user upgrade when the ticket does not match routed user", async () => {
      const { durable, ctx } = createDO()
      mockValidateWsConnectionTicket.mockResolvedValue({ ok: false, reason: "wrong-subject" })
      const req = new Request("http://internal/?userId=u1&ticket=t1", {
        headers: { Upgrade: "websocket" },
      })

      const res = await durable.fetch(req)

      expect(res.status).toBe(401)
      expect(ctx.acceptWebSocket).not.toHaveBeenCalled()
    })

    it("attaches an authenticated chhlat ConnectionState on chhlat ticket upgrade", async () => {
      const { durable, ctx } = createDO()
      mockValidateWsConnectionTicket.mockResolvedValue({
        ok: true,
        payload: { aud: "chhlat-ws", sub: "u1", workspaceId: "w1", chhlatId: "my-chhlat", nonce: "nonce-chhlat-1", exp: Math.floor(Date.now() / 1000) + 60 },
      })
      const req = new Request("http://internal/?chhlatId=my-chhlat&workspaceId=w1&userId=u1&ticket=t1", {
        headers: { Upgrade: "websocket" },
      })

      const res = await durable.fetch(req)

      expect(res.status).toBe(101)
      const acceptCall = (ctx.acceptWebSocket as ReturnType<typeof vi.fn>).mock.calls[0]
      const serverWs = acceptCall[0]
      expect(serverWs.deserializeAttachment()).toEqual({ type: "chhlat", workspaceId: "w1", chhlatId: "my-chhlat", userId: "u1", authenticated: true })
      expect(serverWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "auth.ok" }))
    })

    it("rejects a replayed ticket nonce before accepting a second socket", async () => {
      const { durable, ctx } = createDO()
      const req = new Request("http://internal/?userId=u1&ticket=t1", {
        headers: { Upgrade: "websocket" },
      })

      expect((await durable.fetch(req)).status).toBe(101)
      expect((await durable.fetch(req)).status).toBe(401)
      expect(ctx.acceptWebSocket).toHaveBeenCalledTimes(1)
    })

    it("cleans expired consumed ticket nonces with a bounded durable storage listing", async () => {
      const { durable, storage, storageMap } = createDO()
      storageMap.set("ws-ticket-nonce:user-ws:expired-1", { expiresAt: Math.floor(Date.now() / 1000) - 10 })
      storageMap.set("ws-ticket-nonce:user-ws:active-1", { expiresAt: Math.floor(Date.now() / 1000) + 100 })
      const req = new Request("http://internal/?userId=u1&ticket=t1", {
        headers: { Upgrade: "websocket" },
      })

      const res = await durable.fetch(req)

      expect(res.status).toBe(101)
      expect(storage.list).toHaveBeenCalledWith({ prefix: "ws-ticket-nonce:", limit: 64 })
      expect(storageMap.has("ws-ticket-nonce:user-ws:expired-1")).toBe(false)
      expect(storageMap.has("ws-ticket-nonce:user-ws:active-1")).toBe(true)
    })
  })

  describe("fetch — broadcast", () => {
    it("sends message to all authenticated connections", async () => {
      const { durable, ctx } = createDO()

      // Set up two WebSockets: one authenticated, one not
      const wsAuth = createMockWebSocket()
      wsAuth.serializeAttachment({ type: "user", userId: "u1", authenticated: true })
      const wsUnauth = createMockWebSocket()
      wsUnauth.serializeAttachment({ type: "user", userId: "", authenticated: false })
      ;(ctx.getWebSockets as ReturnType<typeof vi.fn>).mockReturnValue([wsAuth, wsUnauth])

      const req = new Request("http://internal/broadcast", {
        method: "POST",
        body: JSON.stringify({ type: "runtime.status", chhlatId: "d1", workspaceId: "w1", status: "online" }),
      })

      const res = await durable.fetch(req)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 1 })
      expect(wsAuth.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "runtime.status", chhlatId: "d1", workspaceId: "w1", status: "online" })
      )
      expect(wsUnauth.send).not.toHaveBeenCalled()
    })

    it("returns sent: 0 when no connections exist", async () => {
      const { durable, ctx } = createDO()
      ;(ctx.getWebSockets as ReturnType<typeof vi.fn>).mockReturnValue([])

      const req = new Request("http://internal/broadcast", {
        method: "POST",
        body: '{"type":"test"}',
      })

      const res = await durable.fetch(req)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 0 })
    })

    it("skips connections that throw on send (already closed)", async () => {
      const { durable, ctx } = createDO()

      const wsOpen = createMockWebSocket(WebSocket.OPEN)
      wsOpen.serializeAttachment({ type: "user", userId: "u1", authenticated: true })
      const wsClosed = createMockWebSocket(WebSocket.CLOSED)
      wsClosed.serializeAttachment({ type: "user", userId: "u1", authenticated: true })
      wsClosed.send.mockImplementation(() => { throw new Error("Connection closed") })
      ;(ctx.getWebSockets as ReturnType<typeof vi.fn>).mockReturnValue([wsOpen, wsClosed])

      const req = new Request("http://internal/broadcast", {
        method: "POST",
        body: '{"type":"test"}',
      })

      const res = await durable.fetch(req)

      expect(wsOpen.send).toHaveBeenCalled()
      expect(wsClosed.send).toHaveBeenCalled()
      expect(await res.json()).toEqual({ sent: 1 })
    })
  })

  describe("webSocketMessage — auth flow", () => {
    it("authenticates with valid token and sends auth.ok", async () => {
      const { durable } = createDO()
      mockGetValidSession.mockResolvedValue("user-42")

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "auth", token: "valid-token" }))

      expect(mockGetValidSession).toHaveBeenCalledWith({}, "valid-token")
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "auth.ok" }))
      expect(ws.deserializeAttachment()).toEqual({ type: "user", userId: "user-42", authenticated: true })
    })

    it("closes when a valid session token is used on another user's route", async () => {
      const { durable } = createDO()
      mockGetValidSession.mockResolvedValue("attacker-user")

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "victim-user", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "auth", token: "valid-token" }))

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(ws.send).not.toHaveBeenCalled()
      expect(ws.deserializeAttachment()).toEqual({ type: "user", userId: "victim-user", authenticated: false })
    })

    it("closes with 1008 on invalid token", async () => {
      const { durable } = createDO()
      mockGetValidSession.mockResolvedValue(null)

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "auth", token: "bad" }))

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(ws.send).not.toHaveBeenCalled()
    })

    it("closes with 1008 when auth message has no token", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "auth" }))

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(ws.send).not.toHaveBeenCalled()
      expect(mockGetValidSession).not.toHaveBeenCalled()
    })

    it("closes with 1008 when auth message has empty string token", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "auth", token: "" }))

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(ws.send).not.toHaveBeenCalled()
      expect(mockGetValidSession).not.toHaveBeenCalled()
    })

    it("closes unauthenticated connection sending non-auth message", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "some-event" }))

      expect(ws.close).toHaveBeenCalledWith(1008, "Not authenticated")
    })

    it("closes with 1008 when session token is expired (getValidSession returns null)", async () => {
      const { durable } = createDO()
      mockGetValidSession.mockResolvedValue(null)

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: false })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "auth", token: "expired-token" }))

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(ws.send).not.toHaveBeenCalled()
      expect(ws.deserializeAttachment()).toEqual({ type: "user", userId: "user-42", authenticated: false })
    })

    it("closes on invalid JSON", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()

      await durable.webSocketMessage(ws as any, "not-json")

      expect(ws.close).toHaveBeenCalledWith(1008, "Invalid JSON")
    })

    it("rejects unsupported binary messages", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()

      await durable.webSocketMessage(ws as any, new ArrayBuffer(4))

      expect(ws.close).toHaveBeenCalledWith(1003, "Binary messages are not supported")
      expect(ws.send).not.toHaveBeenCalled()
    })
  })

  describe("webSocketMessage — chhlat auth flow", () => {
    it("rejects chhlat with pending token (not yet activated)", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "pending", workspaceId: null,
      })

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_pending123", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(mockGetRuntimeIdsByChhlat).not.toHaveBeenCalled()
    })

    it("authenticates chhlat with active token and runtimes", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "active", workspaceId: "sp_ws1", hostname: "my-chhlat",
      })
      mockGetRuntimeIdsByChhlat.mockResolvedValue(["rt_1"])

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_active123", chhlatId: "my-chhlat" }),
      )

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "auth.ok" }))
      expect(mockGetMachineByChhlat).toHaveBeenCalledWith({}, "my-chhlat", "sp_ws1")
      expect(mockGetRuntimeIdsByChhlat).toHaveBeenCalledWith({}, "my-chhlat", "sp_ws1")
      expect(ws.deserializeAttachment()).toEqual({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "u1", authenticated: true })
    })

    it("rejects chhlat auth when the routed chhlat id does not match the auth message", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "active", workspaceId: "sp_ws1", hostname: "my-chhlat",
      })
      mockGetRuntimeIdsByChhlat.mockResolvedValue(["rt_1"])

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "other-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_active123", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(mockGetMachineTokenByToken).not.toHaveBeenCalled()
      expect(mockGetMachineByChhlat).not.toHaveBeenCalled()
      expect(mockGetRuntimeIdsByChhlat).not.toHaveBeenCalled()
    })

    it("rejects chhlat token when the machine record belongs to another user", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "active", workspaceId: "sp_ws1", hostname: "my-chhlat",
      })
      mockGetMachineByChhlat.mockResolvedValue({ ownerId: "other-user" })

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_active123", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(mockGetMachineByChhlat).toHaveBeenCalledWith({}, "my-chhlat", "sp_ws1")
      expect(mockGetRuntimeIdsByChhlat).not.toHaveBeenCalled()
      expect(ws.send).not.toHaveBeenCalled()
    })

    it("rejects same-user/workspace token when its recorded hostname differs from the routed chhlat", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "active", workspaceId: "sp_ws1", hostname: "other-chhlat",
      })
      mockGetMachineByChhlat.mockResolvedValue({ ownerId: "u1" })

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_active123", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(mockGetMachineByChhlat).not.toHaveBeenCalled()
      expect(mockGetRuntimeIdsByChhlat).not.toHaveBeenCalled()
    })

    it("rejects same-hostname token from another workspace before broadcasting status", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "active", workspaceId: "workspace-other", hostname: "shared-host",
      })
      mockGetMachineByChhlat.mockResolvedValue({ ownerId: "u1" })

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "workspace-routed", chhlatId: "shared-host", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_active123", workspaceId: "workspace-routed", chhlatId: "shared-host" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(mockGetMachineByChhlat).not.toHaveBeenCalled()
      expect(mockGetRuntimeIdsByChhlat).not.toHaveBeenCalled()
      expect(mockStubFetch).not.toHaveBeenCalled()
    })

    it("rejects chhlat with active token but no runtimes", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue({
        id: "mt_1", userId: "u1", status: "active", workspaceId: "sp_ws1", hostname: "my-chhlat",
      })
      mockGetRuntimeIdsByChhlat.mockResolvedValue([])

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_noruntimes", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(ws.send).not.toHaveBeenCalled()
    })

    it("rejects chhlat with unknown token", async () => {
      const { durable } = createDO()
      mockGetMachineTokenByToken.mockResolvedValue(null)

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "al_unknown", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
    })

    it("rejects chhlat with non-al_ prefixed token", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "chhlat", workspaceId: "sp_ws1", chhlatId: "my-chhlat", userId: "", authenticated: false })

      await durable.webSocketMessage(
        ws as any,
        JSON.stringify({ type: "auth", machineToken: "bad_prefix", chhlatId: "my-chhlat" }),
      )

      expect(ws.close).toHaveBeenCalledWith(1008, "Unauthorized")
      expect(mockGetMachineTokenByToken).not.toHaveBeenCalled()
    })
  })

  describe("webSocketMessage — check_chhlat_status (cross-DO)", () => {
    it("returns runtime.status online when chhlat DO reports alive", async () => {
      const { durable, env } = createDO()
      mockGetLatestTokenForUser.mockResolvedValue({ hostname: "MyMachine.local" })

      const aliveStub = { fetch: vi.fn().mockResolvedValue(new (globalThis.Response as any)(JSON.stringify({ alive: true }))) }
      ;(env.WS_DO as any).get = vi.fn().mockReturnValue(aliveStub)

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: true })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "check_chhlat_status", workspaceId: "workspace-1" }))

      expect(mockGetLatestTokenForUser).toHaveBeenCalledWith({}, "user-42", "workspace-1")
      expect((env.WS_DO as any).idFromName).toHaveBeenCalledWith("chhlat:workspace-1:MyMachine.local")
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "runtime.status", workspaceId: "workspace-1", status: "online", chhlatId: "MyMachine.local" }),
      )
    })

    it("does not respond when chhlat DO reports not alive", async () => {
      const { durable, env } = createDO()
      mockGetLatestTokenForUser.mockResolvedValue({ hostname: "MyMachine.local" })

      const deadStub = { fetch: vi.fn().mockResolvedValue(new (globalThis.Response as any)(JSON.stringify({ alive: false }))) }
      ;(env.WS_DO as any).get = vi.fn().mockReturnValue(deadStub)

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: true })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "check_chhlat_status", workspaceId: "workspace-1" }))

      expect(ws.send).not.toHaveBeenCalled()
    })

    it("does not respond when no token/hostname found", async () => {
      const { durable } = createDO()
      mockGetLatestTokenForUser.mockResolvedValue(null)

      const ws = createMockWebSocket()
      ws.serializeAttachment({ type: "user", userId: "user-42", authenticated: true })

      await durable.webSocketMessage(ws as any, JSON.stringify({ type: "check_chhlat_status", workspaceId: "workspace-1" }))

      expect(ws.send).not.toHaveBeenCalled()
    })
  })

  describe("webSocketError", () => {
    it("closes with 1011", async () => {
      const { durable } = createDO()

      const ws = createMockWebSocket()

      await durable.webSocketError(ws as any, new Error("boom"))

      expect(ws.close).toHaveBeenCalledWith(1011, "Internal error")
    })
  })
})
