"use client"; // client — toast state from useToast hook

import { useToast } from "@/hooks/use-toast"; // global toast queue hook
import {
  Toast, // single toast root
  ToastClose, // dismiss button
  ToastDescription, // body text
  ToastProvider, // Radix toast provider
  ToastTitle, // title line
  ToastViewport, // fixed position toast stack container
} from "@/components/ui/toast";

// Toaster — app-level toast renderer; mount once near root layout
export function Toaster() {
  const { toasts } = useToast(); // subscribe to toast queue state

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            {" "}
            {/* each toast instance — spread variant/duration props */}
            <div className="grid gap-1">
              {" "}
              {/* title + description vertical stack */}
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action} {/* optional action button slot */}
            <ToastClose /> {/* X close control */}
          </Toast>
        );
      })}
      <ToastViewport /> {/* portal target — bottom-right on desktop */}
    </ToastProvider>
  );
}
