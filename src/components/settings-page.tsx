"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  isSettingsTab,
  type SettingsTab,
} from "@/components/settings/constants";
import { SettingsNavSidebar } from "@/components/settings/settings-nav-sidebar";
import { SettingsTabErrorBoundary } from "@/components/settings/settings-tab-error-boundary";
import { useSettings } from "@/hooks/use-settings";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings-defaults";
import * as workspacesApi from "@/lib/api/workspaces";
import type { Workspace } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import type { SessionUser } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { useAppPreferences } from "@/contexts/app-preferences-context";
import { GeneralSettings } from "@/components/settings/general-settings";
import { preloadChatFontCatalog } from "@/components/chat-font-loader";
import { PersonalizationSettingsPanel } from "@/components/settings/personalization-settings";
import { NotificationsSettings } from "@/components/settings/notifications-settings";
import { AccountSettings } from "@/components/settings/account-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { PrivacySettings } from "@/components/settings/privacy-settings";
import { BillingSettings } from "@/components/settings/billing-settings";
import { StorageSettings } from "@/components/settings/storage-settings";
import { CapabilitiesSettings } from "@/components/settings/capabilities-settings";
import { ReflectSettings } from "@/components/settings/reflect-settings";
import { TimeAndFocusSettings } from "@/components/settings/time-and-focus-settings";
import { SafetySettings } from "@/components/settings/safety-settings";
import { ParentalControlsSettings } from "@/components/settings/parental-controls-settings";
import { TrustedContactSettings } from "@/components/settings/trusted-contact-settings";
import { ClauxenCodeSettings } from "@/components/settings/clauxen-code-settings";
import { KeyboardSettings } from "@/components/settings/keyboard-settings";
import { SkillsSettings } from "@/components/settings/skills-settings";
import {
  ConnectorsCatalogSettings,
  PluginsSettings,
} from "@/components/settings/plugins-settings";

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
  const { refresh: refreshAuth } = useAuth();
  const {
    general: preferenceGeneral,
    updateGeneral: updatePreferenceGeneral,
    refresh: refreshPreferences,
  } = useAppPreferences();
  const settingsEnabled = Boolean(user?.id);
  const {
    settings,
    ready: settingsReady,
    updateGeneral,
    updatePrivacy,
    updateCapabilities,
    updateTimeAndFocus,
    updateReflect,
    updateNotifications,
    updatePersonalization,
    updateSafety,
    refresh: refreshSettings,
  } = useSettings(settingsEnabled);
  /**
   * Soft hint while the first settings hydrate runs — never blocks clicks,
   * hover, or tab switching (defaults render immediately).
   */
  const contentHydrating = settingsEnabled && !settingsReady;

  const safeInitial = isSettingsTab(initialTab) ? initialTab : "General";
  const [activeTab, setActiveTab] = useState<SettingsTab>(safeInitial);
  const [copied, setCopied] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (open) {
      setActiveTab(isSettingsTab(initialTab) ? initialTab : "General");
      preloadChatFontCatalog();
      if (settingsEnabled) {
        void refreshSettings();
        void refreshPreferences({ quiet: true });
      }
    }
  }, [initialTab, open, settingsEnabled, refreshSettings, refreshPreferences]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const general = settings.general ?? DEFAULT_APP_SETTINGS.general;
  const appearanceGeneral = preferenceGeneral ?? general;
  const privacy = settings.privacy ?? DEFAULT_APP_SETTINGS.privacy;
  const capabilities =
    settings.capabilities ?? DEFAULT_APP_SETTINGS.capabilities;
  const timeAndFocus =
    settings.timeAndFocus ?? DEFAULT_APP_SETTINGS.timeAndFocus;
  const reflect = settings.reflect ?? DEFAULT_APP_SETTINGS.reflect;
  const notifications =
    settings.notifications ?? DEFAULT_APP_SETTINGS.notifications;
  const personalization =
    settings.personalization ?? DEFAULT_APP_SETTINGS.personalization;
  const safety = settings.safety ?? DEFAULT_APP_SETTINGS.safety;

  useEffect(() => {
    if (!open || !user?.id) {
      if (!user?.id) setWorkspace(null);
      return;
    }

    void workspacesApi
      .getWorkspaceMembers()
      .then(({ workspace: ws }) => setWorkspace(ws ?? null))
      .catch(() => setWorkspace(null));
  }, [open, user?.id]);

  const handleCopyOrgId = () => {
    const id = workspace?.id ?? user?.id ?? "";
    if (!id) return;
    void navigator.clipboard.writeText(id).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "General":
        return (
          <GeneralSettings
            personalization={personalization}
            onPersonalizationChange={updatePersonalization}
            avatarUrl={user?.avatarUrl}
            onAvatarUpdated={() => {
              void refreshAuth({ quiet: true });
            }}
            appearancePreset={appearanceGeneral.appearancePreset}
            onAppearanceChange={(preset) =>
              updatePreferenceGeneral({
                appearancePreset: preset,
                colorMode:
                  preset === "Light"
                    ? "Light"
                    : preset === "Dark"
                      ? "Dark"
                      : "Auto",
              })
            }
            chatFont={appearanceGeneral.chatFont}
            setChatFont={(v) => updatePreferenceGeneral({ chatFont: v })}
            motion={appearanceGeneral.motion ?? "System"}
            setMotion={(v) => updatePreferenceGeneral({ motion: v })}
            followUpSuggestions={appearanceGeneral.followUpSuggestions ?? true}
            setFollowUpSuggestions={(v) =>
              updatePreferenceGeneral({ followUpSuggestions: v })
            }
          />
        );
      case "Personalization":
        return (
          <PersonalizationSettingsPanel
            personalization={personalization}
            onChange={updatePersonalization}
            advanced={{
              webSearch: personalization.webSearch ?? true,
              canvas: Boolean(capabilities.artifacts),
              connectorSearch: Boolean(capabilities.connectorSearch),
            }}
            onAdvancedChange={(patch) => {
              if (patch.webSearch != null) {
                updatePersonalization({ webSearch: patch.webSearch });
              }
              const capabilityPatch: {
                artifacts?: boolean;
                connectorSearch?: boolean;
              } = {};
              if (patch.canvas != null) {
                capabilityPatch.artifacts = patch.canvas;
              }
              if (patch.connectorSearch != null) {
                capabilityPatch.connectorSearch = patch.connectorSearch;
              }
              if (Object.keys(capabilityPatch).length > 0) {
                updateCapabilities(capabilityPatch);
              }
            }}
            onManageMemory={() => handleTabChange("Capabilities")}
          />
        );
      case "Notifications":
        return (
          <NotificationsSettings
            codexChannel={notifications.codexChannel}
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
            setDesktopAlerts={(v) =>
              updateNotifications({ desktopAlerts: v })
            }
            setSoundEffects={(v) => updateNotifications({ soundEffects: v })}
          />
        );
      case "Account":
        return (
          <AccountSettings
            copied={copied}
            onCopyOrgId={handleCopyOrgId}
            userId={user?.id}
            onLogout={onLogout}
            onLogoutAllDevices={onLogout}
            workspace={workspace}
            sessions={[
              {
                device: "Chrome",
                location: "—",
                created: "—",
                updated: "—",
                current: true,
              },
            ]}
          />
        );
      case "Security":
        return (
          <SecuritySettings
            onLogout={onLogout}
            mfaEnabled={Boolean(safety.mfaEnabled)}
            onMfaChange={(mfaEnabled) => updateSafety({ mfaEnabled })}
          />
        );
      case "Privacy":
        return (
          <PrivacySettings
            privacy={privacy}
            onChange={updatePrivacy}
            onGoToPersonalization={() => handleTabChange("Personalization")}
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
      case "Storage":
        return <StorageSettings />;
      case "Capabilities":
        return (
          <CapabilitiesSettings
            capabilities={{
              ...capabilities,
              toolMode: general.toolMode ?? "auto",
            }}
            onChange={(patch) => {
              if (patch.toolMode != null) {
                updateGeneral({ toolMode: patch.toolMode });
              }
              const { toolMode: _toolMode, ...rest } = patch;
              if (Object.keys(rest).length > 0) {
                updateCapabilities(rest);
              }
            }}
            onGoToCustomize={onGoToCustomize}
          />
        );
      case "Reflect":
        return (
          <ReflectSettings
            range={reflect.range}
            onRangeChange={(range) => updateReflect({ range })}
          />
        );
      case "Time and focus":
        return (
          <TimeAndFocusSettings
            timeAndFocus={timeAndFocus}
            onChange={updateTimeAndFocus}
          />
        );
      case "Safety":
        return (
          <SafetySettings
            reduceSensitiveContent={Boolean(safety.reduceSensitiveContent)}
            onChange={(reduceSensitiveContent) =>
              updateSafety({ reduceSensitiveContent })
            }
          />
        );
      case "Parental controls":
        return <ParentalControlsSettings />;
      case "Trusted contact":
        return <TrustedContactSettings />;
      case "Clauxen Code":
        return (
          <ClauxenCodeSettings isAuthenticated={Boolean(user?.id)} />
        );
      case "Keyboard":
        return <KeyboardSettings />;
      case "Skills":
        return (
          <SkillsSettings
            onBrowse={() => onGoToCustomize("skills")}
            onAdd={() => onGoToCustomize("skills")}
          />
        );
      case "Connectors":
        return (
          <ConnectorsCatalogSettings
            onGoToCustomize={() => onGoToCustomize("connectors")}
            onAdd={() => onGoToCustomize("connectors")}
          />
        );
      case "Plugins":
        return <PluginsSettings />;
      default:
        return (
          <p className="text-sm text-zinc-500">
            Unknown settings section. Pick another category.
          </p>
        );
    }
  };

  if (!open) return null;

  return (
    <FullscreenPortal>
    <div className="fixed inset-0 z-[200]" role="presentation">
      {/*
        Div (not button): global button:hover forces background-color to near-transparent
        and washed out the settings backdrop on hover outside the dialog.
      */}
      <div
        aria-hidden
        data-settings-washout
        className="absolute inset-0 cursor-default bg-[rgba(244,244,245,0.84)] max-md:bg-[rgba(244,244,245,0.92)] dark:bg-black/70 max-md:dark:bg-black/80"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className={cn(
          "fixed z-[201] flex min-h-0 max-w-none flex-col overflow-hidden bg-[var(--app-panel-bg)] font-sans text-zinc-900 outline-none dark:text-zinc-100",
          "inset-0 h-[100dvh] w-full rounded-none border-0 shadow-none",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          "md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(680px,calc(100dvh-2rem))] md:w-[min(960px,calc(100vw-1.5rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:border-[rgba(11,11,11,0.1)] md:shadow-[0_24px_80px_-16px_rgba(24,24,27,0.2)] md:pt-0 md:pb-0 dark:md:border-white/10 dark:md:shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)]",
        )}
      >
        <h1 id="settings-modal-title" className="sr-only">
          Settings
        </h1>
        <p className="sr-only">
          Manage your Clauxen account and application preferences.
        </p>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch">
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
              data-scroll-region=""
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[14px] leading-5 sm:px-6 md:px-6 md:pb-4 md:pt-12",
                contentHydrating && "opacity-95",
              )}
              aria-busy={contentHydrating || undefined}
            >
              <SettingsTabErrorBoundary tabLabel={activeTab}>
                {renderActiveTab()}
              </SettingsTabErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
    </FullscreenPortal>
  );
}

/** @deprecated Use SettingsModal */
export const SettingsPage = SettingsModal;
