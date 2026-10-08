import type { ReactNode } from "react";
import styles from "./marketing.module.css";

export const metadata = {
  title: "Clauxen",
  description: "Chat, work, and code with Clauxen.",
};

/**
 * Shared shell for all public marketing routes.
 * Header/footer navigation gets built out here as the pages land.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
