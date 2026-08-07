import type { Metadata } from "next";
import "@/components/studio/studio.css";

export const metadata: Metadata = {
  title: "Clauxen Studio",
  description: "AI creative studio for image and video generation",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
