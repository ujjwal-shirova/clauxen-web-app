import { NextResponse } from "next/server";

/** OAuth connectivity probe used by Clauxen Code CLI preflight. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "clauxen-oauth" });
}
