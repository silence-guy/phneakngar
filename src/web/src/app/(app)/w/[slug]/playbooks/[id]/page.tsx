"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAgentContext } from "@/contexts/agent-context";
import {
  getPlaybook,
  listPlaybookRuns,
  startPlaybookRun,
  getPlaybookRun,
  cancelPlaybookRun,
  answerPlaybookRun,
  type PlaybookItem,
  type PlaybookRunItem,
  type PlaybookStepRunItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RUN_STATUS_STYLES: Record<string, string> = {
  running: "border-blue-500/50 text-blue-700 dark:text-blue-400",
  awaiting_approval: "border-amber-500/50 text-amber-700 dark:text-amber-400",
  awaiting_input: "border-amber-500/50 text-amber-700 dark:text-amber-400",
  completed: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400",
  failed: "border-red-500/50 text-red-700 dark:text-red-400",
  cancelled: "border-border/50 text-muted-foreground",
};

const STEP_STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  awaiting_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  awaiting_input: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  skipped: "bg-muted text-muted-foreground",
};

function statusPill(status: string, styles: Record<string, string>) {
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide border",
        styles[status] ?? "border-border/50 text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RunTimeline({
  run,
  steps,
  onChanged,
}: {
  run: PlaybookRunItem;
  steps: PlaybookStepRunItem[];
  onChanged: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const snapshot = run.snapshot;

  const ordered = useMemo(() => {
    if (!snapshot) return steps;
    return [...steps].sort((a, b) => {
      const ai = snapshot.findIndex((s) => s.id === a.step_id);
      const bi = snapshot.findIndex((s) => s.id === b.step_id);
      return ai - bi;
    });
  }, [steps, snapshot]);

  const stepTitle = (stepId: string) =>
    snapshot?.find((s) => s.id === stepId)?.title ?? stepId;

  const handleCancel = async () => {
    setBusy(true);
    try {
      await cancelPlaybookRun(workspaceId, run.id);
      toast.success("Run cancelled");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setBusy(false);
    }
  };

  const handleAnswer = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      await answerPlaybookRun(workspaceId, run.id, answer.trim());
      setAnswer("");
      toast.success("Answer submitted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to answer");
    } finally {
      setBusy(false);
    }
  };

  const active = !["completed", "failed", "cancelled"].includes(run.status);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {statusPill(run.status, RUN_STATUS_STYLES)}
          <span className="text-xs text-muted-foreground">started {formatWhen(run.started_at)}</span>
        </div>
        {active ? (
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={busy}>
            Cancel run
          </Button>
        ) : null}
      </div>
      {run.error ? <p className="text-xs text-red-600 dark:text-red-400">{run.error}</p> : null}
      <ol className="space-y-2">
        {ordered.map((step) => (
          <li
            key={step.id}
            className="rounded-md border border-border/40 bg-background px-3 py-2 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {stepTitle(step.step_id)}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide",
                  STEP_STATUS_STYLES[step.status] ?? "bg-muted text-muted-foreground",
                )}
              >
                {step.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {step.step_kind.replace(/_/g, " ")}
              {step.task_id ? ` · task ${step.task_id}` : ""}
              {step.approval_id ? ` · approval ${step.approval_id}` : ""}
            </div>
            {step.output ? (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words rounded bg-muted/40 px-2 py-1 thin-scrollbar overflow-x-auto">
                {step.output}
              </pre>
            ) : null}
            {step.error ? <p className="text-xs text-red-600 dark:text-red-400">{step.error}</p> : null}
          </li>
        ))}
      </ol>
      {run.status === "awaiting_input" ? (
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type the requested input…"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAnswer();
            }}
          />
          <Button size="sm" onClick={handleAnswer} disabled={busy || !answer.trim()}>
            Submit
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function PlaybookDetailPage() {
  const params = useParams();
  const playbookId = params.id as string;
  const { workspaceId, slug } = useWorkspace();
  const { agents } = useAgentContext();

  const [playbook, setPlaybook] = useState<PlaybookItem | null>(null);
  const [runs, setRuns] = useState<PlaybookRunItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<{
    run: PlaybookRunItem;
    steps: PlaybookStepRunItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runAgentId, setRunAgentId] = useState("");
  const [runInput, setRunInput] = useState("");
  const [starting, setStarting] = useState(false);

  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pb, runList] = await Promise.all([
        getPlaybook(workspaceId, playbookId),
        listPlaybookRuns(workspaceId, playbookId),
      ]);
      setPlaybook(pb.playbook);
      setRuns(runList.items);
      setRunAgentId((prev) => prev || pb.playbook.agent_id || agents[0]?.id || "");
    } catch {
      toast.error("Failed to load playbook");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, playbookId, agents]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRunDetail = useCallback(
    async (runId: string) => {
      try {
        const detail = await getPlaybookRun(workspaceId, runId);
        setRunDetail(detail);
        return detail;
      } catch {
        toast.error("Failed to load run");
        return null;
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      const detail = await loadRunDetail(selectedRunId);
      // Stop polling once the run is terminal.
      if (
        cancelled ||
        !detail ||
        ["completed", "failed", "cancelled"].includes(detail.run.status)
      ) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };
    void tick();
    timer = setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [selectedRunId, loadRunDetail]);

  const handleStartRun = async () => {
    if (!runAgentId) return;
    let input: Record<string, string | number | boolean | null> | null = null;
    if (runInput.trim()) {
      try {
        input = JSON.parse(runInput);
      } catch {
        toast.error("Input must be a JSON object");
        return;
      }
    }
    setStarting(true);
    try {
      const { run } = await startPlaybookRun(workspaceId, playbookId, {
        agent_id: runAgentId,
        input,
      });
      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);
      setRunDialogOpen(false);
      toast.success("Run started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-3 space-y-3">
        <Skeleton className="h-8 w-64 rounded" />
        <Skeleton className="h-40 w-full rounded" />
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        Playbook not found.
      </div>
    );
  }

  const agent = playbook.agent_id ? agentsById.get(playbook.agent_id) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/40 px-4 py-3 space-y-1">
        <Link
          href={`/w/${slug}/playbooks`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Playbooks
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-foreground">{playbook.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {agent?.name ?? "Workspace-level"} · v{playbook.version} · {playbook.status} ·{" "}
              {playbook.definition.length} steps
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => load()}>
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => setRunDialogOpen(true)}
              disabled={playbook.status !== "published"}
            >
              <Play className="size-3.5" />
              Run
            </Button>
          </div>
        </div>
        {playbook.status !== "published" ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Publish this playbook from the list page to enable runs.
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-72 shrink-0 border-r border-border/40 overflow-y-auto thin-scrollbar">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/30">
            Runs
          </div>
          {runs.length === 0 ? (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">No runs yet</p>
          ) : (
            <ul>
              {runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 border-b border-border/30 hover:bg-muted/30",
                      selectedRunId === run.id ? "bg-muted/40" : "",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-foreground truncate">{run.id}</span>
                      {statusPill(run.status, RUN_STATUS_STYLES)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {formatWhen(run.created_at)}
                      {agentsById.get(run.agent_id) ? ` · ${agentsById.get(run.agent_id)!.name}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto thin-scrollbar px-4 py-3">
          {!selectedRunId ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Definition</div>
              <ol className="space-y-2">
                {playbook.definition.map((step, idx) => (
                  <li
                    key={step.id}
                    className="rounded-md border border-border/40 bg-background px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{idx + 1}</span>
                      <span className="text-sm font-medium text-foreground">{step.title}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {step.kind.replace(/_/g, " ")}
                      </span>
                    </div>
                    {step.kind === "agent" && step.prompt ? (
                      <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                        {step.prompt}
                      </pre>
                    ) : null}
                    {step.kind === "approval" && step.approvalTitle ? (
                      <p className="mt-1 text-xs text-muted-foreground">{step.approvalTitle}</p>
                    ) : null}
                    {step.kind === "human_input" && step.question ? (
                      <p className="mt-1 text-xs text-muted-foreground">{step.question}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : !runDetail ? (
            <Skeleton className="h-40 w-full rounded" />
          ) : (
            <RunTimeline
              run={runDetail.run}
              steps={runDetail.steps}
              onChanged={() => {
                loadRunDetail(selectedRunId);
                void listPlaybookRuns(workspaceId, playbookId).then((r) => setRuns(r.items));
              }}
            />
          )}
        </div>
      </div>

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run playbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Agent</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                value={runAgentId}
                onChange={(e) => setRunAgentId(e.target.value)}
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                Input (JSON object, optional) — usable as {"{{input.key}}"} in prompts
              </span>
              <textarea
                className="w-full min-h-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-mono thin-scrollbar"
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                placeholder={'{"version": "0.0.4"}'}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleStartRun} disabled={starting || !runAgentId}>
              {starting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Start run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
