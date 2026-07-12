import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apps · Clauxen",
};

export default function AppsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
