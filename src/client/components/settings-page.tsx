"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  getCanonicalSettingsTab,
  isSettingsTab,
  type SettingsCategory,
  settingsTabDescriptions,
  type SettingsTab,
} from "@/components/settings/constants";
import { SettingsNavSidebar } from "@/components/settings/settings-nav-sidebar";
import { SettingsTabErrorBoundary } from "@/components/settings/settings-tab-error-boundary";
import { useSettings } from "@/hooks/use-settings";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings-defaults";
import * as workspacesApi from "@/lib/api/workspaces";
import type { Workspace } from "@/lib/api/workspaces";
import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { FullscreenPortal } from "@/components/fullscreen-portal";
import type { SessionUser } from "@/lib/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { useAppPreferences } from "@/contexts/app-preferences-context";
import { focusSurface } from "@/lib/surface-focus";
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

function SettingsCategoryStack({ children }: { children: React.ReactNode }) {
  return <div className="settings-category-stack">{children}</div>;
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
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

  const safeInitial = isSettingsTab(initialTab)
    ? getCanonicalSettingsTab(initialTab)
    : "General";
  const [activeTab, setActiveTab] = useState<SettingsCategory>(safeInitial);
  const [copied, setCopied] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    focusSurface(dialogRef.current);
  }, [open]);

  const handleTabChange = (tab: SettingsTab) => {
    const canonicalTab = getCanonicalSettingsTab(tab);
    setActiveTab(canonicalTab);
    contentScrollRef.current?.scrollTo({ top: 0 });
    onTabChange?.(canonicalTab);
  };

  useEffect(() => {
    if (open) {
      setActiveTab(
        isSettingsTab(initialTab)
          ? getCanonicalSettingsTab(initialTab)
          : "General",
      );
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
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          element.getAttribute("aria-hidden") !== "true",
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
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

  const renderGeneralSettings = () => (
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
            preset === "Light" ? "Light" : preset === "Dark" ? "Dark" : "Auto",
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

  const renderNotificationsSettings = () => (
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
      setResponseChannel={(v) => updateNotifications({ responseChannel: v })}
      setGroupChatChannel={(v) => updateNotifications({ groupChatChannel: v })}
      setTasksChannel={(v) => updateNotifications({ tasksChannel: v })}
      setProjectsChannel={(v) => updateNotifications({ projectsChannel: v })}
      setRecommendationsChannel={(v) =>
        updateNotifications({ recommendationsChannel: v })
      }
      setUsageChannel={(v) => updateNotifications({ usageChannel: v })}
      setDesktopAlerts={(v) => updateNotifications({ desktopAlerts: v })}
      setSoundEffects={(v) => updateNotifications({ soundEffects: v })}
    />
  );

  const renderPersonalizationSettings = () => (
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

  const renderAccountSettings = () => (
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
          location: "-",
          created: "-",
          updated: "-",
          current: true,
        },
      ]}
    />
  );

  const renderCapabilitiesSettings = () => (
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

  const renderActiveTab = () => {
    switch (activeTab) {
      case "General":
        return renderGeneralSettings();
      case "Notifications":
        return renderNotificationsSettings();
      case "Personalization":
        return renderPersonalizationSettings();
      case "Plugins":
        return (
          <SettingsCategoryStack>
            <ClauxenCodeSettings isAuthenticated={Boolean(user?.id)} />
            <SkillsSettings />
            <ConnectorsCatalogSettings
              onAdd={() => handleTabChange("Plugins")}
            />
            <PluginsSettings />
          </SettingsCategoryStack>
        );
      case "Billing":
        return (
          <BillingSettings
            onUpgradeClick={onUpgradeClick}
            userDisplayName={user?.displayName ?? user?.email}
            userEmail={user?.email}
          />
        );
      case "Usage":
        return (
          <BillingSettings
            onUpgradeClick={onUpgradeClick}
            userDisplayName={user?.displayName ?? user?.email}
            userEmail={user?.email}
          />
        );
      case "Analytics":
        return (
          <SettingsCategoryStack>
            <ReflectSettings
              range={reflect.range}
              onRangeChange={(range) => updateReflect({ range })}
            />
            <TimeAndFocusSettings
              timeAndFocus={timeAndFocus}
              onChange={updateTimeAndFocus}
            />
          </SettingsCategoryStack>
        );
      case "Data controls":
        return (
          <PrivacySettings
            privacy={privacy}
            onChange={updatePrivacy}
            onGoToPersonalization={() => handleTabChange("Personalization")}
          />
        );
      case "Cloud browser":
        return renderCapabilitiesSettings();
      case "Storage":
        return <StorageSettings />;
      case "Safety":
        return (
          <SafetySettings
            reduceSensitiveContent={Boolean(safety.reduceSensitiveContent)}
            onChange={(reduceSensitiveContent) =>
              updateSafety({ reduceSensitiveContent })
            }
          />
        );
      case "Security and login":
        return (
          <SecuritySettings
            onLogout={onLogout}
            mfaEnabled={Boolean(safety.mfaEnabled)}
            onMfaChange={(mfaEnabled) => updateSafety({ mfaEnabled })}
          />
        );
      case "Parental controls":
        return <ParentalControlsSettings />;
      case "Trusted contact":
        return <TrustedContactSettings />;
      case "Account":
        return renderAccountSettings();
      case "Keyboard":
        return <KeyboardSettings />;
      /* Keeps the exhaustive switch resilient while the typed map evolves. */
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
      <div className="settings-theme fixed inset-0 z-[200]" role="presentation">
        {/*
        Div (not button): global button:hover forces background-color to near-transparent
        and washed out the settings backdrop on hover outside the dialog.
      */}
        <div
          aria-hidden
          data-settings-washout
          className={cn(
            chrome.overlay.scrim,
            "cursor-default max-md:opacity-95",
          )}
          onClick={onClose}
        />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
          data-app-overlay-surface=""
          tabIndex={-1}
          className={cn(
            chrome.overlay.modalShell,
            "max-w-none font-sans text-zinc-900 dark:text-zinc-100",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:pt-0 md:pb-0",
          )}
        >
          <h1 id="settings-modal-title" className="sr-only">
            Settings
          </h1>
          <p className="sr-only">
            Manage your Clauxen account and application preferences.
          </p>

          <div className="flex min-h-0 flex-1 flex-col bg-[var(--settings-canvas-bg)] md:flex-row md:items-stretch">
            <div className="shrink-0 bg-[var(--settings-sidebar-bg)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
              <div className="mb-3 flex h-8 items-center justify-between gap-3">
                <h2 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[var(--settings-fg)]">
                  Settings
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-icon-button no-hover-overlay shrink-0 text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
                  aria-label="Close settings"
                >
                  <X className="icon-lg" strokeWidth={1.8} />
                </button>
              </div>
              <SettingsNavSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                variant="mobile-toolbar"
              />
            </div>

            <aside className="hidden min-h-0 shrink-0 bg-[var(--settings-sidebar-bg)] md:flex md:w-[256px] md:flex-col md:border-r md:border-[var(--settings-modal-border)] md:px-3 md:pb-3 md:pt-5">
              <div className="mb-4 flex h-9 items-center px-2">
                <h2 className="text-[20px] font-semibold tracking-[-0.025em] text-[var(--settings-fg)]">
                  Settings
                </h2>
              </div>
              <SettingsNavSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </aside>

            <main className="settings-canvas relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--settings-canvas-bg)]">
              <header className="hidden shrink-0 items-start justify-between gap-8 px-8 pb-4 pt-6 md:flex">
                <div className="min-w-0">
                  <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.025em] text-[var(--settings-fg)]">
                    {activeTab}
                  </h2>
                  <p className="mt-0.5 max-w-[620px] text-[13px] leading-[19px] text-[var(--settings-fg-muted)]">
                    {settingsTabDescriptions[activeTab]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-icon-button no-hover-overlay mt-0.5 h-8 w-8 shrink-0 rounded-lg text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
                  aria-label="Close settings"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
              </header>

              <div
                ref={contentScrollRef}
                data-scroll-region=""
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:px-7 md:px-8 md:pb-12 md:pt-4",
                )}
                aria-busy={contentHydrating || undefined}
              >
                <div
                  className={cn(
                    "mx-auto w-full max-w-[720px]",
                    contentHydrating && "opacity-[0.97]",
                  )}
                >
                  <SettingsTabErrorBoundary tabLabel={activeTab}>
                    <div key={activeTab} className="settings-panel-enter">
                      {renderActiveTab()}
                    </div>
                  </SettingsTabErrorBoundary>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}

/** @deprecated Use SettingsModal */
export const SettingsPage = SettingsModal;
