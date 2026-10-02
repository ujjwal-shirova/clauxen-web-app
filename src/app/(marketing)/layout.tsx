import type { ReactNode } from "react";

export const metadata = {
  title: "Clauxen",
  description: "Chat, work, and code with Clauxen.",
};

/**
 * Shared shell for all public marketing routes.
 * Header/footer navigation gets built out here as the pages land.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[var(--app-shell-bg)]">{children}</div>
  );
}
