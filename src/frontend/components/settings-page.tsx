"use client";

import React, { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SettingsTab } from "@/frontend/components/settings/constants";
import { GeneralSettings } from "@/frontend/components/settings/general-settings";
import { NotificationsSettings } from "@/frontend/components/settings/notifications-settings";
import { PersonalizationSettingsPanel } from "@/frontend/components/settings/personalization-settings";
import { AccountSettings } from "@/frontend/components/settings/account-settings";
import { BillingSettings } from "@/frontend/components/settings/billing-settings";
import { DataControlsSettings } from "@/frontend/components/settings/data-controls-settings";
import { SecuritySettings } from "@/frontend/components/settings/security-settings";
import { StorageSettings } from "@/frontend/components/settings/storage-settings";
import { ConnectorsSettings } from "@/frontend/components/settings/connectors-settings";
import { KeyboardSettings } from "@/frontend/components/settings/keyboard-settings";
import { ParentalControlsSettings } from "@/frontend/components/settings/parental-controls-settings";
import { TrustedContactSettings } from "@/frontend/components/settings/trusted-contact-settings";
import { SettingsNavSidebar } from "@/frontend/components/settings/settings-nav-sidebar";
import { EnterpriseSettings } from "@/frontend/components/settings/enterprise-settings";
import { SettingsPlaceholder } from "@/frontend/components/settings/settings-placeholder";
import { SettingsPageSkeleton } from "@/frontend/components/settings/settings-page-skeleton";
import { ShimmerSkeleton } from "@/frontend/components/ui/shimmer-skeleton";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "@/frontend/components/ui/dialog";
import { useMinimumLoadingTime } from "@/frontend/hooks/use-minimum-loading";
import { useSettings } from "@/frontend/hooks/use-settings";
import { useAuth } from "@/frontend/hooks/use-auth";
import * as workspacesApi from "@/frontend/lib/api/workspaces";
import type { Workspace, WorkspaceMember } from "@/frontend/lib/api/workspaces";
import { cn } from "@/frontend/lib/utils";

import type { SessionUser } from "@/frontend/lib/api/auth";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onGoToCustomize: (tab: "skills" | "connectors") => void;
  onUpgradeClick?: () => void;
  user?: SessionUser | null;
  onLogout?: () => void;
  initialTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
}

export function SettingsModal({
  open,
  onClose,
  onGoToCustomize,
  onUpgradeClick,
  user,
  onLogout,
  initialTab = "General",
  onTabChange,
}: SettingsModalProps) {
  const auth = useAuth();
  const {
    settings,
    loading: settingsLoading,
    updateGeneral,
    updatePersonalization,
    updateNotifications,
  } = useSettings(auth.isAuthenticated);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  const [copied, setCopied] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    [],
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const general = settings?.general;
  const personalization = settings?.personalization;
  const notifications = settings?.notifications;

  useEffect(() => {
    if (!open || !user?.id) {
      if (!user?.id) {
        setWorkspace(null);
        setWorkspaceMembers([]);
      }
      return;
    }

    setWorkspaceLoading(true);
    void workspacesApi
      .getWorkspaceMembers()
      .then(({ workspace: ws, members }) => {
        setWorkspace(ws);
        setWorkspaceMembers(members);
      })
      .catch(() => {
        setWorkspace(null);
        setWorkspaceMembers([]);
      })
      .finally(() => setWorkspaceLoading(false));
  }, [open, user?.id]);

  const handleCopyOrgId = () => {
    const id = user?.id ?? "";
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSettingsDataLoading =
    auth.loading ||
    (auth.isAuthenticated && settingsLoading) ||
    !general ||
    !personalization ||
    !notifications;

  const showSettingsSkeleton = useMinimumLoadingTime(
    isSettingsDataLoading,
    400,
  );

  const renderActiveTab = () => {
    if (!general || !personalization || !notifications) return null;

    switch (activeTab) {
      case "General":
        return (
          <GeneralSettings
            colorMode={general.colorMode}
            setColorMode={(v) => updateGeneral({ colorMode: v })}
            chatFont={general.chatFont}
            setChatFont={(v) => updateGeneral({ chatFont: v })}
            appearancePreset={general.appearancePreset}
            contrastMode={general.contrastMode ?? "System"}
            accentColor={general.accentColor}
            language={general.language}
            spokenLanguage={general.spokenLanguage}
            voice={general.voice}
            voiceIsolation={general.voiceIsolation}
            dictationEnabled={general.dictationEnabled ?? true}
            setAppearancePreset={(v) => updateGeneral({ appearancePreset: v })}
            setContrastMode={(v) => updateGeneral({ contrastMode: v })}
            setAccentColor={(v) => updateGeneral({ accentColor: v })}
            setLanguage={(v) => updateGeneral({ language: v })}
            setSpokenLanguage={(v) => updateGeneral({ spokenLanguage: v })}
            setVoice={(v) => updateGeneral({ voice: v })}
            setVoiceIsolation={(v) => updateGeneral({ voiceIsolation: v })}
            setDictationEnabled={(v) => updateGeneral({ dictationEnabled: v })}
          />
        );
      case "Notifications":
        return (
          <NotificationsSettings
            codexChannel={notifications.codexChannel ?? "Push"}
            responseChannel={notifications.responseChannel}
            groupChatChannel={notifications.groupChatChannel}
            tasksChannel={notifications.tasksChannel}
            projectsChannel={notifications.projectsChannel}
            recommendationsChannel={notifications.recommendationsChannel}
            usageChannel={notifications.usageChannel}
            desktopAlerts={notifications.desktopAlerts}
            soundEffects={notifications.soundEffects}
            setCodexChannel={(v) => updateNotifications({ codexChannel: v })}
            setResponseChannel={(v) =>
              updateNotifications({ responseChannel: v })
            }
            setGroupChatChannel={(v) =>
              updateNotifications({ groupChatChannel: v })
            }
            setTasksChannel={(v) => updateNotifications({ tasksChannel: v })}
            setProjectsChannel={(v) =>
              updateNotifications({ projectsChannel: v })
            }
            setRecommendationsChannel={(v) =>
              updateNotifications({ recommendationsChannel: v })
            }
            setUsageChannel={(v) => updateNotifications({ usageChannel: v })}
            setDesktopAlerts={(v) => updateNotifications({ desktopAlerts: v })}
            setSoundEffects={(v) => updateNotifications({ soundEffects: v })}
          />
        );
      case "Personalization":
        return (
          <PersonalizationSettingsPanel
            personalization={personalization}
            toolMode={general.toolMode}
            onChange={updatePersonalization}
            onToolModeChange={(v) => updateGeneral({ toolMode: v })}
            onGoToCustomize={onGoToCustomize}
          />
        );
      case "Apps":
        return <ConnectorsSettings onGoToCustomize={onGoToCustomize} />;
      case "Schedules":
        return (
          <SettingsPlaceholder
            title="Schedules"
            description="Set when Clauxen can run tasks, send reminders, and respect quiet hours."
          />
        );
      case "Billing":
        return (
          <BillingSettings
            onUpgradeClick={onUpgradeClick}
            userDisplayName={user?.displayName ?? user?.email}
            userEmail={user?.email}
          />
        );
      case "Data controls":
        return <DataControlsSettings />;
      case "Storage":
        return <StorageSettings />;
      case "Security":
        return <SecuritySettings onLogout={onLogout} />;
      case "Parental controls":
        return <ParentalControlsSettings />;
      case "Trusted contact":
        return <TrustedContactSettings />;
      case "Account":
        return (
          <AccountSettings
            copied={copied}
            onCopyOrgId={handleCopyOrgId}
            userId={user?.id}
            userEmail={user?.email}
            userDisplayName={user?.displayName}
            onLogout={onLogout}
            workspace={workspace}
            workspaceMembers={workspaceMembers}
            workspaceLoading={workspaceLoading}
          />
        );
      case "Enterprise":
        return <EnterpriseSettings />;
      case "Keyboard":
        return <KeyboardSettings />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[100] bg-[rgba(244,244,245,0.84)] backdrop-blur-none max-md:bg-[rgba(244,244,245,0.92)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-[101] flex min-h-0 max-w-none flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans text-zinc-900 outline-none",
            "inset-0 h-[100dvh] w-full rounded-none border-0 shadow-none",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 duration-200",
            "md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(680px,calc(100dvh-2rem))] md:w-[min(960px,calc(100vw-1.5rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:border-[rgba(11,11,11,0.1)] md:shadow-[0_24px_80px_-16px_rgba(24,24,27,0.2)] md:pt-0 md:pb-0",
            "md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:zoom-out-[0.98] md:data-[state=open]:zoom-in-[0.98]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Settings
          </DialogPrimitive.Title>

          <ShimmerSkeleton
            loading={showSettingsSkeleton}
            fallback={<SettingsPageSkeleton />}
            label="Loading settings"
            className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch"
          >
            <div className="shrink-0 border-b border-[rgba(11,11,11,0.1)] bg-[var(--app-shell-bg)] px-4 py-3 md:hidden">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] leading-[14px] text-zinc-500">
                    Settings
                  </p>
                  <h2 className="truncate text-[15px] font-semibold leading-5 text-zinc-900">
                    {activeTab}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-[rgba(11,11,11,0.05)]"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              <SettingsNavSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                variant="mobile-toolbar"
              />
            </div>

            <aside className="hidden min-h-0 shrink-0 bg-[var(--app-shell-bg)] md:flex md:w-[192px] md:flex-col md:border-r md:border-[rgba(11,11,11,0.1)] md:p-3">
              <SettingsNavSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </aside>

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--app-panel-bg)]">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-[rgba(11,11,11,0.05)] md:inline-flex"
                aria-label="Close settings"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>

              <div
                id="settings-modal-title"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[14px] leading-5 sm:px-6 md:px-6 md:pb-4 md:pt-12"
              >
                {renderActiveTab()}
              </div>
            </div>
          </ShimmerSkeleton>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** @deprecated Use SettingsModal */
export const SettingsPage = SettingsModal;
