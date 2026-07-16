"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAgentContext } from "@/contexts/agent-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AgentEditForm } from "@/components/agent-edit-form";
import { LiveAgentContextPanel } from "@/components/live-agent-context-panel";
import { ChannelBar } from "@/components/channel-bar";
import { ChannelMembersPanel } from "@/components/channel-members-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { FolderOpen, GitBranch, History, Mail, MessageSquare, MoreHorizontal, Pencil, Trash2, Video, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { fetchModelOptions } from "@/lib/api";
import { AGENT_PAGE_LABELS, agentDeleteDescription } from "./agent-page-labels";

export default function AgentDetailLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { slug, workspaceId } = useWorkspace();
  const searchParams = useSearchParams();
  const agentId = params.id as string;
  const isActivityView = !!searchParams.get("conv");
  const currentTab = pathname.includes("/activity") || isActivityView
    ? "activity"
    : pathname.includes("/meetings")
      ? "meetings"
      : pathname.includes("/email")
        ? "email"
        : pathname.includes("/files")
          ? "files"
          : "chat";
  const tabLabels: Record<string, string> = { email: AGENT_PAGE_LABELS.layout.tabEmail, meetings: AGENT_PAGE_LABELS.layout.tabMeetings, activity: AGENT_PAGE_LABELS.layout.tabActivity, files: AGENT_PAGE_LABELS.layout.tabFiles };
  const { agents, runtimes, handleDeleteAgent, handleUpdateAgent } = useAgentContext();

  const agent = agents.find((a) => a.id === agentId);
  const runtime = agent ? runtimes.find((r) => r.id === agent.runtime_id) : null;
  const isOnline = runtime?.status === "online";
  const { activeTaskCounts } = useAgentContext();
  const taskCount = activeTaskCounts[agentId] ?? 0;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentConfirmOpen, setAgentConfirmOpen] = useState(false);
  const [agentDeleting, setAgentDeleting] = useState(false);
  const [modelOptions, setModelOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchModelOptions().then(setModelOptions).catch(() => {});
  }, []);

  return (
    <>
      {/* Top navbar */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 md:px-5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {agent ? (
            <AgentStatusBadge
              isOnline={isOnline}
              taskCount={taskCount}
              agentId={agentId}
            />
          ) : (
            <Skeleton className="size-2 rounded-full shrink-0" />
          )}
          {agent ? (
            <Tooltip>
              <TooltipTrigger render={
                <Link
                  href={`/w/${slug}/agents/${agentId}`}
                  onClick={() => setEditing(false)}
                  className="text-sm font-medium truncate hover:text-foreground/80 transition-colors"
                />
              }>
                {agent.name}
              </TooltipTrigger>
              <TooltipContent>
                {[agent.role_title, agent.description].filter(Boolean).join(" · ")
                  || AGENT_PAGE_LABELS.layout.noDescription}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Skeleton className="h-3.5 w-24" />
          )}
          <span className="text-xs text-muted-foreground">
            / {editing ? AGENT_PAGE_LABELS.layout.settings : tabLabels[currentTab] ?? AGENT_PAGE_LABELS.layout.tabChat}
          </span>
        </div>
        {agent ? (
          <div className="flex items-center gap-0.5 shrink-0">
            {editing ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 gap-1 px-2"
                onClick={() => setEditing(false)}
              >
                <X className="size-3" />
                {AGENT_PAGE_LABELS.layout.cancel}
              </Button>
            ) : (
              <>
                {/* Desktop: inline buttons */}
                <div className="hidden sm:flex items-center gap-0.5">
                  <Link
                    href={`/w/${slug}/agents/${agentId}`}
                    className={`group inline-flex items-center rounded-lg text-xs h-7 px-2 transition-all ${
                      currentTab === "chat"
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="size-3 shrink-0" />
                    <span className={`overflow-hidden transition-all duration-500 ease-out ${
                      currentTab === "chat"
                        ? "max-w-16 opacity-100 ml-1"
                        : "max-w-0 opacity-0 group-hover:max-w-16 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300"
                    }`}>{AGENT_PAGE_LABELS.layout.tabChat}</span>
                  </Link>
                  <Link
                    href={`/w/${slug}/agents/${agentId}/email`}
                    className={`group inline-flex items-center rounded-lg text-xs h-7 px-2 transition-all ${
                      currentTab === "email"
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Mail className="size-3 shrink-0" />
                    <span className={`overflow-hidden transition-all duration-500 ease-out ${
                      currentTab === "email"
                        ? "max-w-16 opacity-100 ml-1"
                        : "max-w-0 opacity-0 group-hover:max-w-16 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300"
                    }`}>{AGENT_PAGE_LABELS.layout.tabEmail}</span>
                  </Link>
                  <Link
                    href={`/w/${slug}/agents/${agentId}/meetings`}
                    className={`group inline-flex items-center rounded-lg text-xs h-7 px-2 transition-all ${
                      currentTab === "meetings"
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Video className="size-3 shrink-0" />
                    <span className={`overflow-hidden transition-all duration-500 ease-out ${
                      currentTab === "meetings"
                        ? "max-w-20 opacity-100 ml-1"
                        : "max-w-0 opacity-0 group-hover:max-w-20 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300"
                    }`}>{AGENT_PAGE_LABELS.layout.tabMeetings}</span>
                  </Link>
                  <Link
                    href={`/w/${slug}/agents/${agentId}/activity`}
                    className={`group inline-flex items-center rounded-lg text-xs h-7 px-2 transition-all ${
                      currentTab === "activity"
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <History className="size-3 shrink-0" />
                    <span className={`overflow-hidden transition-all duration-500 ease-out ${
                      currentTab === "activity"
                        ? "max-w-16 opacity-100 ml-1"
                        : "max-w-0 opacity-0 group-hover:max-w-16 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300"
                    }`}>{AGENT_PAGE_LABELS.layout.tabActivity}</span>
                  </Link>
                  <Link
                    href={`/w/${slug}/agents/${agentId}/files`}
                    className={`group inline-flex items-center rounded-lg text-xs h-7 px-2 transition-all ${
                      currentTab === "files"
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <FolderOpen className="size-3 shrink-0" />
                    <span className={`overflow-hidden transition-all duration-500 ease-out ${
                      currentTab === "files"
                        ? "max-w-16 opacity-100 ml-1"
                        : "max-w-0 opacity-0 group-hover:max-w-16 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300"
                    }`}>{AGENT_PAGE_LABELS.layout.tabFiles}</span>
                  </Link>
                  <Link
                    href={`/w/${slug}/traces?agentId=${agentId}`}
                    className="group inline-flex items-center rounded-lg text-xs text-muted-foreground h-7 px-2 hover:bg-muted hover:text-foreground transition-all"
                  >
                    <GitBranch className="size-3 shrink-0" />
                    <span className="max-w-0 opacity-0 group-hover:max-w-20 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300 overflow-hidden transition-all duration-500 ease-out">{AGENT_PAGE_LABELS.layout.tabTraces}</span>
                  </Link>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    className="group inline-flex items-center rounded-lg text-xs text-muted-foreground h-7 px-2 hover:bg-muted hover:text-foreground transition-all"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="size-3 shrink-0" />
                    <span className="max-w-0 opacity-0 group-hover:max-w-12 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300 overflow-hidden transition-all duration-500 ease-out">{AGENT_PAGE_LABELS.layout.edit}</span>
                  </button>
                  <button
                    className="group inline-flex items-center rounded-lg text-xs text-muted-foreground h-7 px-2 hover:bg-muted hover:text-destructive transition-all"
                    onClick={() => setAgentConfirmOpen(true)}
                  >
                    <Trash2 className="size-3 shrink-0" />
                    <span className="max-w-0 opacity-0 group-hover:max-w-16 group-hover:opacity-100 group-hover:ml-1 group-hover:delay-300 overflow-hidden transition-all duration-500 ease-out">{AGENT_PAGE_LABELS.layout.remove}</span>
                  </button>
                </div>

                {/* Mobile: collapsed dropdown */}
                <div className="sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6}>
                      {currentTab !== "chat" && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/w/${slug}/agents/${agentId}`)}
                        >
                          <MessageSquare className="size-3.5" /> {AGENT_PAGE_LABELS.layout.tabChat}
                        </DropdownMenuItem>
                      )}
                      {currentTab !== "email" && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/w/${slug}/agents/${agentId}/email`)}
                        >
                          <Mail className="size-3.5" /> {AGENT_PAGE_LABELS.layout.tabEmail}
                        </DropdownMenuItem>
                      )}
                      {currentTab !== "meetings" && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/w/${slug}/agents/${agentId}/meetings`)}
                        >
                          <Video className="size-3.5" /> {AGENT_PAGE_LABELS.layout.tabMeetings}
                        </DropdownMenuItem>
                      )}
                      {currentTab !== "activity" && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/w/${slug}/agents/${agentId}/activity`)}
                        >
                          <History className="size-3.5" /> {AGENT_PAGE_LABELS.layout.tabActivity}
                        </DropdownMenuItem>
                      )}
                      {currentTab !== "files" && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/w/${slug}/agents/${agentId}/files`)}
                        >
                          <FolderOpen className="size-3.5" /> {AGENT_PAGE_LABELS.layout.tabFiles}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/w/${slug}/traces?agentId=${agentId}`)
                        }
                      >
                        <GitBranch className="size-3.5" />
                        {AGENT_PAGE_LABELS.layout.tabTraces}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditing(true)}>
                        <Pencil className="size-3.5" />
                        {AGENT_PAGE_LABELS.layout.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setAgentConfirmOpen(true)}
                      >
                        <Trash2 className="size-3.5" />
                        {AGENT_PAGE_LABELS.layout.remove}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-7 shrink-0" />
        )}
      </div>

      {/* Content: edit form OR full-width children */}
      {editing && agent ? (
        <AgentEditForm
          agent={agent}
          runtimes={runtimes}
          modelOptions={modelOptions}
          saving={saving}
          onCancel={() => setEditing(false)}
          onSave={async (data) => {
            setSaving(true);
            try {
              const ok = await handleUpdateAgent(agent.id, data);
              if (ok) setEditing(false);
              return ok;
            } finally {
              setSaving(false);
            }
          }}
        />

      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {currentTab === "chat" && (
            <div className="flex items-center gap-1 min-w-0">
              <div className="min-w-0 flex-1">
                <ChannelBar />
              </div>
              <ChannelMembersPanel preferAgentId={agentId} className="pr-2 md:pr-3" />
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden flex">
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
              {children}
            </div>
            {agent && (
              <div className="hidden lg:flex shrink-0 items-start border-l border-border/40 p-2.5">
                {/* Live memory / issues / integrations — shown on agent tabs including channel (chat). */}
                <LiveAgentContextPanel
                  workspaceId={workspaceId}
                  agentId={agent.id}
                  className="w-56 xl:w-64 max-h-full"
                  defaultCollapsed
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete agent confirmation */}
      {agent && (
        <ConfirmDialog
          open={agentConfirmOpen}
          onOpenChange={setAgentConfirmOpen}
          title={AGENT_PAGE_LABELS.layout.removeAgentTitle}
          description={agentDeleteDescription(agent.name)}
          loading={agentDeleting}
          onConfirm={async () => {
            setAgentDeleting(true);
            try {
              const ok = await handleDeleteAgent(agent.id);
              if (ok) router.push(`/w/${slug}/home`);
            } finally {
              setAgentDeleting(false);
              setAgentConfirmOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
