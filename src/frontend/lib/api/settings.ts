import { apiFetch } from "@/frontend/lib/api/client";

export type GeneralSettings = {
  colorMode: string;
  chatFont: string;
  appearancePreset: string;
  contrastMode: string;
  accentColor: string;
  language: string;
  spokenLanguage: string;
  voice: string;
  voiceIsolation: boolean;
  dictationEnabled: boolean;
  toolMode: string;
  motion: string;
  voiceSpeed: string;
  followUpSuggestions: boolean;
};

export type PersonalizationSettings = {
  personality: string;
  baseStyleTone: string;
  characteristicWarm: string;
  characteristicEnthusiastic: string;
  characteristicHeadersLists: string;
  characteristicEmoji: string;
  fastAnswers: boolean;
  customInstructions: string;
  fullName: string;
  nickname: string;
  occupation: string;
  moreAboutYou: string;
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  referenceRecordHistory: boolean;
  /** Advanced: allow automatic web search during chats. */
  webSearch: boolean;
};

export type NotificationSettings = {
  desktopAlerts: boolean;
  soundEffects: boolean;
  responseCompletions: boolean;
  codexChannel: string;
  responseChannel: string;
  groupChatChannel: string;
  tasksChannel: string;
  projectsChannel: string;
  recommendationsChannel: string;
  usageChannel: string;
};

export type PrivacySettings = {
  locationMetadata: boolean;
  helpImproveModels: boolean;
};

export type CapabilitiesSettings = {
  generateMemory: boolean;
  connectorSearch: boolean;
  switchModelsWhenFlagged: boolean;
  artifacts: boolean;
  aiPoweredArtifacts: boolean;
  inlineVisualizations: boolean;
  codeExecution: boolean;
  networkEgress: boolean;
};

export type TimeAndFocusSettings = {
  breakReminder: string;
  breakSnooze: string;
  quietHours: string;
  quietDays: boolean[];
};

export type ReflectSettings = {
  range: string;
};

export type SafetySettings = {
  reduceSensitiveContent: boolean;
  mfaEnabled: boolean;
};

export type ClawDeployment = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  kind?: "persistent" | "on-demand" | "linked";
  endpoint?: string;
  webUiUrl?: string;
  terminalUrl?: string;
  fileManagerUrl?: string;
  gatewayWsUrl?: string;
  sandboxId?: string;
  model?: string;
  idleTimeoutSeconds?: number;
};

export type AppSettings = {
  general: GeneralSettings;
  personalization: PersonalizationSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  capabilities: CapabilitiesSettings;
  timeAndFocus: TimeAndFocusSettings;
  reflect: ReflectSettings;
  safety: SafetySettings;
  claw: { deployments: ClawDeployment[] };
};

export async function getSettings() {
  return apiFetch<AppSettings>("/api/v1/settings");
}

export async function updateSettings(patch: {
  general?: Partial<GeneralSettings>;
  personalization?: Partial<PersonalizationSettings>;
  notifications?: Partial<NotificationSettings>;
  privacy?: Partial<PrivacySettings>;
  capabilities?: Partial<CapabilitiesSettings>;
  timeAndFocus?: Partial<TimeAndFocusSettings>;
  reflect?: Partial<ReflectSettings>;
  safety?: Partial<SafetySettings>;
  claw?: Partial<{ deployments: ClawDeployment[] }>;
}) {
  return apiFetch<AppSettings>("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
