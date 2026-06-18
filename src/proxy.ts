import { type NextRequest, NextResponse } from "next/server";
import { isOryConfigured } from "@/backend/config/env";
import { updateOrySession } from "@/utils/ory/middleware";
import { updateSession } from "@/utils/supabase/middleware";
import { getSupabasePublicConfig } from "@/utils/supabase/env";

export async function proxy(request: NextRequest) {
  if (isOryConfigured()) {
    try {
      return await updateOrySession(request);
    } catch {
      return NextResponse.next({ request });
    }
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
