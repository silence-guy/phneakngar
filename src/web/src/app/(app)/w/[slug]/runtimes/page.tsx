"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAgentContext } from "@/contexts/agent-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Plus } from "lucide-react";

import type { AgentRuntime as Runtime } from "@phneakngar/shared";
import { semverGte, isTauri, isDesktop, tauriInvoke } from "@phneakngar/shared";
import { cliCmd, getAppMode } from "@/lib/utils";
import { connectMachineLabel } from "@/lib/locale";
import { ProviderLogo } from "@/components/provider-logo";
import { triggerRuntimeUpdate, triggerRuntimeRescan, fetchLatestCliVersion } from "@/lib/api";
import { Loader2, RefreshCw } from "lucide-react";

import { ConnectMachineSteps } from "@/components/connect-machine-steps";
import { trackRuntimeConnected } from "@/lib/analytics";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  RUNTIMES_LABELS,
  runtimeStatusLabel,
  updateChhlatDescription,
  rescanRuntimesDescription,
  removeMachineDescription,
} from "./runtimes-labels";

export default function RuntimesPage() {
  const { memberRole } = useWorkspace();
  const isOwner = memberRole === "owner";
  const { agents, runtimes, loading, handleGenerateToken, handleDeleteMachine, subscribeWs, workspaceId } =
    useAgentContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode = getAppMode();
  const isMobileApp = mode === "mobile";
  const isTauriDesktop = isTauri() && isDesktop();
  const hideNewMachine = isMobileApp || isTauriDesktop;

  const [sheetOpen, setSheetOpen] = useState(() => searchParams.has("connect"));
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);
  const [registeredChhlatId, setRegisteredChhlatId] = useState<string | null>(null);
  const [chhlatOnline, setChhlatOnline] = useState(false);

  const [latestCliVersion, setLatestCliVersion] = useState<string | null>(null);
  const [updatingChhlats, setUpdatingChhlats] = useState<Set<string>>(new Set());
  const [rescanningChhlats, setRescanningChhlats] = useState<Set<string>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmLabel, setConfirmLabel] = useState<string>(RUNTIMES_LABELS.remove);
  const [confirmLoadingLabel, setConfirmLoadingLabel] = useState<string | undefined>(undefined);
  const [confirmVariant, setConfirmVariant] = useState<"destructive" | "default">("destructive");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const confirmAction = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    fetchLatestCliVersion()
      .then((data) => setLatestCliVersion(data.version))
      .catch(() => {});
  }, []);

  // Clean up ?connect query param after initial open
  useEffect(() => {
    if (searchParams.has("connect")) {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  // Listen for registration + online events while the sheet is open.
  const sheetOpenRef = useRef(sheetOpen);
  useEffect(() => { sheetOpenRef.current = sheetOpen; }, [sheetOpen]);
  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  const registeredChhlatIdRef = useRef(registeredChhlatId);
  useEffect(() => { registeredChhlatIdRef.current = registeredChhlatId; }, [registeredChhlatId]);
  useEffect(() => {
    return subscribeWs((msg) => {
      if (!sheetOpenRef.current) return;
      if (msg.type === "runtime.registered" && msg.workspaceId === workspaceId) {
        setRegisteredChhlatId(msg.chhlatId);
      }
      if (
        msg.type === "runtime.status" &&
        msg.workspaceId === workspaceId &&
        msg.status === "online" &&
        registeredChhlatIdRef.current &&
        msg.chhlatId === registeredChhlatIdRef.current
      ) {
        trackRuntimeConnected({ runtime_type: "desktop" });
        setSheetOpen(false);
        setGeneratedToken("");
        setRegisteredChhlatId(null);
        setChhlatOnline(false);
        toast.success(RUNTIMES_LABELS.machineConnected);
        if (agentsRef.current.length === 0) {
          const slug = pathname.split("/")[2];
          router.push(`/w/${slug}/agents/new`);
        }
      }
    });
  }, [subscribeWs, workspaceId, pathname, router]);

  const openConfirm = (
    title: string,
    description: string,
    action: () => Promise<void>,
    opts?: { label?: string; loadingLabel?: string; variant?: "destructive" | "default" }
  ) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setConfirmLabel(opts?.label ?? RUNTIMES_LABELS.remove);
    setConfirmLoadingLabel(opts?.loadingLabel);
    setConfirmVariant(opts?.variant ?? "destructive");
    confirmAction.current = action;
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmAction.current) return;
    setConfirmLoading(true);
    try {
      await confirmAction.current();
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      confirmAction.current = null;
    }
  };

  const onGenerateToken = useCallback(async () => {
    setGeneratingToken(true);
    try {
      const token = await handleGenerateToken();
      if (token) setGeneratedToken(token);
    } finally {
      setGeneratingToken(false);
    }
  }, [handleGenerateToken]);

  const handleUpdate = async (runtimeId: string, chhlatId: string) => {
    setUpdatingChhlats((prev) => new Set(prev).add(chhlatId));
    try {
      await triggerRuntimeUpdate(runtimeId, workspaceId);
      toast.success(RUNTIMES_LABELS.updateTriggered);
    } catch {
      toast.error(RUNTIMES_LABELS.updateTriggerFailed);
      setUpdatingChhlats((prev) => {
        const next = new Set(prev);
        next.delete(chhlatId);
        return next;
      });
    }
  };

  const handleRescan = async (runtimeId: string, chhlatId: string) => {
    setRescanningChhlats((prev) => new Set(prev).add(chhlatId));
    try {
      await triggerRuntimeRescan(runtimeId, workspaceId);
      toast.success(RUNTIMES_LABELS.rescanTriggered);
    } catch {
      toast.error(RUNTIMES_LABELS.rescanTriggerFailed);
      setRescanningChhlats((prev) => {
        const next = new Set(prev);
        next.delete(chhlatId);
        return next;
      });
    }
  };

  // Derive effective optimistic sets: clear once server-side flag is gone AND runtime refreshed
  const effectiveUpdatingChhlats = useMemo(() => {
    if (updatingChhlats.size === 0) return updatingChhlats;
    const still = new Set<string>();
    for (const id of updatingChhlats) {
      const rt = runtimes.find((r) => (r.chhlat_id || r.id) === id);
      // Keep optimistic state until runtime data confirms update is done (flag cleared)
      if (!rt || rt.pending_update_version) {
        still.add(id);
      }
    }
    return still;
  }, [runtimes, updatingChhlats]);

  const effectiveRescanningChhlats = useMemo(() => {
    if (rescanningChhlats.size === 0) return rescanningChhlats;
    const still = new Set<string>();
    for (const rt of runtimes) {
      const key = rt.chhlat_id || rt.id;
      if (rescanningChhlats.has(key) && rt.pending_rescan) {
        still.add(key);
      }
    }
    return still;
  }, [runtimes, rescanningChhlats]);

  // Group runtimes by machine
  const machines = new Map<
    string,
    { deviceInfo: string; status: string; lastSeenAt: string | null; pendingUpdateVersion: string | null; pendingRescan: boolean; cliVersion: string | null; runtimes: Runtime[] }
  >();
  for (const rt of runtimes) {
    const key = rt.chhlat_id || rt.id;
    if (!machines.has(key)) {
      const meta = rt.metadata as Record<string, unknown> | null;
      machines.set(key, {
        deviceInfo: typeof rt.device_info === "string" ? rt.device_info : "",
        status: rt.status,
        lastSeenAt: rt.last_seen_at,
        pendingUpdateVersion: rt.pending_update_version ?? null,
        pendingRescan: !!rt.pending_rescan,
        cliVersion: (meta?.cli_version as string) ?? null,
        runtimes: [],
      });
    }
    machines.get(key)!.runtimes.push(rt);
  }

  if (loading) {
    return (
      <>
        {/* Skeleton title bar */}
        <div className="flex items-center justify-between border-b border-border/50 px-3 md:px-5 py-2.5">
          <div className="flex items-center gap-3">

            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-29 rounded-md" />
        </div>
        {/* Skeleton card grid */}
        <div className="flex-1 overflow-y-auto thin-scrollbar px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 md:px-5 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">{RUNTIMES_LABELS.heading}</h1>
          <p className="text-xs text-muted-foreground">
            {RUNTIMES_LABELS.subtitle}
          </p>
        </div>
        {!hideNewMachine && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setGeneratedToken("");
              setRegisteredChhlatId(null);
              setSheetOpen(true);
            }}
            disabled={generatingToken}
          >
            <Plus className="size-3.5" />
            {RUNTIMES_LABELS.newMachine}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-5 py-5">
        {runtimes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center animate-[fade-up_400ms_ease-out_both]">
              <p className="text-muted-foreground text-sm">
                {hideNewMachine
                  ? RUNTIMES_LABELS.noMachinesManaged
                  : isOwner
                    ? RUNTIMES_LABELS.connectToStart
                    : RUNTIMES_LABELS.connectToStartMember}
              </p>
              {!hideNewMachine && (
                <Button
                  size="sm"
                  className="mt-4 glow-border"
                  onClick={() => {
                    setGeneratedToken("");
                    setSheetOpen(true);
                  }}
                >
                  {RUNTIMES_LABELS.connectMachine}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(machines.entries()).map(([chhlatId, machine]) => {
              const displayName =
                machine.deviceInfo || chhlatId;
              return (
                <Card key={chhlatId} size="sm">
                  <CardHeader>
                    <div className="flex items-center gap-2 min-w-0">
                      <Monitor className="size-4 text-muted-foreground shrink-0" />
                      <CardTitle className="truncate">
                        {displayName}
                      </CardTitle>
                      {machine.cliVersion && (
                        <span className="text-xs text-muted-foreground/60 shrink-0">v{machine.cliVersion}</span>
                      )}
                      <Badge
                        variant={
                          machine.status === "online"
                            ? "default"
                            : "outline"
                        }
                        className="shrink-0"
                      >
                        {runtimeStatusLabel(machine.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {machine.lastSeenAt ? new Date(
                            machine.lastSeenAt
                          ).toLocaleString() : RUNTIMES_LABELS.neverSeen}
                        </span>
                        <div className="flex items-center gap-1">
                          {(() => {
                            const isUpdating = !!machine.pendingUpdateVersion || effectiveUpdatingChhlats.has(chhlatId);
                            const needsUpdate = machine.status === "online" && latestCliVersion && (!machine.cliVersion || !semverGte(machine.cliVersion, latestCliVersion));
                            if (isUpdating) {
                              return (
                                <Button variant="ghost" size="sm" disabled className="text-xs h-6 px-2">
                                  <Loader2 className="size-3 animate-spin mr-1" />
                                  {RUNTIMES_LABELS.updating}
                                </Button>
                              );
                            }
                            if (needsUpdate) {
                              return (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  onClick={() => openConfirm(
                                    RUNTIMES_LABELS.updateChhlatTitle,
                                    updateChhlatDescription(displayName),
                                    async () => { await handleUpdate(machine.runtimes[0].id, chhlatId); },
                                    { label: RUNTIMES_LABELS.update, loadingLabel: RUNTIMES_LABELS.updating, variant: "default" }
                                  )}
                                >
                                  {RUNTIMES_LABELS.update}
                                </Button>
                              );
                            }
                            return null;
                          })()}
                          {(() => {
                            const isRescanning = machine.pendingRescan || effectiveRescanningChhlats.has(chhlatId);
                            if (machine.status !== "online") return null;
                            if (isRescanning) {
                              return (
                                <Button variant="ghost" size="sm" disabled className="text-xs h-6 px-2">
                                  <RefreshCw className="size-3 animate-spin mr-1" />
                                  {RUNTIMES_LABELS.rescanning}
                                </Button>
                              );
                            }
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-6 px-2"
                                onClick={() => openConfirm(
                                  RUNTIMES_LABELS.rescanRuntimesTitle,
                                  rescanRuntimesDescription(displayName),
                                  async () => { await handleRescan(machine.runtimes[0].id, chhlatId); },
                                  { label: RUNTIMES_LABELS.rescan, loadingLabel: RUNTIMES_LABELS.triggering, variant: "default" }
                                )}
                              >
                                <RefreshCw className="size-3 mr-1" />
                                {RUNTIMES_LABELS.rescan}
                              </Button>
                            );
                          })()}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground h-6 px-2 hover:text-destructive"
                            onClick={() => {
                              openConfirm(
                                RUNTIMES_LABELS.removeMachineTitle,
                                removeMachineDescription(displayName),
                                async () => {
                                  await handleDeleteMachine(chhlatId);
                                }
                              );
                            }}
                          >
                            {RUNTIMES_LABELS.remove}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {machine.runtimes.map((runtime) => (
                          <Badge
                            key={runtime.id}
                            variant="secondary"
                            className="gap-1.5"
                          >
                            <ProviderLogo provider={runtime.provider} className="h-3.5 w-3.5" />
                            {runtime.provider}
                            {runtime.metadata?.version ? (
                              <span className="text-muted-foreground font-normal">
                                {String(runtime.metadata.version)}
                              </span>
                            ) : null}
                          </Badge>
                        ))}
                      </div>
                      {machine.status !== "online" && (
                        <div className="pt-1.5 border-t border-border/50">
                          <p className="text-[11px] text-muted-foreground mb-1.5">
                            {RUNTIMES_LABELS.bringOnline}
                          </p>
                          {mode === "desktop" && isTauri() ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-[11px]"
                              onClick={async () => {
                                try {
                                  await tauriInvoke("chhlat_start");
                                  toast.success(RUNTIMES_LABELS.chhlatStarted);
                                } catch {
                                  toast.error(RUNTIMES_LABELS.startChhlatFailed);
                                }
                              }}
                            >
                              {RUNTIMES_LABELS.startChhlat}
                            </Button>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <div
                                    className="relative overflow-hidden rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${cliCmd()} chhlat start`);
                                      toast.success(connectMachineLabel("copiedToClipboard"));
                                    }}
                                  />
                                }
                              >
                                <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-linear-to-r from-transparent via-(--shimmer-peak) to-transparent" />
                                <span className="relative">{cliCmd()} chhlat start</span>
                              </TooltipTrigger>
                              <TooltipContent>{connectMachineLabel("clickToCopy")}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect machine sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setGeneratedToken("");
          }
        }}
      >
        <SheetContent className="data-[side=right]:sm:inset-y-2 data-[side=right]:sm:right-2 data-[side=right]:sm:h-auto data-[side=right]:sm:rounded-xl data-[side=right]:sm:border">
          <SheetHeader>
            <SheetTitle>{RUNTIMES_LABELS.connectMachineSheetTitle}</SheetTitle>
            <SheetDescription>
              {isOwner
                ? RUNTIMES_LABELS.connectMachineSheetDescription
                : RUNTIMES_LABELS.connectMachineSheetDescriptionMember}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ConnectMachineSteps
              generatedToken={generatedToken}
              generatingToken={generatingToken}
              onGenerateToken={onGenerateToken}
              registered={!!registeredChhlatId}
              chhlatOnline={chhlatOnline}
              autoGenerate={isOwner}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        loadingLabel={confirmLoadingLabel}
        confirmVariant={confirmVariant}
        loading={confirmLoading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
