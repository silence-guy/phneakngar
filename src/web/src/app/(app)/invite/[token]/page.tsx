"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getInviteInfo, acceptInvite, type InviteInfo } from "@/lib/api";
import { trackInviteAccepted } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  INVITE_LABELS,
  invitedByLabel,
  joinedWorkspaceAccessNote,
  joinedWorkspaceLabel,
} from "./invite-labels";

type State = "loading" | "ready" | "error" | "accepting" | "done";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [state, setState] = useState<State>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    getInviteInfo(token)
      .then((data) => {
        setInfo(data);
        setState("ready");
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : INVITE_LABELS.errors.invalidOrExpired);
        setState("error");
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setState("accepting");
    try {
      const result = await acceptInvite(token);
      trackInviteAccepted({ workspace_id: result.workspace_id ?? "" });
      setState("done");
      toast.success(joinedWorkspaceLabel(info?.workspace_name ?? INVITE_LABELS.fallbackWorkspace), {
        description: joinedWorkspaceAccessNote(),
      });
      router.replace(`/w/${result.workspace_slug}/home`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : INVITE_LABELS.errors.joinFailed);
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        {state === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-9 w-32 mx-auto" />
          </div>
        )}

        {state === "ready" && info && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{INVITE_LABELS.invited}</h1>
              <p className="text-sm text-muted-foreground">
                {invitedByLabel(info.invited_by)}
              </p>
            </div>

            <div className="rounded-md border border-border/50 px-4 py-3 text-left space-y-0.5">
              <p className="text-sm font-medium">{info.workspace_name}</p>
              <p className="text-xs text-muted-foreground">{INVITE_LABELS.workspace}</p>
            </div>

            <Button className="w-full" onClick={handleAccept}>
              {INVITE_LABELS.joinWorkspace}
            </Button>
          </>
        )}

        {state === "accepting" && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <p className="text-sm text-muted-foreground">{INVITE_LABELS.joiningWorkspace}</p>
          </div>
        )}

        {state === "error" && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{INVITE_LABELS.inviteUnavailable}</h1>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={() => router.replace("/workspaces")}>
              {INVITE_LABELS.goToWorkspaces}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
