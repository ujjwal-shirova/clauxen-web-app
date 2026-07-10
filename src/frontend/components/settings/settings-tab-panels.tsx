"use client";

import dynamic from "next/dynamic";
import { SettingsPageSkeleton } from "@/frontend/components/settings/settings-page-skeleton";

function tabLoading() {
  return (
    <div className="py-8">
      <SettingsPageSkeleton />
    </div>
  );
}

export const GeneralSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/general-settings").then(
      (m) => m.GeneralSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const PersonalizationSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/personalization-settings").then(
      (m) => m.PersonalizationSettingsPanel,
    ),
  { ssr: false, loading: tabLoading },
);

export const NotificationsSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/notifications-settings").then(
      (m) => m.NotificationsSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const AccountSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/account-settings").then(
      (m) => m.AccountSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const SecuritySettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/security-settings").then(
      (m) => m.SecuritySettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const PrivacySettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/privacy-settings").then(
      (m) => m.PrivacySettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const BillingSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/billing-settings").then(
      (m) => m.BillingSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const StorageSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/storage-settings").then(
      (m) => m.StorageSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const CapabilitiesSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/capabilities-settings").then(
      (m) => m.CapabilitiesSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const ReflectSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/reflect-settings").then(
      (m) => m.ReflectSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const TimeAndFocusSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/time-and-focus-settings").then(
      (m) => m.TimeAndFocusSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const SafetySettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/safety-settings").then(
      (m) => m.SafetySettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const ParentalControlsSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/parental-controls-settings").then(
      (m) => m.ParentalControlsSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const TrustedContactSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/trusted-contact-settings").then(
      (m) => m.TrustedContactSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const ClauxenCodeSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/clauxen-code-settings").then(
      (m) => m.ClauxenCodeSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const KeyboardSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/keyboard-settings").then(
      (m) => m.KeyboardSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const SkillsSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/skills-settings").then(
      (m) => m.SkillsSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const ConnectorsCatalogSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/plugins-settings").then(
      (m) => m.ConnectorsCatalogSettings,
    ),
  { ssr: false, loading: tabLoading },
);

export const PluginsSettingsPanel = dynamic(
  () =>
    import("@/frontend/components/settings/plugins-settings").then(
      (m) => m.PluginsSettings,
    ),
  { ssr: false, loading: tabLoading },
);
