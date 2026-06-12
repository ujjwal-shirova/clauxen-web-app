"use client";

import React, { useEffect, useState } from "react";
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
import { SettingsPlaceholder } from "@/frontend/components/settings/settings-placeholder";
import { SettingsPageSkeleton } from "@/frontend/components/settings/settings-page-skeleton";
import { ShimmerSkeleton } from "@/frontend/components/ui/shimmer-skeleton";
import { useMinimumLoadingTime } from "@/frontend/hooks/use-minimum-loading";
import { useSettings } from "@/frontend/hooks/use-settings";
import { useAuth } from "@/frontend/hooks/use-auth";
import * as workspacesApi from "@/frontend/lib/api/workspaces";
import type { Workspace, WorkspaceMember } from "@/frontend/lib/api/workspaces";

import type { SessionUser } from "@/frontend/lib/api/auth";

interface SettingsPageProps {
  onClose: () => void;
  onGoToCustomize: (tab: "skills" | "connectors") => void;
  onUpgradeClick?: () => void;
  user?: SessionUser | null;
  onLogout?: () => void;
  initialTab?: SettingsTab;
}

export function SettingsPage({
  onClose,
  onGoToCustomize,
  onUpgradeClick,
  user,
  onLogout,
  initialTab = "General",
}: SettingsPageProps) {
  const auth = useAuth();
  const {
    settings,
    loading: settingsLoading,
    updateGeneral,
    updatePersonalization,
    updateNotifications,
  } = useSettings(auth.isAuthenticated);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
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
    if (!user?.id) {
      setWorkspace(null);
      setWorkspaceMembers([]);
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
  }, [user?.id]);

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
      case "Keyboard":
        return <KeyboardSettings />;
    }
  };

  return (
    <ShimmerSkeleton
      loading={showSettingsSkeleton}
      fallback={<SettingsPageSkeleton />}
      label="Loading settings"
      className="h-full w-full flex-1"
    >
      <div className="mobile-page-inset mx-auto flex h-full w-full max-w-[1160px] flex-1 flex-col overflow-y-auto bg-white pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] animate-in fade-in slide-in-from-bottom-2 duration-300 sm:pt-5 md:px-10 md:pt-8 lg:px-8">
        <div className="mb-4 flex items-center justify-between text-zinc-700 sm:mb-6 md:mb-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 md:hidden"
              aria-label="Back to chat"
            >
              <X className="h-5 w-5 text-zinc-500" />
            </button>
            <h1 className="truncate font-serif text-[21px] font-medium sm:text-[22px]">
              Settings
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden rounded-lg p-2 transition-colors hover:bg-zinc-100 md:inline-flex"
            aria-label="Close settings"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[220px_1fr] md:gap-12">
          <SettingsNavSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="flex min-w-0 w-full max-w-none flex-col gap-8 md:max-w-[640px]">
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </ShimmerSkeleton>
  );
}
