import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scheduled Tasks - Clauxen",
};

export default function ScheduledTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
