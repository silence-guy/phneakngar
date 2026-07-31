"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  isNotificationSupported,
  getNotificationEnabled,
  setNotificationEnabled,
  getNotificationEvents,
  setNotificationEvents,
  requestNotificationPermission,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_LABELS,
  type NotificationEvent,
} from "@/lib/browser-notification";
import { getSettingsLabels } from "./settings-labels";
import { useSettingsLocale } from "@/contexts/settings-locale-context";

export function NotificationTab() {
  const { locale } = useSettingsLocale();
  const labels = useMemo(() => getSettingsLabels(locale), [locale]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifEvents, setNotifEvents] = useState<NotificationEvent[]>([...NOTIFICATION_EVENTS]);
  const [notifSupported, setNotifSupported] = useState(true);
  const [notifDenied, setNotifDenied] = useState(false);

  useEffect(() => {
    setNotifSupported(isNotificationSupported());
    setNotifEnabled(getNotificationEnabled());
    setNotifEvents(getNotificationEvents());
    if (isNotificationSupported()) {
      setNotifDenied(Notification.permission === "denied");
    }
  }, []);

  const handleToggleNotification = async (checked: boolean) => {
    if (!checked) {
      setNotifEnabled(false);
      setNotificationEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifEnabled(true);
      setNotificationEnabled(true);
    } else {
      setNotifDenied(true);
      toast.error(labels.notification.permissionDenied);
    }
  };

  const handleToggleEvent = (event: NotificationEvent) => {
    setNotifEvents((prev) => {
      const next = prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event];
      setNotificationEvents(next);
      return next;
    });
  };

  if (!notifSupported) {
    return (
      <p className="text-sm text-muted-foreground">
        {labels.notification.notSupported}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-medium">{labels.notification.sectionTitle}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm">{labels.notification.enable}</p>
              <p className="text-xs text-muted-foreground">
                {labels.notification.enableDescription}
              </p>
            </div>
            <Switch
              checked={notifEnabled}
              onCheckedChange={handleToggleNotification}
              disabled={notifDenied && !notifEnabled}
            />
          </div>
          {notifDenied && !notifEnabled && (
            <p className="text-xs text-destructive">
              {labels.notification.permissionDeniedHint}
            </p>
          )}
          {notifEnabled && (
            <div className="space-y-2 pl-0.5">
              <p className="text-xs text-muted-foreground">{labels.notification.notifyWhen}</p>
              {NOTIFICATION_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={notifEvents.includes(event)}
                    onCheckedChange={() => handleToggleEvent(event)}
                  />
                  {NOTIFICATION_EVENT_LABELS[event]}
                </label>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
