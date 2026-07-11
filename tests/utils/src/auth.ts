import { fetchWithRetry } from "./fetch"
import { getCurrentCliVersion } from "./runtime"

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"

export async function signUp(email: string, password: string, name: string) {
  return fetch(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL },
    body: JSON.stringify({ email, password, name }),
    redirect: "manual",
  })
}

export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${APP_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP_URL },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  })
  const setCookie = res.headers.get("set-cookie") ?? ""
  if (!setCookie) {
    throw new Error(`sign-in failed (${res.status}): no set-cookie header`)
  }
  return setCookie.split(";")[0]
}

export async function sessionRequest(
  path: string,
  cookie: string,
  opts: RequestInit = {},
): Promise<Response> {
  return fetchWithRetry(`${APP_URL}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      Cookie: cookie,
    },
  })
}

export async function tokenRequest(
  path: string,
  token: string,
  opts: RequestInit = {},
): Promise<Response> {
  let body = opts.body
  if (path.startsWith("/api/chhlat/tasks/poll") && typeof body === "string") {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (!parsed.cli_version) parsed.cli_version = getCurrentCliVersion()
    body = JSON.stringify(parsed)
  }

  return fetchWithRetry(`${APP_URL}${path}`, {
    ...opts,
    body,
    headers: {
      ...(opts.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })
}
