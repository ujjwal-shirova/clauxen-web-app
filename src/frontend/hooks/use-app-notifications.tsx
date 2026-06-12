"use client";

import * as React from "react";

export type AppNotificationVariant = "info" | "warning";

export type AppNotification = {
  id: string;
  message: string;
  variant: AppNotificationVariant;
};

type NotifyOptions = {
  message: string;
  variant?: AppNotificationVariant;
  /** Auto-dismiss after ms. Warnings never auto-dismiss unless explicitly set. */
  duration?: number | null;
};

const INFO_AUTO_DISMISS_MS = 5000;
const EXIT_ANIMATION_MS = 200;

type AppNotificationsContextValue = {
  notifications: AppNotification[];
  exitingIds: Set<string>;
  notify: (options: NotifyOptions) => string;
  notifyInfo: (message: string, duration?: number | null) => string;
  notifyWarning: (message: string) => string;
  dismiss: (id: string) => void;
};

const AppNotificationsContext =
  React.createContext<AppNotificationsContextValue | null>(null);

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `app-notification-${idCounter}-${Date.now()}`;
}

export function AppNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = React.useState<AppNotification[]>(
    [],
  );
  const [exitingIds, setExitingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = React.useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }

    setExitingIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const removeTimer = setTimeout(() => {
      setNotifications((items) => items.filter((n) => n.id !== id));
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      timersRef.current.delete(`remove-${id}`);
    }, EXIT_ANIMATION_MS);

    timersRef.current.set(`remove-${id}`, removeTimer);
  }, []);

  const notify = React.useCallback(
    (options: NotifyOptions) => {
      const variant = options.variant ?? "info";
      const id = nextId();
      const entry: AppNotification = {
        id,
        message: options.message,
        variant,
      };

      setNotifications((items) => [...items, entry]);

      const duration =
        variant === "warning"
          ? (options.duration ?? null)
          : (options.duration ?? INFO_AUTO_DISMISS_MS);

      if (duration != null && duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const notifyInfo = React.useCallback(
    (message: string, duration?: number | null) =>
      notify({ message, variant: "info", duration }),
    [notify],
  );

  const notifyWarning = React.useCallback(
    (message: string) =>
      notify({ message, variant: "warning", duration: null }),
    [notify],
  );

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({
      notifications,
      exitingIds,
      notify,
      notifyInfo,
      notifyWarning,
      dismiss,
    }),
    [notifications, exitingIds, notify, notifyInfo, notifyWarning, dismiss],
  );

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}
    </AppNotificationsContext.Provider>
  );
}

export function useAppNotifications() {
  const ctx = React.useContext(AppNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useAppNotifications must be used within AppNotificationsProvider",
    );
  }
  return ctx;
}
