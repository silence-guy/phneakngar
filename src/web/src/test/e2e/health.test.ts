import { describe, it, expect } from "vitest"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"

describe("health check", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await fetch(`${APP_URL}/api/health`)
    expect(res.status).toBe(200)
    const data = await res.json() as {
      status: string
      checks: Record<string, { status: string }>
    }
    expect(data.status).toBe("ok")
    expect(data.checks.configuration.status).toBe("ok")
    expect(data.checks.database.status).toBe("ok")
    expect(data.checks.email_worker.status).toBe("ok")
    expect(data.checks.websocket_worker.status).toBe("ok")
  })
})
