import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects - Clauxen",
};

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
