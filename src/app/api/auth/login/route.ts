import { z } from "zod";
import {
  authenticateUser,
  signAuthToken,
  ProjectsAuthError,
} from "@/projects/lib/auth";
import { jsonData, jsonError } from "@/projects/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Validation failed.", 400);
    }

    const user = await authenticateUser(parsed.data);
    if (!user) {
      return jsonError("Invalid email or password.", 401);
    }

    const token = signAuthToken(user);
    return jsonData({ user, token });
  } catch (error) {
    if (error instanceof ProjectsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("[auth/login]", error);
    return jsonError("Internal server error.", 500);
  }
}
