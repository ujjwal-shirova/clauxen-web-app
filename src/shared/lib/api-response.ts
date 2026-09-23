import { NextResponse } from "next/server";

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ data: null, error: message }, { status });
}
