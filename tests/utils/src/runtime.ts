import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))

function readEnvFileValue(path: string, key: string): string {
  try {
    const text = readFileSync(path, "utf8")
    const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`))
    return line?.slice(key.length + 1).trim() ?? ""
  } catch {
    return ""
  }
}

function requiredValue(value: string, label: string): string {
  if (!value) throw new Error(`${label} is required for integration tests; run pnpm predev`)
  return value
}

export function getCurrentCliVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(join(ROOT, "src/cli/package.json"), "utf8"),
  ) as { version?: string }
  return requiredValue(packageJson.version ?? "", "CLI package version")
}

export function getEmailNotifySecret(): string {
  return requiredValue(
    process.env.EMAIL_NOTIFY_SECRET
      ?? readEnvFileValue(join(ROOT, "src/web/.dev.vars"), "EMAIL_NOTIFY_SECRET"),
    "EMAIL_NOTIFY_SECRET",
  )
}

export function getWsServiceSecret(): string {
  return requiredValue(
    process.env.WS_SERVICE_SECRET
      ?? readEnvFileValue(join(ROOT, "src/web/.dev.vars"), "WS_SERVICE_SECRET"),
    "WS_SERVICE_SECRET",
  )
}

export function emailWorkerHeaders(init: HeadersInit = {}): Headers {
  const headers = new Headers(init)
  headers.set("X-Phneakngar-Email-Notify-Secret", getEmailNotifySecret())
  return headers
}

export function wsWorkerHeaders(init: HeadersInit = {}): Headers {
  const headers = new Headers(init)
  headers.set("X-Phneakngar-WS-Service-Secret", getWsServiceSecret())
  return headers
}
