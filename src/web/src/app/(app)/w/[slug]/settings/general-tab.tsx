"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSession } from "@/lib/auth-client";
import {
  listMembers,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaces,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type WorkspaceFormErrors,
  hasWorkspaceFormErrors,
  validateWorkspaceForm,
} from "@/lib/form-validation";
import { trackSettingsUpdated } from "@/lib/analytics";
import {
  AgentLanguageMode,
  agentLanguageModeLabels,
  Locale,
  SUPPORTED_AGENT_LANGUAGE_MODES,
} from "@phneakngar/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettingsLabels, slugUrlHint } from "./settings-labels";
import { useSettingsLocale } from "@/contexts/settings-locale-context";

export function GeneralTab() {
  const { workspaceId, slug } = useWorkspace();
  const session = useSession();
  const router = useRouter();
  const { locale, setLocale } = useSettingsLocale();
  const labels = useMemo(() => getSettingsLabels(locale), [locale]);

  const [memberRole, setMemberRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [savedWorkspaceName, setSavedWorkspaceName] = useState("");
  const [savedWorkspaceSlug, setSavedWorkspaceSlug] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceErrors, setWorkspaceErrors] = useState<WorkspaceFormErrors>({});

  const [uiLocale, setUiLocale] = useState<Locale>(Locale.KM);
  const [savedUiLocale, setSavedUiLocale] = useState<Locale>(Locale.KM);
  const [agentLanguageMode, setAgentLanguageMode] = useState<string>("auto");
  const [savedAgentLanguageMode, setSavedAgentLanguageMode] = useState<string>("auto");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isOwner = memberRole === "owner";

  const isDirty = useMemo(() => {
    return (
      workspaceName !== savedWorkspaceName ||
      workspaceSlug !== savedWorkspaceSlug ||
      uiLocale !== savedUiLocale ||
      agentLanguageMode !== savedAgentLanguageMode
    );
  }, [workspaceName, workspaceSlug, savedWorkspaceName, savedWorkspaceSlug, uiLocale, savedUiLocale, agentLanguageMode, savedAgentLanguageMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const currentUserId = session.data?.user?.id;
      const [members, workspaces] = await Promise.all([
        listMembers(workspaceId),
        listWorkspaces(),
      ]);

      const me = members.find((m) => m.user_id === currentUserId);
      setMemberRole(me?.role ?? "");

      const ws = workspaces.find((w) => w.id === workspaceId);
      if (ws) {
        setWorkspaceName(ws.name);
        setWorkspaceSlug(ws.slug);
        setSavedWorkspaceName(ws.name);
        setSavedWorkspaceSlug(ws.slug);
        const resolvedLocale = ws.default_locale as Locale || Locale.KM;
        setUiLocale(resolvedLocale);
        setSavedUiLocale(resolvedLocale);
        const resolvedAgentLanguageMode = ws.agent_language_mode ?? "auto";
        setAgentLanguageMode(resolvedAgentLanguageMode);
        setSavedAgentLanguageMode(resolvedAgentLanguageMode);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.general.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, session.data?.user?.id, labels]);

  useEffect(() => {
    if (session.data) fetchData();
  }, [fetchData, session.data]);

  const handleSaveWorkspace = async () => {
    const nextErrors = validateWorkspaceForm({
      name: workspaceName,
      slug: workspaceSlug,
    });
    setWorkspaceErrors(nextErrors);
    if (hasWorkspaceFormErrors(nextErrors)) return;

    setSavingWorkspace(true);
    try {
      const updated = await updateWorkspace(workspaceId, {
        name: workspaceName.trim(),
        slug: workspaceSlug.trim(),
        default_locale: uiLocale,
        agent_language_mode: agentLanguageMode as AgentLanguageMode,
      });
      trackSettingsUpdated({ setting_tab: "general" });
      setSavedWorkspaceName(updated.name);
      setSavedWorkspaceSlug(updated.slug);
      setSavedUiLocale(uiLocale);
      setSavedAgentLanguageMode(agentLanguageMode);
      setLocale(uiLocale);
      toast.success(labels.general.updated);
      if (updated.slug !== slug) {
        router.replace(`/w/${updated.slug}/settings`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.general.failedToUpdate);
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== savedWorkspaceName) return;
    setDeleting(true);
    try {
      await deleteWorkspace(workspaceId, savedWorkspaceName);
      toast.success(labels.general.deleted);
      router.replace("/workspaces");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.general.failedToDelete);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <p className="text-sm text-muted-foreground">
        {labels.general.ownerOnly}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {/* Language Settings Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">{labels.language.sectionTitle}</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ui-locale">{labels.language.uiLocaleLabel}</Label>
            <p className="text-xs text-muted-foreground">{labels.language.uiLocaleDescription}</p>
            <Select value={uiLocale} onValueChange={(v) => v && setUiLocale(v as Locale)}>
              <SelectTrigger id="ui-locale" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Locale.EN}>English</SelectItem>
                <SelectItem value={Locale.KM}>Khmer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent-language">{labels.language.agentLanguageLabel}</Label>
            <p className="text-xs text-muted-foreground">{labels.language.agentLanguageDescription}</p>
            <Select value={agentLanguageMode} onValueChange={(v) => v && setAgentLanguageMode(v)}>
              <SelectTrigger id="agent-language" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_AGENT_LANGUAGE_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {agentLanguageModeLabels[mode][locale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Workspace Settings Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">{labels.general.sectionTitle}</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name">{labels.general.nameLabel}</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => {
                const nextName = e.target.value;
                setWorkspaceName(nextName);
                if (workspaceErrors.name && nextName.trim()) {
                  setWorkspaceErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              placeholder={labels.general.namePlaceholder}
              aria-invalid={Boolean(workspaceErrors.name)}
              aria-describedby={workspaceErrors.name ? "workspace-name-error" : undefined}
            />
            {workspaceErrors.name && (
              <p id="workspace-name-error" className="text-xs text-destructive">
                {workspaceErrors.name}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="workspace-slug">{labels.general.slugLabel}</Label>
            <Input
              id="workspace-slug"
              value={workspaceSlug}
              onChange={(e) => {
                const nextSlug = e.target.value;
                setWorkspaceSlug(nextSlug);
                if (workspaceErrors.slug && nextSlug.trim()) {
                  setWorkspaceErrors((prev) => ({ ...prev, slug: undefined }));
                }
              }}
              placeholder="workspace-slug"
              aria-invalid={Boolean(workspaceErrors.slug)}
              aria-describedby={workspaceErrors.slug ? "workspace-slug-error" : undefined}
            />
            {workspaceErrors.slug && (
              <p id="workspace-slug-error" className="text-xs text-destructive">
                {workspaceErrors.slug}
              </p>
            )}
            <p className="text-xs text-muted-foreground/70">
              {slugUrlHint(workspaceSlug, locale)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSaveWorkspace}
          disabled={!isDirty || savingWorkspace}
        >
          {savingWorkspace ? labels.general.saving : labels.general.save}
        </Button>
      </section>

      {/* Danger Zone Section */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-destructive">{labels.general.dangerZone}</h2>
        <div className="rounded-md border border-destructive/30 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {labels.general.deleteWarning}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm" className="text-xs">
              {labels.general.confirmPrefix}
              <span className="font-medium text-foreground">{savedWorkspaceName}</span>
              {labels.general.confirmSuffix}
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={savedWorkspaceName}
            />
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteConfirm !== savedWorkspaceName || deleting}
          >
            {deleting ? labels.general.deleting : labels.general.delete}
          </Button>
        </div>
      </section>
    </div>
  );
}
