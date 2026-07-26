import { NextResponse } from "next/server";

/** Connectivity probe used by Clauxen Code CLI preflight. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "clauxen" });
}
