import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockDONamespace } from "./__mocks__/cf"

// Mock ws-durable so the router import doesn't pull in cloudflare:workers
vi.mock("./ws-durable", () => ({
  WebSocketDurableObject: class {},
}))

import handler from "./index"
import { issueWsConnectionTicket, WS_CHHLAT_TICKET_AUDIENCE } from "@phneakngar/shared"

describe("ws-do router", () => {
  let doMock: ReturnType<typeof createMockDONamespace>
  let env: { WS_DO: DurableObjectNamespace; WS_SERVICE_SECRET: string }

  beforeEach(() => {
    vi.clearAllMocks()
    doMock = createMockDONamespace()
    env = {
      WS_DO: doMock.namespace,
      WS_SERVICE_SECRET: "ws-service-secret",
    } as unknown as { WS_DO: DurableObjectNamespace; WS_SERVICE_SECRET: string }
  })

  describe("broadcast route", () => {
    it("forwards POST /broadcast/user/:userId to correct DO instance", async () => {
      doMock.stubFetch.mockResolvedValue(new Response("ok"))
      const req = new Request("http://localhost/broadcast/user/user-123", {
        method: "POST",
        headers: { "X-Phneakngar-WS-Service-Secret": "ws-service-secret" },
        body: JSON.stringify({ type: "runtime.status", chhlatId: "d1", workspaceId: "w1", status: "online" }),
      })

      const res = await handler.fetch(req, env as any)

      expect(doMock.idFromName).toHaveBeenCalledWith("user:user-123")
      expect(doMock.get).toHaveBeenCalledWith("mock-do-id")
      expect(doMock.stubFetch).toHaveBeenCalled()
      const stubReq = doMock.stubFetch.mock.calls[0][0] as Request
      expect(stubReq.url).toBe("http://internal/broadcast")
      expect(stubReq.method).toBe("POST")
      expect(res.status).toBe(200)
    })

    it("rejects broadcast calls without the configured service secret", async () => {
      const req = new Request("https://ws.example.com/broadcast/user/user-123", {
        method: "POST",
        body: "{}",
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(401)
      expect(doMock.stubFetch).not.toHaveBeenCalled()
    })

    it("forwards POST /broadcast/chhlat/:workspaceId/:chhlatId to the tenant-qualified DO instance", async () => {
      doMock.stubFetch.mockResolvedValue(new Response("ok"))
      const req = new Request("http://localhost/broadcast/chhlat/workspace-1/host-1", {
        method: "POST",
        headers: { "X-Phneakngar-WS-Service-Secret": "ws-service-secret" },
        body: JSON.stringify({ type: "chhlat.rescan" }),
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(200)
      expect(doMock.idFromName).toHaveBeenCalledWith("chhlat:workspace-1:host-1")
      expect(doMock.stubFetch).toHaveBeenCalled()
    })
  })

  describe("WebSocket route", () => {
    it("validates ticket and forwards GET to user DO instance", async () => {
      doMock.stubFetch.mockResolvedValue(new Response(null, { status: 200 }))
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", { userId: "user-456" })
      const req = new Request(`http://localhost/?ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(doMock.idFromName).toHaveBeenCalledWith("user:user-456")
      expect(doMock.get).toHaveBeenCalledWith("mock-do-id")
      const forwarded = doMock.stubFetch.mock.calls[0][0] as Request
      expect(new URL(forwarded.url).searchParams.get("userId")).toBe("user-456")
    })

    it("returns 400 when ticket is missing", async () => {
      const req = new Request("http://localhost/", {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(400)
      expect(await res.text()).toBe("ticket required")
      expect(doMock.stubFetch).not.toHaveBeenCalled()
    })

    it("validates chhlat ticket and forwards to the chhlat DO instance", async () => {
      doMock.stubFetch.mockResolvedValue(new Response(null, { status: 200 }))
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", {
        userId: "user-456",
        audience: WS_CHHLAT_TICKET_AUDIENCE,
        workspaceId: "workspace-1",
        chhlatId: "host-1",
      })
      const req = new Request(`http://localhost/?chhlatId=host-1&ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(200)
      expect(doMock.idFromName).toHaveBeenCalledWith("chhlat:workspace-1:host-1")
      const forwarded = doMock.stubFetch.mock.calls[0][0] as Request
      const forwardedUrl = new URL(forwarded.url)
      expect(forwardedUrl.searchParams.get("chhlatId")).toBe("host-1")
      expect(forwardedUrl.searchParams.get("workspaceId")).toBe("workspace-1")
      expect(forwardedUrl.searchParams.get("userId")).toBe("user-456")
    })

    it("routes the same chhlat hostname in different workspaces to separate DO instances", async () => {
      doMock.stubFetch.mockResolvedValue(new Response(null, { status: 200 }))
      const first = await issueWsConnectionTicket("ws-service-secret", {
        userId: "user-456",
        audience: WS_CHHLAT_TICKET_AUDIENCE,
        workspaceId: "workspace-1",
        chhlatId: "shared-host",
      })
      const second = await issueWsConnectionTicket("ws-service-secret", {
        userId: "user-456",
        audience: WS_CHHLAT_TICKET_AUDIENCE,
        workspaceId: "workspace-2",
        chhlatId: "shared-host",
      })

      await handler.fetch(new Request(`http://localhost/?chhlatId=shared-host&ticket=${encodeURIComponent(first.ticket)}`, {
        headers: { Upgrade: "websocket" },
      }), env as any)
      await handler.fetch(new Request(`http://localhost/?chhlatId=shared-host&ticket=${encodeURIComponent(second.ticket)}`, {
        headers: { Upgrade: "websocket" },
      }), env as any)

      expect(doMock.idFromName).toHaveBeenNthCalledWith(1, "chhlat:workspace-1:shared-host")
      expect(doMock.idFromName).toHaveBeenNthCalledWith(2, "chhlat:workspace-2:shared-host")
    })

    it("rejects chhlat query mismatch before DO allocation", async () => {
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", {
        userId: "user-456",
        audience: WS_CHHLAT_TICKET_AUDIENCE,
        workspaceId: "workspace-1",
        chhlatId: "host-1",
      })
      const req = new Request(`http://localhost/?chhlatId=host-2&ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(401)
      expect(doMock.idFromName).not.toHaveBeenCalled()
    })

    it("rejects user ticket on the chhlat route before DO allocation", async () => {
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", { userId: "user-456" })
      const req = new Request(`http://localhost/api/ws/chhlat?ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(401)
      expect(doMock.idFromName).not.toHaveBeenCalled()
    })

    it("rejects tampered ticket before DO allocation", async () => {
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", { userId: "user-456" })
      const req = new Request(`http://localhost/?ticket=${encodeURIComponent(`${ticket}x`)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(401)
      expect(doMock.idFromName).not.toHaveBeenCalled()
      expect(doMock.stubFetch).not.toHaveBeenCalled()
    })

    it("rejects expired ticket before DO allocation", async () => {
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", {
        userId: "user-456",
        nowMs: Date.now() - 120_000,
        ttlSeconds: 1,
      })
      const req = new Request(`http://localhost/?ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(401)
      expect(doMock.idFromName).not.toHaveBeenCalled()
    })

    it("rejects query userId that disagrees with ticket subject", async () => {
      const { ticket } = await issueWsConnectionTicket("ws-service-secret", { userId: "attacker" })
      const req = new Request(`http://localhost/?userId=victim&ticket=${encodeURIComponent(ticket)}`, {
        headers: { Upgrade: "websocket" },
      })

      const res = await handler.fetch(req, env as any)

      expect(res.status).toBe(401)
      expect(doMock.idFromName).not.toHaveBeenCalled()
    })
  })
})
