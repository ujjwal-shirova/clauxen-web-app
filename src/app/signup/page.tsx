import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupPage } from "@/frontend/components/auth/signup-page";

export const metadata: Metadata = {
  title: "Sign Up - Clauxen",
};

function SignupFallback() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ backgroundColor: "#faf9f5" }}
    >
      <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
    </div>
  );
}

export default function SignupRoute() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupPage />
    </Suspense>
  );
}
