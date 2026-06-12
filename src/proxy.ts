import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/backend/config/env";
import { updateOrySession } from "@/utils/ory/middleware";
import { updateSession } from "@/utils/supabase/middleware";
import { getSupabasePublicConfig } from "@/utils/supabase/env";

export async function proxy(request: NextRequest) {
  if (env.oryKratosPublicUrl) {
    return updateOrySession(request);
  }

  const supabase = getSupabasePublicConfig();
  if (supabase.url && supabase.publishableKey) {
    return updateSession(request);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
