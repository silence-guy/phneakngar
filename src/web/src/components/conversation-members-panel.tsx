"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAgentContext } from "@/contexts/agent-context";
import {
  addConversationMember,
  listConversationMembers,
  listMembers,
  removeConversationMember,
  type ConversationMemberItem,
  type MemberEntry,
} from "@/lib/api";
import {
  agentsAvailableToAdd,
  countAgentMembers,
  resolveChannelMembers,
} from "@/lib/channel-members-display";
import { conversationMembersToDisplayRows } from "@/lib/conversation-members-display";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AGENT_CHAT_LABELS } from "@/components/agent-chat/agent-chat-labels";

/**
 * Multi-party DM participants control.
 * Progressive disclosure: icon + count → popover list with add/remove agents.
 * Wired against `/api/conversations/[id]/members` (workspace-scoped).
 */
export function ConversationMembersPanel({
  conversationId,
  preferAgentId,
  className,
}: {
  conversationId: string;
  preferAgentId?: string | null;
  className?: string;
}) {
  const { workspaceId } = useWorkspace();
  const { agents } = useAgentContext();
  const labels = AGENT_CHAT_LABELS.dmParticipants;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [members, setMembers] = useState<ConversationMemberItem[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<MemberEntry[]>([]);

  const load = useCallback(async () => {
    if (!conversationId || !workspaceId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const [listRes, wsMembers] = await Promise.all([
        listConversationMembers(conversationId, workspaceId),
        listMembers(workspaceId).catch(() => [] as MemberEntry[]),
      ]);
      setMembers(listRes.items ?? []);
      setWorkspaceMembers(wsMembers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.failedToLoad);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, workspaceId, labels.failedToLoad]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  // Lightweight badge refresh when conversation changes.
  useEffect(() => {
    if (!conversationId || !workspaceId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    listConversationMembers(conversationId, workspaceId)
      .then((res) => {
        if (!cancelled) setMembers(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, workspaceId]);

  const displayRows = useMemo(
    () => conversationMembersToDisplayRows(members),
    [members],
  );

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of agents) map[a.id] = a.name;
    return map;
  }, [agents]);

  const userNameMap = useMemo(() => {
    const names: Record<string, string> = {};
    const emails: Record<string, string> = {};
    for (const m of workspaceMembers) {
      names[m.user_id] = m.name || m.email;
      emails[m.user_id] = m.email;
    }
    return { names, emails };
  }, [workspaceMembers]);

  const resolved = useMemo(
    () =>
      resolveChannelMembers(displayRows, {
        agents: agentNameMap,
        users: userNameMap.names,
        userEmails: userNameMap.emails,
      }),
    [displayRows, agentNameMap, userNameMap],
  );

  const availableAgents = useMemo(
    () =>
      agentsAvailableToAdd(
        agents.map((a) => ({ id: a.id, name: a.name })),
        displayRows,
        { preferAgentId },
      ),
    [agents, displayRows, preferAgentId],
  );

  const agentCount = countAgentMembers(displayRows);

  const handleAddAgent = async (agentId: string) => {
    if (!conversationId || busyKey) return;
    setBusyKey(`add:${agentId}`);
    try {
      const res = await addConversationMember(conversationId, workspaceId, {
        member_type: "agent",
        member_id: agentId,
      });
      setMembers((prev) => {
        if (prev.some((m) => m.member_type === "agent" && m.member_id === agentId)) {
          return prev;
        }
        return [...prev, res.member];
      });
      toast.success(labels.agentAdded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.failedToAdd);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (memberType: "user" | "agent", memberId: string) => {
    if (!conversationId || busyKey) return;
    setBusyKey(`rm:${memberType}:${memberId}`);
    try {
      await removeConversationMember(
        conversationId,
        workspaceId,
        memberType,
        memberId,
      );
      setMembers((prev) =>
        prev.filter(
          (m) => !(m.member_type === memberType && m.member_id === memberId),
        ),
      );
      toast.success(labels.memberRemoved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.failedToRemove);
    } finally {
      setBusyKey(null);
    }
  };

  if (!conversationId) return null;

  return (
    <div className={cn("shrink-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              aria-label={labels.title}
              title={labels.title}
              data-testid="conversation-members-trigger"
            />
          }
        >
          <Users className="size-3.5" />
          {agentCount > 0 && (
            <span className="tabular-nums text-[11px]">{agentCount}</span>
          )}
        </PopoverTrigger>

        <PopoverContent align="end" sideOffset={6} className="w-72 p-0">
          <div className="border-b border-border/50 px-3 py-2">
            <div className="text-sm font-medium">{labels.title}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {labels.subtitle}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto thin-scrollbar">
            {loading && resolved.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {labels.loading}
              </div>
            ) : resolved.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {labels.empty}
              </div>
            ) : (
              <ul className="divide-y divide-border/40 py-1">
                {resolved.map((row) => {
                  const rmKey = `rm:${row.memberType}:${row.memberId}`;
                  return (
                    <li
                      key={row.key}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                          row.memberType === "agent"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {row.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {row.displayName}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {row.memberType === "agent"
                            ? labels.agentBadge
                            : labels.userBadge}
                          {row.subtitle &&
                            row.subtitle !== "agent" &&
                            row.subtitle !== "user" &&
                            ` · ${row.subtitle}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors disabled:opacity-40"
                        aria-label={labels.remove}
                        disabled={busyKey === rmKey}
                        onClick={() =>
                          void handleRemove(row.memberType, row.memberId)
                        }
                      >
                        {busyKey === rmKey ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {availableAgents.length > 0 && (
            <div className="border-t border-border/50 p-2">
              <div className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">
                {labels.addAgent}
              </div>
              <div className="max-h-28 overflow-y-auto thin-scrollbar space-y-0.5">
                {availableAgents.map((a) => {
                  const addKey = `add:${a.id}`;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!!busyKey}
                      onClick={() => void handleAddAgent(a.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {busyKey === addKey ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium">{a.name}</span>
                      {preferAgentId === a.id && (
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {labels.thisAgent}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
