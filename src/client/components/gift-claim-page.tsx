"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GiftClaimDialog } from "@/components/gift-claim-dialog";
import { claimGift, getGiftClaim } from "@/lib/api/gifts";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/hooks/use-auth";
import { APP_ROUTES } from "@/lib/app-routes";

type GiftClaimPageClientProps = {
  token: string;
};

export function GiftClaimPageClient({ token }: GiftClaimPageClientProps) {
  const router = useRouter();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gift, setGift] = useState<{
    planName: string;
    months: number;
    senderName: string | null;
    message: string | null;
    themeColor: string | null;
  } | null>(null);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user?.id) {
      router.replace(
        `/login?redirectTo=${encodeURIComponent(`/gift/claim/${token}`)}`,
      );
    }
  }, [auth.loading, auth.user?.id, router, token]);

  useEffect(() => {
    if (auth.loading || !auth.user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const preview = await getGiftClaim(token);
        if (cancelled) return;
        setGift({
          planName: preview.gift.plan_name,
          months: preview.gift.months,
          senderName: preview.gift.sender_name,
          message: preview.gift.message,
          themeColor: preview.gift.theme_color,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "This gift link is invalid or has expired.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.user?.id, token]);

  const handleClose = useCallback(() => {
    router.replace(APP_ROUTES.newChat);
  }, [router]);

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    setError(null);
    try {
      await claimGift(token);
      setClaimed(true);
      window.dispatchEvent(new CustomEvent("clauxen:billing-updated"));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not claim this gift.",
      );
    } finally {
      setClaiming(false);
    }
  }, [token]);

  if (auth.loading || (!auth.user?.id && !error)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-shell-bg)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-shell-bg)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
      </div>
    );
  }

  if (!gift) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-shell-bg)] px-4">
        <p className="text-center text-sm text-red-600">
          {error ?? "This gift link is invalid or has expired."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--app-shell-bg)]">
      <GiftClaimDialog
        open
        gift={gift}
        claiming={claiming}
        claimed={claimed}
        error={error}
        onClaim={() => void handleClaim()}
        onClose={handleClose}
      />
    </div>
  );
}
