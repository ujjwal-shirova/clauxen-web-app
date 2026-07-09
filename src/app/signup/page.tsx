import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupPage } from "@/frontend/components/auth/signup-page";
import { AuthLoadingShell } from "@/frontend/components/auth/auth-shared";

export const metadata: Metadata = {
  title: "Sign Up - Clauxen",
};

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingShell />}>
      <SignupPage />
    </Suspense>
  );
}
