import { NextRequest } from "next/server";
import { z } from "zod";
import {
  registerUser,
  signAuthToken,
  ProjectsAuthError,
} from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Validation failed.", 400);
    }

    const user = await registerUser(parsed.data);
    const token = signAuthToken(user);
    return jsonData({ user, token }, 201);
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    if (error instanceof Error && error.message.includes("already registered")) {
      return jsonError(error.message, 400);
    }
    console.error("[auth/register]", error);
    return jsonError("Internal server error.", 500);
  }
}
