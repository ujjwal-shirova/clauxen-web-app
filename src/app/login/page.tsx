import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/frontend/components/auth/login-page";

export const metadata: Metadata = {
  title: "Sign In - Clauxen",
};

function LoginFallback() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{ backgroundColor: "#faf9f5" }}
    >
      <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}
