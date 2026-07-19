"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Check, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectMachineLabel } from "@/lib/locale";
import { cliCmd, getAppMode } from "@/lib/utils";
import { isTauri, tauriInvoke } from "@phneakngar/shared";

function ConnectMachineNextSteps({ isDesktopApp }: { isDesktopApp: boolean }) {
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-foreground/80">
        {connectMachineLabel("nextStepsTitle")}
      </p>
      <ol className="list-decimal list-outside ml-4 space-y-1 text-xs text-muted-foreground">
        <li>
          {isDesktopApp
            ? connectMachineLabel("nextStepRegisterDesktop")
            : connectMachineLabel("nextStepRegisterTerminal")}
        </li>
        <li>{connectMachineLabel("nextStepChhlat")}</li>
        <li>{connectMachineLabel("nextStepWait")}</li>
        <li>{connectMachineLabel("nextStepWebBrain")}</li>
      </ol>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {connectMachineLabel("agentWorkdirNote")}
      </p>
    </div>
  );
}

export function ConnectMachineSteps({
  generatedToken,
  generatingToken,
  onGenerateToken,
  registered,
  chhlatOnline,
  autoGenerate = true,
}: {
  generatedToken: string;
  generatingToken: boolean;
  onGenerateToken: () => void;
  registered: boolean;
  chhlatOnline: boolean;
  /** When false, wait for an explicit user click before minting a machine token. */
  autoGenerate?: boolean;
}) {
  const hasTriggered = useRef(false);
  const mode = getAppMode();
  const isDesktopApp = mode === "desktop";
  const [executing, setExecuting] = useState(false);
  const [cliPrefix, setCliPrefix] = useState<string | null>(null);

  const connected = registered && chhlatOnline;

  useEffect(() => {
    if (isDesktopApp && isTauri()) {
      tauriInvoke<{ command: string; is_dev: boolean }>("get_cli_info")
        .then((info) => setCliPrefix(info.command))
        .catch(() => {});
    }
  }, [isDesktopApp]);

  useEffect(() => {
    if (!autoGenerate) return;
    if (!generatedToken && !generatingToken && !hasTriggered.current) {
      hasTriggered.current = true;
      onGenerateToken();
    }
  }, [autoGenerate, generatedToken, generatingToken, onGenerateToken]);

  const command = `${cliCmd()} register --token ${generatedToken}`;

  const copyRegister = () => {
    navigator.clipboard.writeText(command);
    toast.success(connectMachineLabel("copiedToClipboard"));
  };

  const executeRegister = async () => {
    if (!isTauri()) return;
    setExecuting(true);
    try {
      const result = await tauriInvoke<{ success: boolean; message: string }>("register_cli", { token: generatedToken });
      if (result.success) {
        toast.success(connectMachineLabel("registeredSuccessfully"));
      } else {
        toast.error(result.message || connectMachineLabel("registrationFailed"));
      }
    } catch {
      toast.error(connectMachineLabel("failedToExecuteRegistration"));
    } finally {
      setExecuting(false);
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <Check className="size-4" />
        {connectMachineLabel("computerConnected")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{connectMachineLabel("connectComputer")}</p>
      <p className="text-xs text-muted-foreground">
        {isDesktopApp
          ? connectMachineLabel("desktopDescription")
          : connectMachineLabel("terminalDescription")}
      </p>
      {generatingToken ? (
        <div className="rounded-md bg-muted p-2.5 font-mono text-xs text-muted-foreground animate-pulse">
          {connectMachineLabel("generatingToken")}
        </div>
      ) : generatedToken ? (
        <div className="space-y-2">
          {isDesktopApp ? (
            <Button
              size="sm"
              onClick={executeRegister}
              disabled={executing}
              className="w-full"
              title={cliPrefix ? `${cliPrefix} register --token <token>` : undefined}
            >
              {executing ? (
                <><Loader2 className="size-3 animate-spin mr-1" /> {connectMachineLabel("registering")}</>
              ) : (
                <><Play className="size-3 mr-1" /> {connectMachineLabel("register")}</>
              )}
            </Button>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      className="rounded-md bg-muted p-2.5 font-mono text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors break-all"
                      onClick={copyRegister}
                    />
                  }
                >
                  {command}
                </TooltipTrigger>
                <TooltipContent>{connectMachineLabel("clickToCopy")}</TooltipContent>
              </Tooltip>
              <Button size="sm" onClick={copyRegister} className="w-full">
                {connectMachineLabel("copyCommand")}
              </Button>
            </>
          )}
          <ConnectMachineNextSteps isDesktopApp={isDesktopApp} />
        </div>
      ) : !autoGenerate ? (
        <Button size="sm" onClick={onGenerateToken} className="w-full" variant="outline">
          {connectMachineLabel("generateRegisterCommand")}
        </Button>
      ) : null}
    </div>
  );
}
