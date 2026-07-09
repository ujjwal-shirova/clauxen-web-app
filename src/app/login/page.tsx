import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/frontend/components/auth/login-page";
import { AuthLoadingShell } from "@/frontend/components/auth/auth-shared";

export const metadata: Metadata = {
  title: "Sign In - Clauxen",
};

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingShell />}>
      <LoginPage />
    </Suspense>
  );
}
