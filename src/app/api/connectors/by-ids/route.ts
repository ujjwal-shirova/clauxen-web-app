import { NextRequest, NextResponse } from "next/server";
import { getConnectorsByIds } from "@/connectors/server/directory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") || "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);
  const plugins = await getConnectorsByIds(ids);
  return NextResponse.json(
    { plugins },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
