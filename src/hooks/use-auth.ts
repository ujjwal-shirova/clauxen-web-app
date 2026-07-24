"use client";

/**
 * Auth hook — thin re-export of the shared AuthProvider context.
 * All consumers share one session (fixes Guest flicker from parallel useAuth state).
 */
export { AuthProvider, useAuth } from "@/contexts/auth-context";
