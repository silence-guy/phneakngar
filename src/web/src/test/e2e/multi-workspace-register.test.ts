/**
 * Regression: Register chhlat across multiple workspaces
 * Bug pattern: Registering the same chhlat_id in workspace B caused workspace A
 * to go offline, breaking task routing for existing workspace.
 * Refs: #194 (Priority 1)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { randomUUID } from "crypto"
import { seedTestData, cleanupTestData, type TestSeed, tokenRequest, sqlRun, sqlQuery } from "@phneakngar/test-utils"

let seedA: TestSeed
let seedB: TestSeed
const sharedChhlatId = `chhlat_multi_${randomUUID().slice(0, 8)}`

beforeAll(() => {
  seedA = seedTestData()
  seedB = seedTestData()
})
afterAll(() => {
  // Restore agent runtime_id to seed's original runtime before cleanup
  // (test may have pointed it to the shared chhlat's runtime)
  sqlRun(`UPDATE agent SET runtime_id = ? WHERE id = ?`, seedA.runtimeId, seedA.agentId)
  // Clean up tasks referencing the shared chhlat's runtime
  sqlRun(`DELETE FROM agent_task_queue WHERE workspace_id = ?`, seedA.workspaceId)
  sqlRun(`DELETE FROM agent_task_queue WHERE workspace_id = ?`, seedB.workspaceId)
  // Clean the shared chhlat entries
  sqlRun(`DELETE FROM agent_runtime WHERE chhlat_id = ?`, sharedChhlatId)
  sqlRun(`DELETE FROM machine WHERE chhlat_id = ?`, sharedChhlatId)
  cleanupTestData(seedA)
  cleanupTestData(seedB)
})

describe("regression: multi-workspace chhlat registration", () => {
  it("register chhlat in workspace A → machine is online", async () => {
    const res = await tokenRequest("/api/chhlat/register", seedA.machineToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: seedA.workspaceId,
        chhlat_id: sharedChhlatId,
        device_name: "multi-ws-device",
        cli_version: "1.0.0",
        runtimes: [{ provider: "claude", runtime_mode: "local", version: "4.0" }],
      }),
    })
    expect(res.status).toBe(200)

    const rows = sqlQuery<{ last_seen_at: string | null }>(
      `SELECT last_seen_at FROM machine WHERE chhlat_id = ? AND workspace_id = ?`, sharedChhlatId, seedA.workspaceId
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].last_seen_at).toBeTruthy()
  })

  it("register same chhlat in workspace B → workspace A still online", async () => {
    const res = await tokenRequest("/api/chhlat/register", seedB.machineToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: seedB.workspaceId,
        chhlat_id: sharedChhlatId,
        device_name: "multi-ws-device",
        cli_version: "1.0.0",
        runtimes: [{ provider: "claude", runtime_mode: "local", version: "4.0" }],
      }),
    })
    expect(res.status).toBe(200)

    // Workspace A machine should still be online
    const rowsA = sqlQuery<{ last_seen_at: string | null }>(
      `SELECT last_seen_at FROM machine WHERE chhlat_id = ? AND workspace_id = ?`, sharedChhlatId, seedA.workspaceId
    )
    expect(rowsA).toHaveLength(1)
    expect(rowsA[0].last_seen_at).toBeTruthy()

    // Workspace B machine should also be online
    const rowsB = sqlQuery<{ last_seen_at: string | null }>(
      `SELECT last_seen_at FROM machine WHERE chhlat_id = ? AND workspace_id = ?`, sharedChhlatId, seedB.workspaceId
    )
    expect(rowsB).toHaveLength(1)
    expect(rowsB[0].last_seen_at).toBeTruthy()
  })

  it("tasks route correctly to workspace A after workspace B registration", async () => {
    // Get runtime ID for workspace A
    const runtimesA = sqlQuery<{ id: string }>(
      `SELECT id FROM agent_runtime WHERE chhlat_id = ? AND workspace_id = ?`, sharedChhlatId, seedA.workspaceId
    )
    expect(runtimesA).toHaveLength(1)
    const runtimeIdA = runtimesA[0].id

    // Update agent A to use this runtime
    sqlRun(`UPDATE agent SET runtime_id = ? WHERE id = ?`, runtimeIdA, seedA.agentId)

    // Create a task in workspace A
    const convRes = await tokenRequest(
      `/api/conversations?workspace_id=${seedA.workspaceId}`,
      seedA.machineToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: seedA.agentId }),
      },
    )
    const { id: convId } = await convRes.json() as { id: string }

    const msgRes = await tokenRequest(
      `/api/conversations/${convId}/messages?workspace_id=${seedA.workspaceId}`,
      seedA.machineToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Route to workspace A" }),
      },
    )
    expect(msgRes.status).toBe(201)
    const msgData = await msgRes.json() as { task?: { id: string } | null }
    expect(msgData.task).toBeTruthy()

    // Poll from workspace A chhlat to claim the task
    const pollRes = await tokenRequest(`/api/chhlat/tasks/poll`, seedA.machineToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chhlat_id: sharedChhlatId, max_tasks: 5 }),
    })
    expect(pollRes.status).toBe(200)
    const pollData = await pollRes.json() as { tasks: Array<Record<string, unknown>> }
    expect(pollData.tasks.length).toBeGreaterThanOrEqual(1)
    const claimed = pollData.tasks.find(t => t.id === msgData.task!.id)
    expect(claimed).toBeTruthy()
    expect(claimed!.prompt).toBe("Route to workspace A")

    // Cleanup: complete the task
    await tokenRequest(`/api/chhlat/tasks/${msgData.task!.id}/start`, seedA.machineToken, { method: "POST" })
    await tokenRequest(`/api/chhlat/tasks/${msgData.task!.id}/complete`, seedA.machineToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: "done", session_id: "sess_multi" }),
    })
  })

  it("deregister from workspace B does NOT affect workspace A", async () => {
    await tokenRequest("/api/chhlat/deregister", seedB.machineToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chhlat_id: sharedChhlatId }),
    })

    // Workspace B offline
    const rowsB = sqlQuery<{ last_seen_at: string | null }>(
      `SELECT last_seen_at FROM machine WHERE chhlat_id = ? AND workspace_id = ?`, sharedChhlatId, seedB.workspaceId
    )
    expect(rowsB[0]?.last_seen_at).toBeNull()

    // Workspace A still online
    const rowsA = sqlQuery<{ last_seen_at: string | null }>(
      `SELECT last_seen_at FROM machine WHERE chhlat_id = ? AND workspace_id = ?`, sharedChhlatId, seedA.workspaceId
    )
    expect(rowsA[0]?.last_seen_at).toBeTruthy()
  })
})
