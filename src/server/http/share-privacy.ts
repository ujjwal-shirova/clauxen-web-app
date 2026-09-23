import { NextResponse } from "next/server";
import { SHARE_ROBOTS_TAG } from "@/lib/share-public";

export function applySharePrivacyHeaders(response: NextResponse) {
  response.headers.set("X-Robots-Tag", SHARE_ROBOTS_TAG);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
