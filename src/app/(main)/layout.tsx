import { MainLayout } from "@/frontend/components/main-layout";

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
