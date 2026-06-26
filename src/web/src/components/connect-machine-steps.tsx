"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Check, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { connectMachineLabel } from "@/lib/locale";
import { cliCmd, getAppMode } from "@/lib/utils";
import { isTauri, tauriInvoke } from "@phneakngar/shared";

export function ConnectMachineSteps({
  generatedToken,
  generatingToken,
  onGenerateToken,
  registered,
  daemonOnline,
}: {
  generatedToken: string;
  generatingToken: boolean;
  onGenerateToken: () => void;
  registered: boolean;
  daemonOnline: boolean;
}) {
  const hasTriggered = useRef(false);
  const mode = getAppMode();
  const isDesktopApp = mode === "desktop";
  const [executing, setExecuting] = useState(false);
  const [cliPrefix, setCliPrefix] = useState<string | null>(null);

  const connected = registered && daemonOnline;

  useEffect(() => {
    if (isDesktopApp && isTauri()) {
      tauriInvoke<{ command: string; is_dev: boolean }>("get_cli_info")
        .then((info) => setCliPrefix(info.command))
        .catch(() => {});
    }
  }, [isDesktopApp]);

  useEffect(() => {
    if (!generatedToken && !generatingToken && !hasTriggered.current) {
      hasTriggered.current = true;
      onGenerateToken();
    }
  }, [generatedToken, generatingToken, onGenerateToken]);

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
        </div>
      ) : null}
    </div>
  );
}
