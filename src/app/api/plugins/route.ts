import { NextRequest, NextResponse } from "next/server";
import { getPluginDirectory } from "@/server/plugins/catalog";

export const dynamic = "force-dynamic";

function readNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const result = await getPluginDirectory({
    category: searchParams.get("category"),
    query: searchParams.get("q"),
    page: readNumber(searchParams.get("page"), 1),
    pageSize: readNumber(searchParams.get("pageSize"), 48),
    overview: searchParams.get("overview") === "1",
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
