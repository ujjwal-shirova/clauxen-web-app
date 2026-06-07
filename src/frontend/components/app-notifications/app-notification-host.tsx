"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AppNotificationItem } from "@/frontend/components/app-notifications/app-notification-item";
import { useAppNotifications } from "@/frontend/hooks/use-app-notifications";

export function AppNotificationHost() {
  const { notifications, exitingIds, dismiss } = useAppNotifications();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || notifications.length === 0) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min(512px,calc(100vw-2rem))] flex-col items-end gap-2"
      aria-label="Notifications"
    >
      <ol className="m-0 flex w-full list-none flex-col items-end gap-2 p-0">
        {notifications.map((notification) => (
          <AppNotificationItem
            key={notification.id}
            notification={notification}
            exiting={exitingIds.has(notification.id)}
            onDismiss={dismiss}
          />
        ))}
      </ol>
    </div>,
    document.body,
  );
}
