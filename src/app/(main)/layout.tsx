import { MainLayout } from "@/frontend/components/main-layout";
import { StreamdownStyles } from "@/frontend/components/streamdown-styles";

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StreamdownStyles />
      <MainLayout>{children}</MainLayout>
    </>
  );
}
