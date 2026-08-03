"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/hooks/use-app-notifications";

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M8.708 3.708a1.5 1.5 0 0 1 2.466-.173l.118.173 6.5 11.03A1.5 1.5 0 0 1 16.5 17h-13a1.5 1.5 0 0 1-1.292-2.262zm1.684.45a.5.5 0 0 0-.823.058l-6.5 11.03A.5.5 0 0 0 3.5 16h13a.5.5 0 0 0 .43-.754l-6.5-11.03zM10 13a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5m0-5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 10 8" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M10 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15m0 1a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13m.1 5.51a.5.5 0 0 1 .4.49v3h1a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1h1V10h-1a.5.5 0 0 1 0-1H10zM10 6.5A.75.75 0 1 1 10 8a.75.75 0 0 1 0-1.5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path d="M15.147 4.146a.5.5 0 0 1 .707.707L10.707 10l5.147 5.147a.5.5 0 0 1-.63.771l-.078-.064L10 10.707l-5.146 5.147a.5.5 0 0 1-.708-.707L9.293 10 4.146 4.853a.5.5 0 0 1 .708-.707L10 9.293z" />
    </svg>
  );
}

type AppNotificationItemProps = {
  notification: AppNotification;
  exiting: boolean;
  onDismiss: (id: string) => void;
};

export function AppNotificationItem({
  notification,
  exiting,
  onDismiss,
}: AppNotificationItemProps) {
  const isWarning = notification.variant === "warning";

  return (
    <li
      role="status"
      aria-live={isWarning ? "assertive" : "polite"}
      tabIndex={0}
      className={cn(
        "pointer-events-auto flex w-full max-w-[512px] justify-end outline-none",
        exiting ? "app-notification-exit" : "app-notification-enter",
      )}
    >
      <div
        className={cn(
          "w-full max-w-[512px] overflow-hidden rounded-xl border-[0.5px] p-2 text-[14px] leading-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]",
          isWarning
            ? "border-[#a86b00] bg-[#f9dda4] text-[#754600]"
            : "border-[rgba(31,31,30,0.4)] bg-white text-[#121212]",
        )}
      >
        <div className="ml-1 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="flex h-6 shrink-0 items-center">
              {isWarning ? (
                <WarningIcon
                  className="h-5 w-5 shrink-0 text-[#754600]"
                  aria-label="Warning"
                />
              ) : (
                <InfoIcon
                  className="h-5 w-5 shrink-0 text-[#121212]"
                  aria-label="Info"
                />
              )}
            </div>
            <p
              className={cn(
                "mt-0.5 min-w-0 flex-1 break-words text-[14px] leading-5",
                isWarning ? "text-[#754600]" : "text-[#121212]",
              )}
            >
              {notification.message}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onDismiss(notification.id)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent transition-colors",
              isWarning
                ? "text-[#754600] hover:bg-[#754600]/10"
                : "text-zinc-700 hover:bg-black/[0.04]",
            )}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
