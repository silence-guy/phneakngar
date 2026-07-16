"use client";

/**
 * Agent integrations settings (GitHub / Linear / …).
 * secret_ref is write-only: never rendered from list responses (has_secret only).
 * Full commercial OAuth marketplace is not claimed — vault pointer + status MVP.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createAgentIntegration,
  deleteAgentIntegration,
  listAgentIntegrations,
  type AgentIntegrationPublic,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PROVIDERS = ["github", "linear"] as const;

const LABELS = {
  title: "Integrations",
  subtitle:
    "Connect write-back providers. Secrets are stored as vault refs — the API never returns secret_ref.",
  provider: "Provider",
  secretRef: "Secret ref (optional)",
  secretPlaceholder: "workers-secret / vault pointer — never shown again",
  hasSecret: "secret vaulted",
  noSecret: "no secret",
  empty: "No integrations yet",
  add: "Add",
  honesty: "Full commercial OAuth marketplace is not claimed.",
  failedLoad: "Failed to load integrations",
  failedCreate: "Failed to create integration",
  failedDelete: "Failed to delete integration",
  created: "Integration added",
  deleted: "Integration removed",
} as const;

export function AgentIntegrationsPanel({
  agentId,
  workspaceId,
  className,
}: {
  agentId: string;
  workspaceId: string;
  className?: string;
}) {
  const [items, setItems] = useState<AgentIntegrationPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("github");
  const [secretRef, setSecretRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAgentIntegrations(agentId, workspaceId);
      setItems(res.integrations ?? []);
    } catch {
      toast.error(LABELS.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [agentId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await createAgentIntegration(agentId, workspaceId, {
        provider,
        status: "active",
        secret_ref: secretRef.trim() || null,
      });
      // Defense: never accept secret_ref from response even if server misbehaves.
      const safe = stripSecretFields(created);
      setItems((prev) => [safe, ...prev.filter((i) => i.provider !== safe.provider)]);
      setSecretRef("");
      toast.success(LABELS.created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : LABELS.failedCreate);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteAgentIntegration(agentId, workspaceId, id);
      toast.success(LABELS.deleted);
    } catch (err) {
      setItems(previous);
      toast.error(err instanceof Error ? err.message : LABELS.failedDelete);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-3 max-w-md", className)}>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-md space-y-4", className)}>
      <div>
        <h3 className="text-sm font-medium text-foreground">{LABELS.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {LABELS.subtitle}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">{LABELS.honesty}</p>
      </div>

      <div className="space-y-2 rounded-md border border-border/40 p-3">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{LABELS.provider}</span>
          <select
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as (typeof PROVIDERS)[number])}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{LABELS.secretRef}</span>
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            value={secretRef}
            onChange={(e) => setSecretRef(e.target.value)}
            placeholder={LABELS.secretPlaceholder}
          />
        </label>
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={saving} onClick={() => void handleCreate()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {LABELS.add}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{LABELS.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2"
              data-testid="agent-integration-row"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground capitalize truncate">
                  {item.provider}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {item.status}
                  {" · "}
                  {item.has_secret ? LABELS.hasSecret : LABELS.noSecret}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground shrink-0"
                disabled={busyId === item.id}
                onClick={() => void handleDelete(item.id)}
                aria-label={`Remove ${item.provider}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pure helper — never leak secret_ref / secretRef into UI state. */
export function stripSecretFields(
  row: AgentIntegrationPublic | (AgentIntegrationPublic & Record<string, unknown>),
): AgentIntegrationPublic {
  const raw = row as AgentIntegrationPublic & {
    secret_ref?: unknown;
    secretRef?: unknown;
  };
  return {
    id: raw.id,
    workspace_id: raw.workspace_id,
    agent_id: raw.agent_id,
    provider: raw.provider,
    status: raw.status,
    config: raw.config,
    has_secret: Boolean(raw.has_secret),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}
