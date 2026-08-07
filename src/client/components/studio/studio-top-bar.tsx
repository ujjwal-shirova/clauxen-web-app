"use client";

import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatarDisplay } from "@/components/settings/profile-avatar-upload";
import { useAuth } from "@/hooks/use-auth";

type StudioTopBarProps = {
  projectName: string;
};

export function StudioTopBar({ projectName }: StudioTopBarProps) {
  const { user } = useAuth();
  const displayName =
    user?.preferredName || user?.displayName || user?.email || "You";

  return (
    <header className="studio-topbar flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-[#c4a574]/15 text-[#e8d4b0]">
            <Clapperboard className="size-3.5" strokeWidth={1.75} />
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-[#f2ebe0]">
            Clauxen Studio
          </span>
        </div>
        <span className="hidden h-3.5 w-px bg-white/10 sm:block" aria-hidden />
        <span className="hidden truncate text-[12px] text-white/45 sm:inline">
          {projectName}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {user ? (
          <>
            <span className="hidden max-w-[140px] truncate text-[12px] text-white/50 sm:inline">
              {displayName}
            </span>
            <UserAvatarDisplay
              name={displayName}
              avatarUrl={user.avatarUrl}
              size="sm"
              className="bg-white/10 text-[#e8d4b0]"
            />
          </>
        ) : (
          <div
            className={cn(
              "h-8 w-8 animate-pulse rounded-full bg-white/10",
            )}
            aria-hidden
          />
        )}
      </div>
    </header>
  );
}
