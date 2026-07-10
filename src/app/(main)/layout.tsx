import { MainLayout } from "@/frontend/components/main-layout";
import "streamdown/styles.css";

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
