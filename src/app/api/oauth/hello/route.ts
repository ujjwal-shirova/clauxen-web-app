import { NextResponse } from "next/server";

/** Alternate OAuth connectivity probe. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "clauxen-oauth" });
}
