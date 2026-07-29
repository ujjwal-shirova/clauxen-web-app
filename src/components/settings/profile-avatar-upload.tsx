"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/profile-names";
import * as profileApi from "@/lib/api/profile";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type AvatarSize = "sm" | "md";

function avatarSizeClass(size: AvatarSize) {
  return size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]";
}

type UserAvatarDisplayProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  size?: AvatarSize;
};

export function UserAvatarDisplay({
  name,
  avatarUrl,
  className,
  size = "md",
}: UserAvatarDisplayProps) {
  const initials = initialsFromName(name || "U");
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-zinc-200 font-semibold text-zinc-700",
        avatarSizeClass(size),
        className,
      )}
      aria-hidden
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          {initials}
        </span>
      )}
    </span>
  );
}

type ProfileAvatarUploadProps = {
  name: string;
  avatarUrl?: string | null;
  onUpdated?: (profile: profileApi.UserProfile) => void;
  className?: string;
  size?: "sm" | "md";
};

export function ProfileAvatarUpload({
  name,
  avatarUrl,
  onUpdated,
  className,
  size = "md",
}: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const dim = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const shownUrl = previewUrl ?? avatarUrl;
  const initials = initialsFromName(name || "U");

  const handlePick = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    if (!file || busy) return;
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    try {
      const profile = await profileApi.uploadAvatar(file);
      onUpdated?.(profile);
    } catch {
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        aria-label="Upload profile photo"
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-full bg-zinc-200 font-semibold text-zinc-700 outline-none transition-opacity disabled:opacity-60",
          dim,
          className,
        )}
      >
        {shownUrl ? (
          <img
            src={shownUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {initials}
          </span>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-zinc-900/0 text-white transition-colors",
            "group-hover:bg-zinc-500/45 group-focus-visible:bg-zinc-500/45",
          )}
        >
          <Upload
            className={cn(
              iconSize,
              "opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          void handleFile(file);
        }}
      />
    </>
  );
}
