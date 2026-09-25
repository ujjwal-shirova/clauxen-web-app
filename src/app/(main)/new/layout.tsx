import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clauxen",
};

export default function NewChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
