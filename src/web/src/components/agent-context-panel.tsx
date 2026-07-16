"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Link2, NotebookPen, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMemoryNote {
  id: string;
  kind?: string | null;
  content: string;
}

export interface ContextIssueItem {
  id: string;
  title: string;
  status?: string | null;
}

export interface AgentContextPanelProps {
  memoryNotes?: ContextMemoryNote[];
  recentIssues?: ContextIssueItem[];
  integrationsCount?: number;
  className?: string;
  /** Start with the whole panel collapsed (progressive disclosure). Default true. */
  defaultCollapsed?: boolean;
}

const LABELS = {
  title: "បរិបទ",
  memory: "អង្គចងចាំ",
  issues: "ភារកិច្ចថ្មីៗ",
  integrations: "ការតភ្ជាប់",
  emptyMemory: "មិនទាន់មានកំណត់ចំណាំ",
  emptyIssues: "មិនទាន់មានភារកិច្ច",
  emptyIntegrations: "មិនទាន់មានការតភ្ជាប់",
  integrationsHint: "ការតភ្ជាប់នឹងបង្ហាញនៅទីនេះពេលភ្ជាប់",
  expand: "ពង្រីកបរិបទ",
  collapse: "បង្រួមបរិបទ",
} as const;

function Section({
  id,
  title,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-muted-foreground/80">{icon}</span>
        <span className="flex-1 truncate">{title}</span>
        {typeof count === "number" && (
          <span className="tabular-nums text-[10px] text-muted-foreground/70">{count}</span>
        )}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        hidden={!open}
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
          open ? "max-h-64 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="max-h-56 overflow-y-auto thin-scrollbar px-3 pb-2.5 pt-0.5">
          {children}
        </div>
      </div>
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-muted-foreground/70 py-1">{children}</p>;
}

/**
 * Progressive-disclosure context rail for an agent: memory notes, recent issues,
 * and integrations count. Pure presentational — data is passed in via props.
 */
export function AgentContextPanel({
  memoryNotes = [],
  recentIssues = [],
  integrationsCount = 0,
  className,
  defaultCollapsed = true,
}: AgentContextPanelProps) {
  const [panelOpen, setPanelOpen] = useState(!defaultCollapsed);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    memory: true,
    issues: false,
    integrations: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!panelOpen) {
    return (
      <div className={cn("flex flex-col items-stretch", className)}>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label={LABELS.expand}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <NotebookPen className="size-3 shrink-0" aria-hidden />
          <span>{LABELS.title}</span>
          <span className="tabular-nums text-[10px] text-muted-foreground/70">
            {memoryNotes.length + recentIssues.length + integrationsCount}
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col rounded-lg border border-border/50 bg-background/70 shadow-sm",
        className,
      )}
      aria-label={LABELS.title}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <NotebookPen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="text-xs font-medium text-foreground truncate">{LABELS.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label={LABELS.collapse}
          className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ChevronDown className="size-3.5 rotate-180" aria-hidden />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        <Section
          id="agent-ctx-memory"
          title={LABELS.memory}
          icon={<NotebookPen className="size-3" aria-hidden />}
          count={memoryNotes.length}
          open={!!openSections.memory}
          onToggle={() => toggleSection("memory")}
        >
          {memoryNotes.length === 0 ? (
            <EmptyLine>{LABELS.emptyMemory}</EmptyLine>
          ) : (
            <ul className="space-y-1.5">
              {memoryNotes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-md bg-muted/30 px-2 py-1.5 text-[11px] leading-relaxed text-foreground/90"
                >
                  {note.kind ? (
                    <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {note.kind}
                    </span>
                  ) : null}
                  <span className="line-clamp-3 whitespace-pre-wrap">{note.content}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="agent-ctx-issues"
          title={LABELS.issues}
          icon={<ListTodo className="size-3" aria-hidden />}
          count={recentIssues.length}
          open={!!openSections.issues}
          onToggle={() => toggleSection("issues")}
        >
          {recentIssues.length === 0 ? (
            <EmptyLine>{LABELS.emptyIssues}</EmptyLine>
          ) : (
            <ul className="space-y-1">
              {recentIssues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex items-start gap-2 rounded-md px-1 py-1 text-[11px] leading-snug"
                >
                  <span className="flex-1 min-w-0 line-clamp-2 text-foreground/90">{issue.title}</span>
                  {issue.status ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
                      {issue.status}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="agent-ctx-integrations"
          title={LABELS.integrations}
          icon={<Link2 className="size-3" aria-hidden />}
          count={integrationsCount}
          open={!!openSections.integrations}
          onToggle={() => toggleSection("integrations")}
        >
          {integrationsCount === 0 ? (
            <EmptyLine>{LABELS.emptyIntegrations}</EmptyLine>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground/80 py-1">
              {integrationsCount} · {LABELS.integrationsHint}
            </p>
          )}
        </Section>
      </div>
    </aside>
  );
}
