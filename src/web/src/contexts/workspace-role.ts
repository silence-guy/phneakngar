// Server-safe workspace role helpers. Kept out of the "use client" workspace-context
// module so server components (e.g. the workspace layout) can call normalizeMemberRole
// without violating Next's server/client boundary.

export type MemberRole = "owner" | "member";

export function normalizeMemberRole(role: string | null | undefined): MemberRole {
  return role === "owner" ? "owner" : "member";
}
