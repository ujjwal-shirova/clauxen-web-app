import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query, queryOne } from "@/server/db/pool";
import { env } from "@/server/config/env";
import { ensureUserRecord } from "@/server/services/identity.service";

const SALT_ROUNDS = 12;

export type AuthUser = {
  id: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: "7d",
  });
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as {
      sub: string;
      email: string;
    };
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string) {
  return queryOne<{ id: string; email: string; password_hash: string | null }>(
    `select id, email, password_hash from auth.users where lower(email) = lower($1)`,
    [email],
  );
}

export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("Email already registered.");
  }

  const passwordHash = await hashPassword(input.password);
  const row = await queryOne<{ id: string; email: string }>(
    `insert into auth.users (email, password_hash)
     values ($1, $2)
     returning id, email`,
    [email, passwordHash],
  );
  if (!row) throw new Error("Failed to create user.");

  await ensureUserRecord({
    userId: row.id,
    email: row.email,
    displayName: email.split("@")[0],
  });

  return { id: row.id, email: row.email };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<AuthUser | null> {
  const row = await findUserByEmail(input.email);
  if (!row?.password_hash) return null;
  const ok = await verifyPassword(input.password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, email: row.email! };
}

export async function getUserById(userId: string) {
  return queryOne<{ id: string; email: string }>(
    `select id, email from auth.users where id = $1`,
    [userId],
  );
}
