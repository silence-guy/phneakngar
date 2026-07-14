import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { WsMessage, ChhlatPushMessage } from "@phneakngar/shared"
import { DEV_WS_DO_URL, WS_SERVICE_SECRET_HEADER, createLogger } from "@phneakngar/shared"

const log = createLogger({ service: "broadcast" })

async function doSend(url: string, body: string, label: Record<string, string>): Promise<{ sent: number }> {
  let wsDoUrl: string | undefined
  let wsServiceSecret = process.env.WS_SERVICE_SECRET
  try {
    const { env } = getCloudflareContext()
    const wsEnv = env as Env
    wsDoUrl = (wsEnv as unknown as Record<string, unknown>).DEV_WS_DO_URL as string | undefined
    wsServiceSecret = wsEnv.WS_SERVICE_SECRET || wsServiceSecret
    if (!wsServiceSecret) throw new Error("WS_SERVICE_SECRET is not configured")

    const res = await wsEnv.WS_DO_WORKER.fetch(`http://internal${url}`, {
      method: "POST",
      headers: { [WS_SERVICE_SECRET_HEADER]: wsServiceSecret },
      body,
    })
    if (res.ok) {
      try {
        const json = await res.json() as { sent?: number }
        return { sent: json.sent ?? 0 }
      } catch {
        return { sent: 0 }
      }
    }
    log.warn("broadcast service-binding non-ok", { ...label, status: res.status })
  } catch {
    // Service binding unavailable — fall through to HTTP
  }

  const fallbackUrl = wsDoUrl || DEV_WS_DO_URL
  if (!wsServiceSecret) throw new Error("WS_SERVICE_SECRET is not configured")
  const res = await fetch(`${fallbackUrl}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [WS_SERVICE_SECRET_HEADER]: wsServiceSecret,
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`broadcast failed: ${res.status}`)
  }
  try {
    const json = await res.json() as { sent?: number }
    return { sent: json.sent ?? 0 }
  } catch {
    return { sent: 0 }
  }
}

function sendBroadcast(url: string, body: string, label: Record<string, string>): Promise<void> {
  const promise = doSend(url, body, label)
  try {
    const { ctx } = getCloudflareContext()
    ctx.waitUntil(promise.catch(() => {}))
  } catch {
    // Not in CF context — promise runs on its own
  }
  return promise.then(() => {})
}

export function broadcastToUser(userId: string, message: WsMessage): Promise<void> {
  return sendBroadcast(
    `/broadcast/user/${userId}`,
    JSON.stringify(message),
    { userId, type: message.type },
  )
}


export function broadcastToChhlat(workspaceId: string, chhlatId: string, message: ChhlatPushMessage): Promise<{ sent: number }> {
  const promise = doSend(
    `/broadcast/chhlat/${encodeURIComponent(workspaceId)}/${encodeURIComponent(chhlatId)}`,
    JSON.stringify(message),
    { workspaceId, chhlatId, type: message.type },
  )
  try {
    // CF worker may terminate before the fetch completes if the response is sent early;
    // waitUntil keeps the isolate alive until the broadcast resolves.
    const { ctx } = getCloudflareContext()
    ctx.waitUntil(promise.catch(() => {}))
  } catch {
    // Not in CF context — promise runs on its own
  }
  return promise
}
