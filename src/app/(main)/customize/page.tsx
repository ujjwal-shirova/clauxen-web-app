"use client";

import { useEffect } from "react";
import { APP_ROUTES, buildOverlayLocation } from "@/lib/app-routes";

const TARGET = buildOverlayLocation(
  { type: "settings", tab: "Skills" },
  APP_ROUTES.newChat,
);

/** Legacy /customize* → /new#settings/Skills */
export default function CustomizeRedirectPage() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <div className="grid h-full place-items-center text-[13px] text-zinc-500">
      Opening settings…
    </div>
  );
}
