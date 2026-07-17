"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Agent } from "@phneakngar/shared";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  listGatewayBindings,
  createGatewayBinding,
  updateGatewayBinding,
  deleteGatewayBinding,
  probeGatewayBinding,
  listAgents,
  type GatewayBindingItem,
} from "@/lib/api";
import { getWorkspaceHealth } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SETTINGS_LABELS } from "./settings-labels";

const PROVIDERS = ["slack", "discord", "telegram", "lark", "teams"] as const;

type GatewayHealthSlice = {
  status?: "ok" | "warning" | "critical";
  webhook_fail_closed?: boolean;
};

/** Client-safe dry-config mirror of shared assessGatewayBindingsDryConfig (no drizzle). */
function assessBindingsClient(
  items: GatewayBindingItem[],
  agents: Agent[],
): {
  status: "ok" | "warning" | "critical";
  total: number;
  live: number;
  preview: number;
  live_without_token_risk: number;
  missing_team_id: number;
  missing_agent_ref: number;
} {
  const known = new Set(agents.map((a) => a.id));
  let live = 0;
  let preview = 0;
  let live_without_token_risk = 0;
  let missing_team_id = 0;
  let missing_agent_ref = 0;

  for (const b of items) {
    const isLive = (b.outbound_mode ?? "").trim().toLowerCase() === "live";
    if (isLive) {
      live += 1;
      if (!b.has_secret) live_without_token_risk += 1;
    } else {
      preview += 1;
    }
    if (!(b.external_team_id ?? "").trim()) missing_team_id += 1;
    if (!(b.agent_id ?? "").trim() || !known.has(b.agent_id)) missing_agent_ref += 1;
  }

  const status: "ok" | "warning" | "critical" =
    missing_team_id > 0 || missing_agent_ref > 0
      ? "critical"
      : live_without_token_risk > 0
        ? "warning"
        : "ok";

  return {
    status,
    total: items.length,
    live,
    preview,
    live_without_token_risk,
    missing_team_id,
    missing_agent_ref,
  };
}

export function GatewayTab() {
  const { workspaceId } = useWorkspace();
  const [items, setItems] = useState<GatewayBindingItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("telegram");
  const [teamId, setTeamId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [outboundMode, setOutboundMode] = useState<"preview" | "live">("preview");
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [webhookFailClosed, setWebhookFailClosed] = useState(false);
  const [healthGatewayIssues, setHealthGatewayIssues] = useState<
    Array<{ code: string; severity: string; message: string }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bindings, agentList, health] = await Promise.all([
        listGatewayBindings(workspaceId),
        listAgents(workspaceId),
        getWorkspaceHealth(workspaceId).catch(() => null),
      ]);
      setItems(bindings.items ?? []);
      setAgents(agentList ?? []);
      if (!agentId && agentList?.[0]?.id) setAgentId(agentList[0].id);

      const healthRecord = health as
        | {
            checks?: { gateway?: GatewayHealthSlice };
            issues?: Array<{ code: string; severity: string; message: string }>;
          }
        | null;
      const gw = healthRecord?.checks?.gateway;
      setWebhookFailClosed(Boolean(gw?.webhook_fail_closed));
      const issueCodes = new Set([
        "gateway_binding_missing_team_id",
        "gateway_binding_missing_agent",
        "gateway_live_without_token_risk",
        "gateway_webhook_secret_missing",
      ]);
      setHealthGatewayIssues(
        (healthRecord?.issues ?? []).filter((issue) => issueCodes.has(issue.code)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : SETTINGS_LABELS.gateway.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const bindingDoctor = useMemo(
    () => assessBindingsClient(items, agents),
    [items, agents],
  );

  const doctorStatus: "ok" | "warning" | "critical" = useMemo(() => {
    if (webhookFailClosed || bindingDoctor.status === "critical") return "critical";
    if (bindingDoctor.status === "warning" || healthGatewayIssues.some((i) => i.severity === "warning")) {
      return "warning";
    }
    return "ok";
  }, [bindingDoctor.status, webhookFailClosed, healthGatewayIssues]);

  const doctorStatusLabel =
    doctorStatus === "critical"
      ? SETTINGS_LABELS.gateway.doctorCritical
      : doctorStatus === "warning"
        ? SETTINGS_LABELS.gateway.doctorWarning
        : SETTINGS_LABELS.gateway.doctorOk;

  const handleCreate = async () => {
    if (!teamId.trim() || !agentId) {
      toast.error(SETTINGS_LABELS.gateway.missingFields);
      return;
    }
    setSaving(true);
    try {
      const res = await createGatewayBinding(workspaceId, {
        provider,
        external_team_id: teamId.trim(),
        agent_id: agentId,
        outbound_mode: outboundMode,
        dm_policy: "open",
        ...(botToken.trim() ? { secret_ref: botToken.trim() } : {}),
      });
      setItems((prev) => [...prev, res.binding]);
      setTeamId("");
      setBotToken("");
      setOutboundMode("preview");
      toast.success(SETTINGS_LABELS.gateway.created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : SETTINGS_LABELS.gateway.failedToCreate);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGatewayBinding(workspaceId, id);
      setItems((prev) => prev.filter((b) => b.id !== id));
      toast.success(SETTINGS_LABELS.gateway.deleted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : SETTINGS_LABELS.gateway.failedToDelete);
    }
  };

  const handleSaveToken = async (id: string) => {
    const token = (tokenDrafts[id] ?? "").trim();
    if (!token) {
      toast.error(SETTINGS_LABELS.gateway.botToken);
      return;
    }
    setBusyId(id);
    try {
      const res = await updateGatewayBinding(workspaceId, id, { secret_ref: token });
      setItems((prev) => prev.map((b) => (b.id === id ? res.binding : b)));
      setTokenDrafts((prev) => ({ ...prev, [id]: "" }));
      toast.success(SETTINGS_LABELS.gateway.tokenSaved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : SETTINGS_LABELS.gateway.failedToUpdate);
    } finally {
      setBusyId(null);
    }
  };

  const handleSetMode = async (id: string, mode: "live" | "preview") => {
    setBusyId(id);
    try {
      const res = await updateGatewayBinding(workspaceId, id, { outbound_mode: mode });
      setItems((prev) => prev.map((b) => (b.id === id ? res.binding : b)));
      toast.success(SETTINGS_LABELS.gateway.updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : SETTINGS_LABELS.gateway.failedToUpdate);
    } finally {
      setBusyId(null);
    }
  };

  const handleProbe = async (id: string) => {
    setBusyId(id);
    try {
      const res = await probeGatewayBinding(workspaceId, id);
      if (res.ok) toast.success(SETTINGS_LABELS.gateway.probeOk);
      else toast.error(res.error ?? SETTINGS_LABELS.gateway.probeFailed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : SETTINGS_LABELS.gateway.probeFailed);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 max-w-2xl">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-medium">{SETTINGS_LABELS.gateway.sectionTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {SETTINGS_LABELS.gateway.sectionHint}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          {SETTINGS_LABELS.gateway.parityNote}
        </p>
      </div>

      <div
        className={
          doctorStatus === "critical"
            ? "rounded-md border border-red-500/40 bg-red-500/5 p-3 space-y-1.5"
            : doctorStatus === "warning"
              ? "rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5"
              : "rounded-md border border-border/50 p-3 space-y-1.5"
        }
        data-testid="gateway-dry-config-doctor"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium">{SETTINGS_LABELS.gateway.doctorTitle}</h3>
          <span
            className={
              doctorStatus === "critical"
                ? "text-[10px] uppercase tracking-wide text-red-700 dark:text-red-400"
                : doctorStatus === "warning"
                  ? "text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400"
                  : "text-[10px] uppercase tracking-wide text-muted-foreground"
            }
          >
            {doctorStatusLabel}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {SETTINGS_LABELS.gateway.doctorHint}
        </p>
        {items.length === 0 && !webhookFailClosed ? (
          <p className="text-xs text-muted-foreground">{SETTINGS_LABELS.gateway.doctorEmpty}</p>
        ) : (
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
            <li>
              {bindingDoctor.total} {SETTINGS_LABELS.gateway.doctorBindingsSummary}
              {" · "}
              {bindingDoctor.live} Live · {bindingDoctor.preview} Preview
            </li>
            {bindingDoctor.live_without_token_risk > 0 && (
              <li>{SETTINGS_LABELS.gateway.doctorLiveRisk}</li>
            )}
            {bindingDoctor.missing_team_id > 0 && (
              <li>{SETTINGS_LABELS.gateway.doctorMissingTeam}</li>
            )}
            {bindingDoctor.missing_agent_ref > 0 && (
              <li>{SETTINGS_LABELS.gateway.doctorMissingAgent}</li>
            )}
            {webhookFailClosed && (
              <li>{SETTINGS_LABELS.gateway.doctorWebhookFailClosed}</li>
            )}
          </ul>
        )}
      </div>

      <div className="rounded-md border border-border/50 p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground space-y-1">
            <span>{SETTINGS_LABELS.gateway.provider}</span>
            <select
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
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
          <label className="text-xs text-muted-foreground space-y-1">
            <span>{SETTINGS_LABELS.gateway.teamId}</span>
            <input
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="T123 / chat_id / guild"
            />
          </label>
          <label className="text-xs text-muted-foreground space-y-1 sm:col-span-2">
            <span>{SETTINGS_LABELS.gateway.agent}</span>
            <select
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            <span>{SETTINGS_LABELS.gateway.outboundMode}</span>
            <select
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={outboundMode}
              onChange={(e) => setOutboundMode(e.target.value as "preview" | "live")}
            >
              <option value="preview">{SETTINGS_LABELS.gateway.outboundPreview}</option>
              <option value="live">{SETTINGS_LABELS.gateway.outboundLive}</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground space-y-1">
            <span>{SETTINGS_LABELS.gateway.botToken}</span>
            <input
              type="password"
              autoComplete="off"
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="xoxb-… / bot token"
            />
            <span className="block text-[10px] text-muted-foreground/80">
              {SETTINGS_LABELS.gateway.botTokenHint}
            </span>
          </label>
        </div>
        <Button size="sm" onClick={() => void handleCreate()} disabled={saving}>
          <Plus className="size-3.5 mr-1.5" />
          {saving ? SETTINGS_LABELS.gateway.saving : SETTINGS_LABELS.gateway.add}
        </Button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{SETTINGS_LABELS.gateway.empty}</p>
        ) : (
          items.map((b) => (
            <div
              key={b.id}
              className="rounded-md border border-border/40 px-3 py-2.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{b.provider}</span>
                    <span
                      className={
                        b.outbound_badge === "Live"
                          ? "text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400"
                          : "text-[10px] uppercase tracking-wide text-muted-foreground"
                      }
                      title={
                        b.outbound_badge === "Live" && !b.has_secret
                          ? SETTINGS_LABELS.gateway.doctorLiveRisk
                          : undefined
                      }
                    >
                      {b.outbound_badge}
                      {b.outbound_badge === "Live" && !b.has_secret ? (
                        <span className="ml-1 normal-case tracking-normal text-muted-foreground">
                          ({SETTINGS_LABELS.gateway.liveRiskBadgeHint})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {b.has_secret
                        ? SETTINGS_LABELS.gateway.hasSecret
                        : SETTINGS_LABELS.gateway.noSecret}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.external_team_id} · {b.dm_policy} · {b.status}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-8"
                  onClick={() => void handleDelete(b.id)}
                  aria-label={SETTINGS_LABELS.gateway.delete}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[11px] text-muted-foreground space-y-1 flex-1 min-w-[10rem]">
                  <span>{SETTINGS_LABELS.gateway.botToken}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    className="w-full h-8 rounded-md border border-border/60 bg-background px-2 text-xs"
                    value={tokenDrafts[b.id] ?? ""}
                    onChange={(e) =>
                      setTokenDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))
                    }
                    placeholder={b.has_secret ? "••••••••" : "bot token"}
                  />
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busyId === b.id}
                  onClick={() => void handleSaveToken(b.id)}
                >
                  {SETTINGS_LABELS.gateway.saveToken}
                </Button>
                {b.outbound_mode === "live" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === b.id}
                    onClick={() => void handleSetMode(b.id, "preview")}
                  >
                    {SETTINGS_LABELS.gateway.setPreview}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === b.id}
                    onClick={() => void handleSetMode(b.id, "live")}
                  >
                    {SETTINGS_LABELS.gateway.enableLive}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === b.id || !b.has_secret}
                  onClick={() => void handleProbe(b.id)}
                >
                  {SETTINGS_LABELS.gateway.probe}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
