import {
  DEV_EMAIL_WORKER_URL,
  EMAIL_NOTIFY_SECRET_HEADER,
} from "@phneakngar/shared";

export async function fetchEmailWorker(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const secret = env.EMAIL_NOTIFY_SECRET?.trim();
  if (!secret) {
    throw new Error("EMAIL_NOTIFY_SECRET is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set(EMAIL_NOTIFY_SECRET_HEADER, secret);

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  try {
    return await env.EMAIL_WORKER.fetch(`http://internal${path}`, requestInit);
  } catch {
    return fetch(`${DEV_EMAIL_WORKER_URL}${path}`, requestInit);
  }
}
