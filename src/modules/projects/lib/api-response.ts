import { NextResponse } from "next/server";
import { ProjectsApiError, ProjectsAuthError } from "@/projects/lib/auth";

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ data: null, error: message }, { status });
}

export async function withProjectsHandler(
  handler: (request: Request) => Promise<Response>,
): Promise<(request: Request) => Promise<Response>> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof ProjectsAuthError || error instanceof ProjectsApiError) {
        return jsonError(error.message, error.status);
      }
      console.error("[projects-api]", error);
      return jsonError(
        error instanceof Error ? error.message : "Internal server error",
        500,
      );
    }
  };
}
