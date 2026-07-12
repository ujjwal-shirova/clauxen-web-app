"use client";

import { useEffect } from "react";

/** Root catch-all: silent hard navigation home — never paint an error page. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] silent recover:", error?.message, error?.digest);
    const t = window.setTimeout(() => {
      window.location.replace("/");
    }, 80);
    return () => window.clearTimeout(t);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff", minHeight: "100dvh" }} />
    </html>
  );
}
