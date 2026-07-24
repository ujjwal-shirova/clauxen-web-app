import { MainLayout } from "@/components/main-layout";
import { StreamdownStyles } from "@/components/streamdown-styles";

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
