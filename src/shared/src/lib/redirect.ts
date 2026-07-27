/**
 * Post-login / post-auth redirect validation.
 *
 * Shared by the server middleware and the client sign-in page so the two cannot diverge —
 * they previously did: the client checked only a leading "//" and missed "/\", which the
 * WHATWG URL parser treats as "/", so `/\evil.example` resolved to an external origin and
 * became an open redirect at the moment the user had just authenticated.
 */

/** True when `path` is a safe same-origin relative redirect target. */
export function isSafeRedirectPath(path: string | null | undefined): boolean {
  if (!path) return false;
  // Must be relative. Reject scheme-relative ("//evil.example") and backslash tricks
  // ("/\evil.example"); both resolve to an external origin.
  return path.startsWith("/") && path[1] !== "/" && path[1] !== "\\";
}

/** Return `path` when safe, otherwise `fallback`. */
export function safeRedirectPath(
  path: string | null | undefined,
  fallback: string,
): string {
  return isSafeRedirectPath(path) ? (path as string) : fallback;
}
