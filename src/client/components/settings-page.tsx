"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import {
  isSettingsTab,
  resolveVisibleTab,
  settingsItemLabel,
  settingsTabDescriptions,
  type SettingsTab,
  type VisibleSettingsTab,
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
import {
  SecuritySettings,
  type SecuritySettingsView,
} from "@/components/settings/security-settings";
import { DataControlsSettings } from "@/components/settings/data-controls-settings";
import { BillingSettings } from "@/components/settings/billing-settings";
import { CapabilitiesSettings } from "@/components/settings/capabilities-settings";
import { ClauxenCodeSettings } from "@/components/settings/clauxen-code-settings";
import { SkillsSettings } from "@/components/settings/skills-settings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onUpgradeClick?: () => void;
  user?: SessionUser | null;
  onLogout?: () => void;
  initialTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
}

export function SettingsModal({
  open,
  onClose,
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

  const safeInitial = isSettingsTab(initialTab) ? initialTab : "General";
  const [activeTab, setActiveTab] = useState<SettingsTab>(safeInitial);
  const [securityView, setSecurityView] =
    useState<SecuritySettingsView>("main");
  const [copied, setCopied] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const visibleTab: VisibleSettingsTab = resolveVisibleTab(activeTab);

  useLayoutEffect(() => {
    if (!open) return;
    focusSurface(dialogRef.current);
  }, [open]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSecurityView("main");
    contentScrollRef.current?.scrollTo({ top: 0 });
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (open) {
      setActiveTab(isSettingsTab(initialTab) ? initialTab : "General");
      setSecurityView("main");
      preloadChatFontCatalog();
      if (settingsEnabled) {
        void refreshSettings();
        void refreshPreferences({ quiet: true });
        void refreshAuth({ quiet: true });
      }
    }
  }, [initialTab, open, settingsEnabled, refreshSettings, refreshPreferences, refreshAuth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const nestedOverlay = document.querySelector(
        "[data-nested-settings-dialog]",
      );
      if (nestedOverlay) return;

      if (event.key === "Escape") {
        if (securityView !== "main") {
          event.preventDefault();
          setSecurityView("main");
          return;
        }
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
  }, [open, onClose, securityView]);

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
    switch (visibleTab) {
      case "General":
        return (
          <GeneralSettings
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
            accentColor={appearanceGeneral.accentColor}
            setAccentColor={(v) => updatePreferenceGeneral({ accentColor: v })}
            contrastMode={appearanceGeneral.contrastMode}
            setContrastMode={(v) =>
              updatePreferenceGeneral({ contrastMode: v })
            }
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
            }}
            onAdvancedChange={(patch) => {
              if (patch.webSearch != null) {
                updatePersonalization({ webSearch: patch.webSearch });
              }
              if (patch.canvas != null) {
                updateCapabilities({ artifacts: patch.canvas });
              }
            }}
            reflectRange={reflect.range}
            onReflectRangeChange={(range) => updateReflect({ range })}
            generateMemory={Boolean(capabilities.generateMemory)}
            onGenerateMemoryChange={(generateMemory) =>
              updateCapabilities({ generateMemory })
            }
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
            setRecommendationsChannel={(v) =>
              updateNotifications({ recommendationsChannel: v })
            }
            setUsageChannel={(v) => updateNotifications({ usageChannel: v })}
            setDesktopAlerts={(v) => updateNotifications({ desktopAlerts: v })}
            setSoundEffects={(v) => updateNotifications({ soundEffects: v })}
            timeAndFocus={timeAndFocus}
            onTimeAndFocusChange={updateTimeAndFocus}
          />
        );
      case "Account":
        return (
          <AccountSettings
            copied={copied}
            onCopyOrgId={handleCopyOrgId}
            userId={user?.id}
            userEmail={user?.email}
            avatarUrl={user?.avatarUrl}
            onAvatarUpdated={() => {
              void refreshAuth({ quiet: true });
            }}
            fullName={personalization.fullName}
            onFullNameChange={(fullName) =>
              updatePersonalization({ fullName })
            }
            onOpenSecurity={() => handleTabChange("Security & login")}
            onLogout={onLogout}
            onLogoutAllDevices={onLogout}
            workspace={workspace}
          />
        );
      case "Security & login":
        return (
          <SecuritySettings
            onLogout={onLogout}
            userEmail={user?.email ?? undefined}
            mfaEnabled={Boolean(safety.mfaEnabled)}
            onMfaChange={(mfaEnabled) => updateSafety({ mfaEnabled })}
            view={securityView}
            onViewChange={(next) => {
              setSecurityView(next);
              contentScrollRef.current?.scrollTo({ top: 0 });
            }}
          />
        );
      case "Data controls":
        return (
          <DataControlsSettings
            privacy={privacy}
            onPrivacyChange={updatePrivacy}
            reduceSensitiveContent={Boolean(safety.reduceSensitiveContent)}
            onSafetyChange={(reduceSensitiveContent) =>
              updateSafety({ reduceSensitiveContent })
            }
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
          />
        );
      case "Skills":
        return <SkillsSettings />;
      case "Clauxen Code":
        return <ClauxenCodeSettings isAuthenticated={Boolean(user?.id)} />;
      default:
        return (
          <p className="text-[13px] text-[var(--settings-fg-muted)]">
            Unknown settings section. Pick another category.
          </p>
        );
    }
  };

  const showPasskeysSubpage =
    securityView === "passkeys" && visibleTab === "Security & login";

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

          <div className="cx-settings flex min-h-0 flex-1 flex-col bg-[var(--cx-paper)] md:flex-row md:items-stretch">
            <div className="shrink-0 border-b border-[var(--settings-hairline)] bg-[var(--settings-sidebar-bg)] px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:hidden">
              <div className="mb-2.5 flex h-7 items-center justify-between gap-3 px-1">
                <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-[var(--settings-fg)]">
                  Settings
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-icon-button no-hover-overlay !size-7 shrink-0 text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
                  aria-label="Close settings"
                >
                  <X className="size-4" strokeWidth={1.8} />
                </button>
              </div>
              <SettingsNavSidebar
                activeTab={visibleTab}
                onTabChange={handleTabChange}
                variant="mobile-toolbar"
              />
            </div>

            <aside className="cx-settings-aside hidden min-h-0 shrink-0 md:flex md:w-[248px] md:flex-col md:px-2 md:pb-3 md:pt-3">
              <SettingsNavSidebar
                activeTab={visibleTab}
                onTabChange={handleTabChange}
                accountName={
                  personalization.fullName || user?.displayName || user?.email
                }
                accountAvatarUrl={user?.avatarUrl}
              />
            </aside>

            <main className="settings-canvas relative flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--settings-canvas-bg)]">
              <button
                type="button"
                onClick={onClose}
                className="ui-icon-button no-hover-overlay absolute right-3 top-3 z-10 hidden !size-7 text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)] md:inline-flex"
                aria-label="Close settings"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
              <header
                className={cn(
                  "cx-set-header shrink-0 items-center gap-6 px-8",
                  showPasskeysSubpage ? "hidden md:flex" : "hidden",
                )}
              >
                {showPasskeysSubpage ? (
                  <div className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSecurityView("main");
                        contentScrollRef.current?.scrollTo({ top: 0 });
                      }}
                      aria-label="Back to Security & login"
                      className="ui-icon-button no-hover-overlay -ml-1.5 !size-7 shrink-0 text-[var(--settings-fg-muted)] hover:text-[var(--settings-fg)]"
                    >
                      <ChevronLeft className="size-4" strokeWidth={1.8} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[11.5px] leading-4 text-[var(--settings-fg-muted)]">
                        Security & login
                      </p>
                      <h2 className="truncate text-[15px] font-semibold leading-5 tracking-[-0.015em] text-[var(--settings-fg)]">
                        Passkeys
                      </h2>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold leading-6 tracking-[-0.018em] text-[var(--settings-fg)]">
                      {visibleTab}
                    </h2>
                    <p className="max-w-[560px] truncate text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
                      {settingsTabDescriptions[visibleTab]}
                    </p>
                  </div>
                )}
              </header>

              <div
                ref={contentScrollRef}
                data-scroll-region=""
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 md:px-10 md:pb-12 md:pt-8"
                aria-busy={contentHydrating || undefined}
              >
                <div
                  className={cn(
                    "mx-auto w-full max-w-[720px]",
                    contentHydrating && "opacity-[0.97]",
                  )}
                >
                  {!showPasskeysSubpage ? (
                    <div className="mb-7">
                      <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.03em] text-[var(--settings-fg)]">
                        {settingsItemLabel(visibleTab)}
                      </h2>
                      <p className="mt-1 max-w-[36rem] text-[14px] leading-5 text-[var(--settings-fg-muted)]">
                        {settingsTabDescriptions[visibleTab]}
                      </p>
                    </div>
                  ) : null}
                  <SettingsTabErrorBoundary tabLabel={visibleTab}>
                    <div key={`${visibleTab}-${securityView}`} className="settings-panel-enter">
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
