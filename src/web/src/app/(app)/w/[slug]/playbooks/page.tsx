"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAgentContext } from "@/contexts/agent-context";
import {
  listPlaybooks,
  createPlaybook,
  deletePlaybook,
  publishPlaybook,
  type PlaybookItem,
} from "@/lib/api";
import type { PlaybookStepDef } from "@phneakngar/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpenCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { nanoid } from "nanoid";

function newStep(kind: PlaybookStepDef["kind"]): PlaybookStepDef {
  return { id: nanoid(8), kind, title: "" };
}

function StepEditor({
  step,
  index,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  step: PlaybookStepDef;
  index: number;
  onChange: (next: PlaybookStepDef) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm";
  return (
    <div className="rounded-md border border-border/40 bg-background px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground w-5">{index + 1}</span>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={step.kind}
          onChange={(e) => onChange({ ...step, kind: e.target.value as PlaybookStepDef["kind"] })}
        >
          <option value="agent">Agent step</option>
          <option value="approval">Approval gate</option>
          <option value="human_input">Human input</option>
        </select>
        <input
          className={inputCls}
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
          placeholder="Step title"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-1.5 text-muted-foreground"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-1.5 text-muted-foreground"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-1.5 text-muted-foreground"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {step.kind === "agent" ? (
        <textarea
          className={`${inputCls} min-h-20 thin-scrollbar`}
          value={step.prompt ?? ""}
          onChange={(e) => onChange({ ...step, prompt: e.target.value })}
          placeholder="Prompt for the agent… supports {{input.key}} and {{steps.<id>.output}}"
        />
      ) : null}
      {step.kind === "approval" ? (
        <input
          className={inputCls}
          value={step.approvalTitle ?? ""}
          onChange={(e) => onChange({ ...step, approvalTitle: e.target.value })}
          placeholder="Approval title shown in the Approvals inbox"
        />
      ) : null}
      {step.kind === "human_input" ? (
        <input
          className={inputCls}
          value={step.question ?? ""}
          onChange={(e) => onChange({ ...step, question: e.target.value })}
          placeholder="Question shown to the operator"
        />
      ) : null}
    </div>
  );
}

export default function PlaybooksPage() {
  const { workspaceId, slug } = useWorkspace();
  const { agents } = useAgentContext();
  const [items, setItems] = useState<PlaybookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [steps, setSteps] = useState<PlaybookStepDef[]>([newStep("agent")]);

  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPlaybooks(workspaceId);
      setItems(result.items);
    } catch {
      toast.error("Failed to load playbooks");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStep = (idx: number, next: PlaybookStepDef) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? next : s)));

  const moveStep = (idx: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || steps.length === 0) return;
    setSubmitting(true);
    try {
      const { playbook } = await createPlaybook(workspaceId, {
        title: title.trim(),
        description: description.trim(),
        agent_id: agentId || null,
        definition: steps,
      });
      setItems((prev) => [playbook, ...prev]);
      setTitle("");
      setDescription("");
      setSteps([newStep("agent")]);
      setShowForm(false);
      toast.success("Playbook created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (item: PlaybookItem) => {
    try {
      const { playbook } = await publishPlaybook(workspaceId, item.id);
      setItems((prev) => prev.map((row) => (row.id === item.id ? playbook : row)));
      toast.success("Playbook published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    }
  };

  const handleDelete = async (id: string) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deletePlaybook(workspaceId, id);
    } catch {
      setItems(previous);
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-sm font-medium text-foreground">Playbooks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Structured SOPs with approval and human-input gates, executed step-by-step by agent runtimes.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>

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
                placeholder="Release checklist"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Agent (optional)</span>
              <select
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">Workspace-level</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Description</span>
            <input
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this playbook does"
            />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Steps (executed in order)</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSteps((p) => [...p, newStep("agent")])}
                >
                  + Agent
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSteps((p) => [...p, newStep("approval")])}
                >
                  + Approval
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSteps((p) => [...p, newStep("human_input")])}
                >
                  + Input
                </Button>
              </div>
            </div>
            {steps.map((step, idx) => (
              <StepEditor
                key={step.id}
                step={step}
                index={idx}
                onChange={(next) => updateStep(idx, next)}
                onRemove={() => setSteps((p) => p.filter((_, i) => i !== idx))}
                onMove={(dir) => moveStep(idx, dir)}
                canMoveUp={idx > 0}
                canMoveDown={idx < steps.length - 1}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting || steps.length === 0}>
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
              <BookOpenCheck className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No playbooks yet</p>
            <p className="text-xs text-muted-foreground/80 max-w-sm">
              Build a step-by-step SOP with approval gates. Runs are durable and resume after restarts.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border/40">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Steps</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium w-28" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const agent = item.agent_id ? agentsById.get(item.agent_id) : null;
                return (
                  <tr key={item.id} className="border-b border-border/30">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/w/${slug}/playbooks/${item.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {agent?.name ?? "Workspace"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {item.definition.length}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      v{item.version}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          item.status === "published"
                            ? "text-[11px] uppercase tracking-wide rounded px-1.5 py-0.5 border border-emerald-500/50 text-emerald-700 dark:text-emerald-400"
                            : "text-[11px] uppercase tracking-wide rounded px-1.5 py-0.5 border border-border/50 text-muted-foreground"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        {item.status !== "published" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePublish(item)}
                          >
                            Publish
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
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
