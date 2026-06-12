import { NextResponse } from "next/server";
import { AppError } from "@/backend/db/errors";
export function jsonData(data, status = 200) {
  return NextResponse.json({ data }, { status }); // envelope: { data: T } — consistent contract
}
export function jsonError(error, status) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { message: "Internal server error.", code: "internal_error" } },
    { status: status ?? 500 },
  );
}
