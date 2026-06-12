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
};

export type PersonalizationSettings = {
  baseStyleTone: string;
  characteristicWarm: string;
  characteristicEnthusiastic: string;
  characteristicHeadersLists: string;
  characteristicEmoji: string;
  fastAnswers: boolean;
  customInstructions: string;
  nickname: string;
  occupation: string;
  moreAboutYou: string;
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  referenceRecordHistory: boolean;
};

export type NotificationSettings = {
  desktopAlerts: boolean;
  soundEffects: boolean;
  codexChannel: string;
  responseChannel: string;
  groupChatChannel: string;
  tasksChannel: string;
  projectsChannel: string;
  recommendationsChannel: string;
  usageChannel: string;
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
  claw: { deployments: ClawDeployment[] };
};

export async function getSettings() {
  return apiFetch<AppSettings>("/api/v1/settings");
}

export async function updateSettings(patch: {
  general?: Partial<GeneralSettings>;
  personalization?: Partial<PersonalizationSettings>;
  notifications?: Partial<NotificationSettings>;
  claw?: Partial<{ deployments: ClawDeployment[] }>;
}) {
  return apiFetch<AppSettings>("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
