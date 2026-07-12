import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat · Clauxen",
};

export default function ChatIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
