"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAgentContext } from "@/contexts/agent-context";
import {
  listAutomations,
  listAutomationSuggestions,
  createAutomation,
  deleteAutomation,
  updateAutomation,
  type AutomationItem,
  type AutomationPatternSuggestionItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { classifyAutomationRunHealth } from "@/lib/automation-reliability";

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AutomationsPage() {
  const { workspaceId } = useWorkspace();
  const { agents } = useAgentContext();
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [suggestions, setSuggestions] = useState<AutomationPatternSuggestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState("daily");
  const [sop, setSop] = useState("");
  const [agentId, setAgentId] = useState("");
  const [nextRunAt, setNextRunAt] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  });

  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, suggestionResult] = await Promise.all([
        listAutomations(workspaceId),
        listAutomationSuggestions(workspaceId).catch(() => ({ items: [], min_count: 3 })),
      ]);
      setItems(result.items);
      setSuggestions(suggestionResult.items);
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!agentId && agents[0]) setAgentId(agents[0].id);
  }, [agents, agentId]);

  const applySuggestion = (s: AutomationPatternSuggestionItem) => {
    setTitle(s.suggested_title);
    setSop(s.suggested_sop_markdown);
    setSchedule(s.suggested_schedule || "daily");
    setAgentId(s.agent_id);
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || !title.trim()) return;
    setSubmitting(true);
    try {
      const local = new Date(nextRunAt);
      const { automation } = await createAutomation(workspaceId, {
        agent_id: agentId,
        title: title.trim(),
        sop_markdown: sop,
        schedule: schedule.trim() || "daily",
        next_run_at: local.toISOString(),
        delivery_mode: "channel",
        enabled: true,
      });
      setItems((prev) => [...prev, automation].sort((a, b) => a.next_run_at.localeCompare(b.next_run_at)));
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            !(
              s.agent_id === automation.agent_id &&
              (s.suggested_title === automation.title || s.pattern_key === automation.title.toLowerCase())
            ),
        ),
      );
      setTitle("");
      setSop("");
      setShowForm(false);
      toast.success("Automation created");
      // Refresh suggestions so matching patterns suppress after create.
      void listAutomationSuggestions(workspaceId)
        .then((r) => setSuggestions(r.items))
        .catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (item: AutomationItem) => {
    try {
      const { automation } = await updateAutomation(workspaceId, item.id, {
        enabled: !item.enabled,
      });
      setItems((prev) => prev.map((row) => (row.id === item.id ? automation : row)));
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteAutomation(workspaceId, id);
    } catch {
      setItems(previous);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium text-foreground">Automations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Readable SOPs with schedules. Due runs enqueue agent tasks from the database.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

      {!loading && suggestions.length > 0 ? (
        <div className="border-b border-border/40 px-4 py-3 space-y-2 bg-muted/10">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            <span>
              Pattern suggestions — promote recurring completed work into a scheduled automation
            </span>
          </div>
          <ul className="space-y-2">
            {suggestions.slice(0, 5).map((s) => {
              const agent = agentsById.get(s.agent_id);
              return (
                <li
                  key={`${s.agent_id}:${s.pattern_key}`}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {s.suggested_title}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.count} similar completions
                      {agent ? ` · ${agent.name}` : ""} · schedule {s.suggested_schedule}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => applySuggestion(s)}
                  >
                    Promote
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="border-b border-border/40 px-4 py-3 space-y-3 bg-muted/20"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Title</span>
              <input
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Morning brief"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Agent</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                required
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Schedule</span>
              <input
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="daily | 1day | 0 8 * * *"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Next run (local)</span>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                value={nextRunAt}
                onChange={(e) => setNextRunAt(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">SOP (markdown)</span>
            <textarea
              className="w-full min-h-22 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm thin-scrollbar"
              value={sop}
              onChange={(e) => setSop(e.target.value)}
              placeholder="Steps the agent should follow…"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !agents.length}>
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar">
        {loading ? (
          <div className="px-4 py-3 space-y-3">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="size-10 rounded-md bg-secondary flex items-center justify-center">
              <Zap className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No automations yet</p>
            <p className="text-xs text-muted-foreground/80 max-w-sm">
              Create a scheduled SOP owned by an agent. Due runs are scanned from the database — no in-memory scheduler.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/40">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Schedule</th>
                <th className="px-4 py-2 font-medium">Next run</th>
                <th className="px-4 py-2 font-medium">Last run</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const agent = agentsById.get(item.agent_id);
                const health = classifyAutomationRunHealth({
                  enabled: item.enabled,
                  nextRunAt: item.next_run_at,
                });
                const statusText =
                  health.statusLabel === "paused"
                    ? "Paused"
                    : health.statusLabel === "overdue"
                      ? "Overdue"
                      : "Enabled";
                return (
                  <tr key={item.id} className="border-b border-border/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{item.title}</div>
                      {item.sop_markdown ? (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {item.sop_markdown}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {agent?.name ?? item.agent_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {item.schedule}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {formatWhen(item.next_run_at)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {formatWhen(item.last_run_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggle(item)}
                        className={cn(
                          "text-[11px] uppercase tracking-wide rounded px-1.5 py-0.5 border",
                          health.statusLabel === "overdue"
                            ? "border-amber-500/50 text-amber-700 dark:text-amber-400"
                            : item.enabled
                              ? "border-border text-foreground"
                              : "border-border/50 text-muted-foreground"
                        )}
                      >
                        {statusText}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
