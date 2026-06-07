
"use client";

import React, { useState } from "react";
import { // shadcn/ui Dialog primitives — accessible modal overlay, focus trap, backdrop
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import { useAuth } from "@/frontend/hooks/use-auth";
import { isOryAuthEnabled, startOryLogin } from "@/frontend/lib/api/auth";
import { ApiError } from "@/frontend/lib/api/client"; // typed API errors — generic fallback for non-ApiError/5xx paths

function authErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return "Authentication failed.";
    return err.message;
  }
  return "Authentication failed.";
}

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const oryEnabled = isOryAuthEnabled();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password); // useAuth login — backend session cookie set
      } else { // new user path — register account create
        await register({ email, password, displayName: displayName || undefined });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed."); // Error instance message; otherwise generic fallback
    } finally {
      setSubmitting(false); // success/fail — loading state reset; button re-enable
    }
  };

  return ( // JSX tree — controlled Dialog + credential form
    <Dialog open={open} onOpenChange={onOpenChange}> {/* root Dialog — open prop parent-controlled */}
      <DialogContent className="sm:max-w-md bg-white border-zinc-200"> {/* warm off-white panel — subtle border, sm breakpoint max-width */}
        <DialogHeader> {/* title section wrapper */}
          <DialogTitle className="font-serif text-zinc-800"> 
            {mode === "login" ? "Sign in to Clauxen" : "Create your account"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3"> {/* vertical form — onSubmit handleSubmit bind */}
          {mode === "register" && ( // register mode only — display name text input conditional render
            <input
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)} // email field — HTML5 required validation
            className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)} // password field — HTML5 required validation
            className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>} 
          {oryEnabled && mode === "login" && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => startOryLogin()} // external OAuth redirect — credential form bypass
              className="border-zinc-300 text-zinc-700"
            >
              Sign in with Ory
            </Button>
          )}
          <Button type="submit" disabled={submitting} className={cn(appBtn.primary, "w-full")}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} {/* loading vs mode-specific label */}
          </Button>
          <button
            type="button"
            className="text-sm text-zinc-500 hover:text-zinc-800"
            onClick={() => setMode(mode === "login" ? "register" : "login")} // mode toggle — login ↔ register switch
          >
            {mode === "login"
              ? "Need an account? Register"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
