import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyPhonePage } from "@/components/auth/verify-phone-page";
import { AuthLoadingShell } from "@/components/auth/auth-shared";

export const metadata: Metadata = {
  title: "Verify your phone - Clauxen",
};

export default function Page() {
  return (
    <Suspense fallback={<AuthLoadingShell />}>
      <VerifyPhonePage />
    </Suspense>
  );
}
