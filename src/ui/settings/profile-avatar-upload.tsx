"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/profile-names";
import * as profileApi from "@/lib/api/profile";
import { useToast } from "@/hooks/use-toast";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import { AvatarCropDialog } from "./avatar-crop-dialog";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type AvatarSize = "sm" | "md" | "lg";

function avatarSizeClass(size: AvatarSize) {
  if (size === "sm") return "h-9 w-9 text-[11px]";
  if (size === "lg") return "h-16 w-16 text-[15px]";
  return "h-10 w-10 text-[13px]";
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
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl) && !broken;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-[var(--settings-icon-bg)] font-semibold text-[var(--settings-fg-muted)]",
        avatarSizeClass(size),
        className,
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={avatarUrl ?? ""}
          alt=""
          className="h-full w-full object-cover object-center"
          onError={() => setBroken(true)}
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
  size?: AvatarSize;
};

export function ProfileAvatarUpload({
  name,
  avatarUrl,
  onUpdated,
  className,
  size = "lg",
}: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewBaseUrlRef = useRef<string | null>(null);

  const dim = avatarSizeClass(size);
  const iconSize = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const shownUrl = previewUrl ?? avatarUrl;
  const initials = initialsFromName(name || "U");

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const closeCrop = () => {
    if (busy) return;
    setCropSrc(null);
    setCropError(null);
    revokeObjectUrl();
  };

  useEffect(() => () => revokeObjectUrl(), []);

  useEffect(() => {
    if (!previewUrl) return;
    if (avatarUrl && avatarUrl !== previewBaseUrlRef.current) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      previewBaseUrlRef.current = avatarUrl;
    }
  }, [avatarUrl, previewUrl]);

  const handlePick = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFile = (file: File | null) => {
    if (!file || busy) return;
    const mime = (file.type || "").toLowerCase();
    if (!ACCEPT.split(",").includes(mime)) {
      toast({
        title: "Use a PNG, JPEG, WebP, or GIF",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: "Choose an image smaller than 8 MB",
        variant: "destructive",
      });
      return;
    }
    revokeObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setCropError(null);
    setCropSrc(objectUrl);
  };

  const handleSaveCrop = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setCropError(null);
    const localPreview = URL.createObjectURL(file);
    previewBaseUrlRef.current = avatarUrl ?? "";
    setPreviewUrl(localPreview);
    try {
      const profile = await profileApi.uploadAvatar(file);
      onUpdated?.(profile);
      setCropSrc(null);
      revokeObjectUrl();
      toast({ title: "Profile photo updated" });
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
      setCropError(
        err instanceof Error ? err.message : "Could not save that photo.",
      );
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
        aria-haspopup="dialog"
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-full bg-[var(--settings-icon-bg)] font-semibold text-[var(--settings-fg-muted)] outline-none ring-offset-2 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--settings-input-focus)] disabled:opacity-60",
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
            "group-hover:bg-black/45 group-focus-visible:bg-black/45",
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
          handleFile(file);
        }}
      />
      {cropSrc ? (
        <FullscreenPortal>
          <AvatarCropDialog
            imageSrc={cropSrc}
            open
            busy={busy}
            error={cropError}
            onCancel={closeCrop}
            onSave={(file) => {
              void handleSaveCrop(file);
            }}
          />
        </FullscreenPortal>
      ) : null}
    </>
  );
}
