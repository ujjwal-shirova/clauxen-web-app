"use client";

import React from "react";
import { Code2, Link2, Loader2, MessageCirclePlus } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { useSettings } from "@/frontend/hooks/use-settings";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useToast } from "@/frontend/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";

const HERO_VIDEO_SRC =
  "https://statics.moonshot.cn/kimi-web-seo/assets/claw-hero-D59VliO4.mp4";

function ComputerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="49"
      height="48"
      fill="none"
      viewBox="0 0 49 48"
      className={className}
      aria-hidden
    >
      <path
        d="M5.6543 11.418C5.6543 9.76112 6.99744 8.41797 8.6543 8.41797H40.3448C42.0016 8.41797 43.3448 9.76111 43.3448 11.418V35.2714H5.6543V11.418Z"
        fill="white"
        stroke="#A6A6A6"
      />
      <path
        d="M7.18945 12.0605C7.18945 10.8179 8.19681 9.81055 9.43945 9.81055H39.5613C40.804 9.81055 41.8113 10.8179 41.8113 12.0605V34.9134H7.18945V12.0605Z"
        fill="#F7F7F7"
      />
      <path
        d="M0.5 35.2715H48.5V36.582C48.5 38.2388 47.1569 39.582 45.5 39.582H3.5C1.84315 39.582 0.5 38.2388 0.5 36.582V35.2715Z"
        fill="white"
        stroke="#A6A6A6"
      />
    </svg>
  );
}

function CloudServerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      fill="none"
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <path
        fill="#F7F7F7"
        stroke="#A6A6A6"
        d="M32.459 16.647a10.65 10.65 0 0 0-7.802 3.387 5.697 5.697 0 0 0-10 3.733l.003.141a7.12 7.12 0 0 0 1.423 14.099h16.376c5.9 0 10.68-4.781 10.68-10.68 0-5.9-4.78-10.68-10.68-10.68Z"
      />
      <path
        fill="#fff"
        stroke="#A6A6A6"
        d="M24.355 9.709a10.65 10.65 0 0 0-7.803 3.387 5.696 5.696 0 0 0-9.997 3.875A7.123 7.123 0 0 0 7.978 31.07h16.377c5.899 0 10.68-4.783 10.68-10.681s-4.782-10.68-10.68-10.68Z"
      />
    </svg>
  );
}

function AndroidPhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      fill="none"
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <path
        fill="#F7F7F7"
        stroke="#BFBFBF"
        strokeWidth=".857"
        d="M1 8.413c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.31c.642-.328 1.482-.328 3.162-.328h13.91c1.68 0 2.521 0 3.163.327a3 3 0 0 1 1.31 1.311c.328.642.328 1.482.328 3.162v31.175c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311c-.642.327-1.482.327-3.162.327H5.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C1 42.108 1 41.268 1 39.588z"
      />
      <path
        fill="#fff"
        d="M3.1 39.481c0-1.122.91-2.032 2.032-2.032H20.38a2.032 2.032 0 0 1 0 4.064H5.132a2.03 2.03 0 0 1-2.031-2.032"
      />
    </svg>
  );
}

type DeployTarget = "computer" | "cloud" | "android";

function normalizeHttpEndpoint(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function ClauxenClawView() {
  const auth = useAuth();
  const { toast } = useToast();
  const { saving, createClawDeployment } = useSettings(auth.isAuthenticated);
  const [creatingTarget, setCreatingTarget] =
    React.useState<DeployTarget | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const [linkEndpoint, setLinkEndpoint] = React.useState("");
  const [linking, setLinking] = React.useState(false);

  const handleCreateCloud = async () => {
    if (!auth.isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Sign in to create a cloud Claw agent.",
      });
      return;
    }
    setCreatingTarget("cloud");
    try {
      await createClawDeployment("Cloud Claw Agent", {
        kind: "persistent",
        status: "ready",
      });
      toast({
        title: "Claw agent created",
        description: "Your cloud agent is ready to configure.",
      });
    } catch {
      toast({
        title: "Could not create agent",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingTarget(null);
    }
  };

  const handleLinkExisting = async () => {
    const endpoint = normalizeHttpEndpoint(linkEndpoint);
    if (!endpoint) {
      toast({
        title: "Invalid URL",
        description: "Enter a valid http or https endpoint.",
        variant: "destructive",
      });
      return;
    }
    setLinking(true);
    try {
      await createClawDeployment("Linked Claw Agent", {
        kind: "linked",
        endpoint,
        status: "linked",
      });
      setLinkEndpoint("");
      setLinkDialogOpen(false);
      toast({
        title: "Agent linked",
        description: "Your existing Claw agent is now connected.",
      });
    } catch {
      toast({
        title: "Could not link agent",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleDesktopDownload = () => {
    toast({
      title: "Desktop app",
      description: "The Clauxen desktop app download will be available soon.",
    });
  };

  const handleAndroidDownload = () => {
    toast({
      title: "Android app",
      description: "The Android Claw agent app will be available soon.",
    });
  };

  return (
    <div className="flex h-full w-full flex-1 overflow-y-auto bg-white font-sans text-zinc-900">
      <div className="mobile-page-inset mx-auto w-full max-w-[560px] py-6 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-10">
        <div className="mb-6 overflow-hidden rounded-2xl">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-100">
            <video
              src={HERO_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 border-b border-black/[0.13] pb-6">
          <FeatureRow
            icon={<Code2 className="h-[18px] w-[18px]" />}
            title="Deploy OpenClaw in seconds"
            description="OpenClaw is an AI assistant with personality and memory. Clauxen deploys it to the cloud for you in one click—no complex setup, online 24/7."
          />
          <FeatureRow
            icon={<MessageCirclePlus className="h-[18px] w-[18px]" />}
            title="Chat freely through Clauxen"
            description="Configured with ready-to-use skills; runs across multiple messaging apps and gets tasks done proactively."
          />
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-medium leading-5">Where to deploy?</h2>
            <button
              type="button"
              onClick={() => setLinkDialogOpen(true)}
              className="inline-flex items-center gap-1.5 text-[14px] text-black/45 transition-colors hover:text-black/70"
            >
              <Link2 className="h-5 w-5" />
              <span>Link existing Open Claw</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <DeployCard
              icon={<ComputerIcon className="h-12 w-[49px] shrink-0" />}
              title="On My Computer"
              description="Deploy directly to your machine, manage local files"
              actionLabel="Download Desktop App"
              onAction={handleDesktopDownload}
              variant="secondary"
            />
            <DeployCard
              icon={<CloudServerIcon className="h-12 w-12 shrink-0" />}
              title="On Cloud Server"
              description="Isolated data, deploy 24/7 assistant on cloud server"
              actionLabel="Create"
              onAction={() => void handleCreateCloud()}
              variant="primary"
              loading={creatingTarget === "cloud" || saving}
            />
            <DeployCard
              icon={<AndroidPhoneIcon className="h-12 w-12 shrink-0" />}
              title="On Android Phone"
              description="Deploy OpenClaw to your idle Android device"
              actionLabel="Download"
              onAction={handleAndroidDownload}
              variant="secondary"
            />
          </div>
        </section>
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link existing Open Claw</DialogTitle>
            <DialogDescription>
              Paste the URL of an existing OpenClaw deployment to connect it to
              Clauxen.
            </DialogDescription>
          </DialogHeader>
          <input
            value={linkEndpoint}
            onChange={(event) => setLinkEndpoint(event.target.value)}
            placeholder="https://your-claw-agent.example.com"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[14px] outline-none focus:border-zinc-300"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleLinkExisting()}
              disabled={linking || !linkEndpoint.trim()}
            >
              {linking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Linking…
                </>
              ) : (
                "Link agent"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <div className="flex h-[18px] w-[18px] items-center justify-center">
          {icon}
        </div>
        <h3 className="text-[14px] font-medium leading-5">{title}</h3>
      </div>
      <p className="text-[14px] leading-5 text-black/45">{description}</p>
    </div>
  );
}

function DeployCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant,
  loading = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant: "primary" | "secondary";
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-black/[0.13] p-4 transition-colors hover:bg-black/[0.02]">
      {icon}
      <div className="flex flex-col gap-1">
        <h4 className="text-[14px] font-medium leading-5">{title}</h4>
        <p className="text-[14px] leading-5 text-black/45">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={loading}
        className={cn(
          "mt-auto flex h-8 w-full items-center justify-center rounded-lg px-3 text-[14px] font-medium transition-colors disabled:opacity-50",
          variant === "primary"
            ? "bg-black/90 text-white hover:bg-black"
            : "bg-black/[0.03] hover:bg-black/[0.06]",
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
      </button>
    </div>
  );
}
