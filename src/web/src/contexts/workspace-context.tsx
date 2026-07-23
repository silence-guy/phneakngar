"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"

import type { MemberRole } from "./workspace-role";
export type { MemberRole } from "./workspace-role";
export { normalizeMemberRole } from "./workspace-role";

interface WorkspaceContextValue {
  workspaceId: string
  slug: string
  memberRole: MemberRole
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}

export function WorkspaceProvider({
  workspaceId,
  slug,
  memberRole,
  children,
}: WorkspaceContextValue & { children: ReactNode }) {
  useEffect(() => {
    try { localStorage.setItem("lastWorkspace", slug) } catch {}
  }, [slug])

  return (
    <WorkspaceContext.Provider value={{ workspaceId, slug, memberRole }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
