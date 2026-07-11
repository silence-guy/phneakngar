import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { randomUUID } from "crypto"
import {
  seedTestData,
  cleanupTestData,
  type TestSeed,
  sqlRun,
} from "@phneakngar/test-utils"
import { ChhlatClient } from "../../../src/cli/chhlat/client"
import { ChhlatPushMessageSchema } from "@phneakngar/shared"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"
const WS_DO_URL = process.env.WS_DO_URL ?? "http://localhost:8789"
const client = new ChhlatClient(APP_URL)

let seed: TestSeed
const chhlatId = `chhlat_ws_${randomUUID().slice(0, 8)}`
let runtimeId: string
let wsAvailable = false

beforeAll(async () => {
  seed = seedTestData()

  // Check if WS-DO is available
  try {
    const res = await fetch(WS_DO_URL, { signal: AbortSignal.timeout(2000) })
    wsAvailable = res.status !== 0
  } catch {
    wsAvailable = false
  }

  const reg = await client.register(seed.machineToken, {
    workspace_id: seed.workspaceId,
    chhlat_id: chhlatId,
    device_name: "ws-test-machine",
    cli_version: "0.1.0-integ",
    runtimes: [{ provider: "claude", runtime_mode: "local", version: "4.0" }],
  })
  runtimeId = reg.runtimes[0].id
})
afterAll(() => cleanupTestData(seed))

describe("WebSocket push → poll", () => {
  it.skipIf(!wsAvailable)("chhlat.tasks push triggers immediate poll with correct task", async () => {
    const now = new Date().toISOString()
    const conversationId = `conv_ws_${randomUUID().slice(0, 8)}`
    const taskId = `task_ws_${randomUUID().slice(0, 8)}`

    sqlRun(`INSERT INTO conversation (id, workspace_id, agent_id, user_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)`, conversationId, seed.workspaceId, seed.agentId, seed.userId, 'ws push test', now)
    sqlRun(`INSERT INTO agent_task_queue (id, agent_id, runtime_id, workspace_id, conversation_id, prompt, status, type, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`, taskId, seed.agentId, runtimeId, seed.workspaceId, conversationId, 'WS push test prompt', 'queued', 'user_dm_message', now)

    // Connect WebSocket and wait for push message
    const wsUrl = `${WS_DO_URL.replace("http", "ws")}/ws/chhlat?token=${seed.machineToken}&chhlat_id=${chhlatId}`
    const ws = new WebSocket(wsUrl)

    const pushMessage = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error("WebSocket push timeout — no chhlat.tasks message received within 10s"))
      }, 10_000)

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data.type === "chhlat.tasks") {
            clearTimeout(timeout)
            ws.close()
            resolve(data)
          }
        } catch { /* ignore non-JSON frames */ }
      }
      ws.onerror = (err) => {
        clearTimeout(timeout)
        reject(err)
      }
    })

    const parsed = ChhlatPushMessageSchema.safeParse(pushMessage)
    expect(parsed.success).toBe(true)
    if (parsed.success && parsed.data.type === "chhlat.tasks") {
      expect(parsed.data.tasks.length).toBeGreaterThanOrEqual(1)
      const pushed = parsed.data.tasks.find((t) => t.id === taskId)
      expect(pushed).toBeDefined()
    }

    // Poll should also return the task
    const pollResult = await client.poll(seed.machineToken, chhlatId, 1)
    expect(pollResult.tasks.length).toBeGreaterThanOrEqual(1)

    // Cleanup
    sqlRun(`DELETE FROM agent_task_queue WHERE id = ?`, taskId)
    sqlRun(`DELETE FROM conversation WHERE id = ?`, conversationId)
  })

  afterAll(() => {
    try {
      sqlRun(`DELETE FROM agent_runtime WHERE chhlat_id = ?`, chhlatId)
      sqlRun(`DELETE FROM machine WHERE chhlat_id = ?`, chhlatId)
    } catch { /* ignore */ }
  })
})
