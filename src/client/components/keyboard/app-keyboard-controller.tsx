"use client";

import * as React from "react";

import { ShortcutsHelpDialog } from "@/components/keyboard/shortcuts-help-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  copyLastCodeBlock,
  isEditableTarget,
  isModalOpen,
  moveListFocus,
  scrollByLines,
  scrollByPage,
  scrollToEdge,
} from "@/lib/keyboard-navigation";
import {
  anyComboMatches,
  eventKeyToken,
  type KeyboardShortcut,
  type KeyboardShortcutId,
} from "@/lib/keyboard-shortcuts-defaults";
import { KS_EVENTS } from "@/lib/keyboard-shortcut-events";
import { APP_ROUTES } from "@/lib/app-routes";
import type { SettingsTab } from "@/components/settings/constants";

/** ms a `g` prefix stays armed waiting for its second key. */
const SEQUENCE_TIMEOUT_MS = 1400;

const SEQUENCE_ROUTES: Record<string, string> = {
  c: APP_ROUTES.newChat,
  l: APP_ROUTES.library,
  p: APP_ROUTES.projects,
  m: APP_ROUTES.myClauxen,
};

function comboHasPrimaryModifier(keys: string[]): boolean {
  return keys.some((token) => {
    const lower = token.trim().toLowerCase();
    return (
      lower === "meta" ||
      lower === "cmd" ||
      lower === "command" ||
      lower === "ctrl" ||
      lower === "control"
    );
  });
}

function isInsidePopup(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      '[role="listbox"], [role="menu"], [role="menuitem"], [role="option"], [role="radiogroup"], [role="slider"], [role="spinbutton"], [role="tablist"], [role="tab"], [role="combobox"], [role="grid"], [role="tree"], [data-radix-popper-content-wrapper], select',
    ),
  );
}

export type AppKeyboardControllerProps = {
  /** Start a new chat (same flow as the sidebar button). */
  onNewChat: () => void;
  /** Collapse / expand the sidebar. */
  onToggleSidebar: () => void;
  /** Open the settings overlay on a tab. */
  onOpenSettings: (tab?: SettingsTab) => void;
  /** Route push that keeps the shell mounted. */
  onNavigate: (path: string) => void;
  /** True while a product overlay (settings/pricing/gift) is open. */
  overlayOpen: boolean;
  /** Close the open product overlay (Esc). */
  onCloseOverlay: () => void;
};

/**
 * Global keyboard engine. One window listener drives every app-wide shortcut,
 * list movement, keyboard scrolling and the shortcuts help dialog.
 */
export function AppKeyboardController({
  onNewChat,
  onToggleSidebar,
  onOpenSettings,
  onNavigate,
  overlayOpen,
  onCloseOverlay,
}: AppKeyboardControllerProps) {
  const [helpOpen, setHelpOpen] = React.useState(false);
  const { shortcuts } = useKeyboardShortcuts();
  const sequenceRef = React.useRef<{ key: string; at: number } | null>(null);

  const actionsRef = React.useRef({
    onNewChat,
    onToggleSidebar,
    onOpenSettings,
    onNavigate,
    overlayOpen,
    onCloseOverlay,
  });
  actionsRef.current = {
    onNewChat,
    onToggleSidebar,
    onOpenSettings,
    onNavigate,
    overlayOpen,
    onCloseOverlay,
  };

  const shortcutsRef = React.useRef<KeyboardShortcut[]>(shortcuts);
  shortcutsRef.current = shortcuts;
  const helpOpenRef = React.useRef(helpOpen);
  helpOpenRef.current = helpOpen;

  const runShortcutAction = React.useCallback((id: KeyboardShortcutId) => {
    const actions = actionsRef.current;
    switch (id) {
      case "openNewChat":
        actions.onNewChat();
        return true;
      case "searchChats":
        window.dispatchEvent(new CustomEvent(KS_EVENTS.openChatSearch));
        return true;
      case "toggleSidebar":
        actions.onToggleSidebar();
        return true;
      case "openSettings":
        actions.onOpenSettings("General");
        return true;
      case "showShortcuts":
        setHelpOpen((open) => !open);
        return true;
      case "setCustomInstructions":
        actions.onOpenSettings("Personalization");
        return true;
      case "copyLastCodeBlock":
        return copyLastCodeBlock();
      case "deleteChat":
        window.dispatchEvent(new CustomEvent(KS_EVENTS.deleteActiveChat));
        return true;
      case "focusComposer":
        window.dispatchEvent(new CustomEvent(KS_EVENTS.focusComposer));
        return true;
      case "toggleDevMode":
        document.documentElement.classList.toggle("cx-dev-mode");
        return true;
      default:
        return false;
    }
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const token = eventKeyToken(event);
      const editable = isEditableTarget(event.target);
      const modal = isModalOpen();
      const popup = isInsidePopup(event.target);
      const actions = actionsRef.current;

      /* ---- Escape: close overlay / blur composer ---- */
      if (token === "escape" && !event.metaKey && !event.ctrlKey) {
        if (actions.overlayOpen) {
          event.preventDefault();
          actions.onCloseOverlay();
          return;
        }
        if (!modal && document.activeElement instanceof HTMLElement) {
          const active = document.activeElement;
          if (
            active.closest("[data-prompt-shell]") &&
            active.tagName === "TEXTAREA"
          ) {
            event.preventDefault();
            active.blur();
          }
        }
        return;
      }

      /* ---- Remappable app shortcuts ---- */
      if (!event.repeat) {
        for (const shortcut of shortcutsRef.current) {
          if (!shortcut.enabled) continue;
          const combos = [shortcut.keys, ...(shortcut.extraKeys ?? [])].filter(
            (combo): combo is string[] => Array.isArray(combo) && combo.length > 0,
          );
          if (!anyComboMatches(combos, event)) continue;

          const needsModifier = comboHasPrimaryModifier(shortcut.keys);
          // Single-key shortcuts never hijack typing or open dialogs.
          if ((editable || modal || popup) && !needsModifier) continue;

          event.preventDefault();
          runShortcutAction(shortcut.id);
          return;
        }
      }

      // Typing and widget keys (menus, selects, sliders, tabs) keep their
      // native behavior.
      if (editable || popup) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      /* ---- `g` sequences: g c / g l / g p / g m (page level only) ---- */
      if (!modal) {
        if (token === "g") {
          sequenceRef.current = { key: "g", at: Date.now() };
          event.preventDefault();
          return;
        }
        const sequence = sequenceRef.current;
        if (
          sequence &&
          sequence.key === "g" &&
          Date.now() - sequence.at <= SEQUENCE_TIMEOUT_MS &&
          !event.repeat
        ) {
          sequenceRef.current = null;
          const route = SEQUENCE_ROUTES[token];
          if (route) {
            event.preventDefault();
            actions.onNavigate(route);
            return;
          }
          // Unknown follow-up key — fall through so j/k/scroll still work.
        }
      }
      sequenceRef.current = null;

      /* ---- List movement + keyboard scrolling (scrolling also works
             inside overlays and dialogs) ---- */
      switch (token) {
        case "j":
          if (modal) return;
          event.preventDefault();
          if (!moveListFocus(1)) scrollByLines(4);
          return;
        case "k":
          if (modal) return;
          event.preventDefault();
          if (!moveListFocus(-1)) scrollByLines(-4);
          return;
        case "arrowdown":
          event.preventDefault();
          if (!moveListFocus(1)) scrollByLines(3);
          return;
        case "arrowup":
          event.preventDefault();
          if (!moveListFocus(-1)) scrollByLines(-3);
          return;
        case "arrowleft":
        case "arrowright": {
          // Horizontal movement between nav items in a row (e.g. sidebar nav).
          const moved = moveListFocus(token === "arrowright" ? 1 : -1);
          if (moved) event.preventDefault();
          return;
        }
        case "pagedown":
          event.preventDefault();
          scrollByPage(1);
          return;
        case "pageup":
          event.preventDefault();
          scrollByPage(-1);
          return;
        case "home":
          event.preventDefault();
          scrollToEdge("top");
          return;
        case "end":
          event.preventDefault();
          scrollToEdge("bottom");
          return;
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runShortcutAction]);

  // External openers (e.g. the sidebar "Keyboard shortcuts" menu item).
  React.useEffect(() => {
    const openHelp = () => setHelpOpen(true);
    window.addEventListener(KS_EVENTS.openShortcutsHelp, openHelp);
    return () => window.removeEventListener(KS_EVENTS.openShortcutsHelp, openHelp);
  }, []);

  return <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}
