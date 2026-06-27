"use client";


import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  EMAIL_SETUP_LABELS,
  EMAIL_SETUP_PROVIDER_COPY,
  type EmailSetupProviderId,
} from "./email-setup-labels";

const PROVIDERS = [
  {
    id: "gmail",
    name: "Gmail",
    imap: { host: "imap.gmail.com", port: 993 },
    smtp: { host: "smtp.gmail.com", port: 587 },
  },
  {
    id: "outlook",
    name: "Outlook",
    imap: { host: "outlook.office365.com", port: 993 },
    smtp: { host: "smtp.office365.com", port: 587 },
  },
  {
    id: "yahoo",
    name: "Yahoo",
    imap: { host: "imap.mail.yahoo.com", port: 993 },
    smtp: { host: "smtp.mail.yahoo.com", port: 587 },
  },
  {
    id: "icloud",
    name: "iCloud",
    imap: { host: "imap.mail.me.com", port: 993 },
    smtp: { host: "smtp.mail.me.com", port: 587 },
  },
  {
    id: "qq",
    name: "QQ",
    imap: { host: "imap.qq.com", port: 993 },
    smtp: { host: "smtp.qq.com", port: 587 },
  },
  {
    id: "163",
    name: "163",
    imap: { host: "imap.163.com", port: 993 },
    smtp: { host: "smtp.163.com", port: 465 },
  },
  {
    id: "feishu",
    name: "Feishu",
    imap: { host: "imap.feishu.cn", port: 993 },
    smtp: { host: "smtp.feishu.cn", port: 465 },
  },
  {
    id: "other",
    name: "Other",
    imap: null,
    smtp: null,
  },
] as const;

export default function EmailSetupHelpPage() {
  return (
    <>
      <div className="flex items-center justify-between border-b border-border/50 px-3 md:px-5 py-2.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium">{EMAIL_SETUP_LABELS.heading}</h1>
          <p className="text-xs text-muted-foreground hidden md:block">
            {EMAIL_SETUP_LABELS.subtitle}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-5 py-6">
        <div className="mx-auto max-w-2xl">
          <Tabs defaultValue="gmail">
            <TabsList className="flex-wrap h-auto gap-1">
              {PROVIDERS.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {PROVIDERS.map((provider) => {
              const copy = EMAIL_SETUP_PROVIDER_COPY[provider.id as EmailSetupProviderId];
              return (
              <TabsContent key={provider.id} value={provider.id} className="space-y-4 pt-4">
                {provider.imap && provider.smtp && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md border border-border/50 px-3 py-2 space-y-0.5">
                      <span className="font-medium text-muted-foreground">{EMAIL_SETUP_LABELS.imap}</span>
                      <div className="font-mono">{provider.imap.host}:{provider.imap.port}</div>
                    </div>
                    <div className="rounded-md border border-border/50 px-3 py-2 space-y-0.5">
                      <span className="font-medium text-muted-foreground">{EMAIL_SETUP_LABELS.smtp}</span>
                      <div className="font-mono">{provider.smtp.host}:{provider.smtp.port}</div>
                    </div>
                  </div>
                )}

                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  {copy.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>

                {copy.note && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md bg-amber-500/5 border border-amber-500/10 px-3 py-2">
                    {copy.note}
                  </p>
                )}
              </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </>
  );
}
