import { NextResponse } from "next/server";
import { AppError } from "@/backend/db/errors";

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonError(error: AppError | Error, status?: number) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code } },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: { message: error.message || "Internal server error.", code: "internal_error" } },
    { status: status ?? 500 },
  );
}
