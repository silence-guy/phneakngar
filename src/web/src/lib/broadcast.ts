import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { WsMessage, ChhlatPushMessage } from "@phneakngar/shared"
import { DEV_WS_DO_URL, WS_SERVICE_SECRET_HEADER, createLogger } from "@phneakngar/shared"

const log = createLogger({ service: "broadcast" })

interface CapturedWsEnv {
  wsDoWorker: { fetch: (url: string, init: RequestInit) => Promise<Response> } | null
  wsDoUrl: string
  wsServiceSecret: string
}

function captureWsEnv(): CapturedWsEnv | null {
  try {
    const { env } = getCloudflareContext()
    const wsEnv = env as Env
    const wsDoUrl = (wsEnv as unknown as Record<string, unknown>).DEV_WS_DO_URL as string | undefined
    const wsServiceSecret = wsEnv.WS_SERVICE_SECRET || process.env.WS_SERVICE_SECRET
    if (!wsServiceSecret) return null
    return {
      wsDoWorker: wsEnv.WS_DO_WORKER ?? null,
      wsDoUrl: wsDoUrl || DEV_WS_DO_URL,
      wsServiceSecret,
    }
  } catch {
    const wsServiceSecret = process.env.WS_SERVICE_SECRET
    if (!wsServiceSecret) return null
    return { wsDoWorker: null, wsDoUrl: DEV_WS_DO_URL, wsServiceSecret }
  }
}

async function doSend(
  url: string,
  body: string,
  label: Record<string, string>,
  captured: CapturedWsEnv | null,
): Promise<{ sent: number }> {
  if (!captured) throw new Error("WS_SERVICE_SECRET is not configured")

  if (captured.wsDoWorker) {
    try {
      const res = await captured.wsDoWorker.fetch(`http://internal${url}`, {
        method: "POST",
        headers: { [WS_SERVICE_SECRET_HEADER]: captured.wsServiceSecret },
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
  }

  const res = await fetch(`${captured.wsDoUrl}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [WS_SERVICE_SECRET_HEADER]: captured.wsServiceSecret,
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
  const captured = captureWsEnv()
  const promise = doSend(url, body, label, captured)
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
  const captured = captureWsEnv()
  const promise = doSend(
    `/broadcast/chhlat/${encodeURIComponent(workspaceId)}/${encodeURIComponent(chhlatId)}`,
    JSON.stringify(message),
    { workspaceId, chhlatId, type: message.type },
    captured,
  )
  try {
    const { ctx } = getCloudflareContext()
    ctx.waitUntil(promise.catch(() => {}))
  } catch {
    // Not in CF context — promise runs on its own
  }
  return promise
}
