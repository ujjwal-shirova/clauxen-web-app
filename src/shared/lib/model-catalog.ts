/**
 * Product model catalog — single source of truth for the one visible chat model.
 * Legacy IDs are still parsed for old persisted chats, but the UI exposes Virgil only.
 */

import { MODEL_CONFIG, normalizeUpstreamModelSlug, type ConfiguredModelId } from "./model-config";

export type ChatModelId = ConfiguredModelId;

export type InferenceProviderKind = "openai";

export type ModelCatalogEntry = {
  id: ChatModelId;
  label: string;
  shortLabel: string;
  description: string;
  provider: InferenceProviderKind;
  /** Default upstream model id */
  defaultModelSlug: string;
  /** Env var for model slug override */
  modelEnvKey: string;
  /** Env var for API base URL override */
  baseUrlEnvKey: string;
  /** Fallback base URL when env override is unset (server resolves Provider_BASE_URL) */
  defaultBaseUrl: string;
  available: boolean;
  requiresUpgrade?: boolean;
};

export const MODEL_CATALOG: readonly ModelCatalogEntry[] = [
  {
    id: "virgil",
    label: MODEL_CONFIG.metadata.virgil.label,
    shortLabel: MODEL_CONFIG.metadata.virgil.shortLabel,
    description: MODEL_CONFIG.metadata.virgil.description,
    provider: "openai",
    defaultModelSlug: MODEL_CONFIG.models.virgil.defaultSlug,
    modelEnvKey: MODEL_CONFIG.providerEnv.modelClauxenV1,
    baseUrlEnvKey: MODEL_CONFIG.providerEnv.baseUrl,
    defaultBaseUrl: "",
    available: MODEL_CONFIG.metadata.virgil.available,
    requiresUpgrade: MODEL_CONFIG.metadata.virgil.requiresUpgrade,
  },
] as const;

export const DEFAULT_CHAT_MODEL_ID: ChatModelId = MODEL_CONFIG.defaultModelId;

/** Shared product version shown wherever model identity is surfaced. */
export const CHAT_MODEL_VERSION = "1.1";

export type ModelRuntimeConfig = {
  id: ChatModelId;
  label: string;
  provider: InferenceProviderKind;
  modelSlug: string;
  baseUrl: string;
};

export type ModelCatalogEnv = {
  novitaOpenAiBaseUrl: string;
  homerModel: string;
  heliosModel: string;
  virgilModel: string;
  thinkingModel: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function readEnvOverride(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function readProviderModel(): string | undefined {
  return (
    readEnvOverride(MODEL_CONFIG.providerEnv.modelClauxenV1) ||
    readEnvOverride("SHIROVA_DEFAULT_MODEL")
  );
}

function readProviderBaseUrl(): string | undefined {
  return (
    readEnvOverride(MODEL_CONFIG.providerEnv.baseUrl) ||
    readEnvOverride("NOVITA_OPENAI_BASE_URL") ||
    readEnvOverride("LLM_BASE_URL")
  );
}

function modelSlugForEntry(
  entry: ModelCatalogEntry,
  env: ModelCatalogEnv,
): string {
  const fromProvider = readProviderModel();
  const fromEnv = readEnvOverride(entry.modelEnvKey);
  const raw =
    fromProvider ??
    fromEnv ??
    (entry.id === "homer"
      ? env.homerModel
      : entry.id === "helios"
        ? env.heliosModel
        : env.virgilModel);
  return normalizeUpstreamModelSlug(raw, entry.defaultModelSlug);
}

function baseUrlForEntry(
  entry: ModelCatalogEntry,
  env: ModelCatalogEnv,
): string {
  const fromEnv = readEnvOverride(entry.baseUrlEnvKey) || readProviderBaseUrl();
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return normalizeBaseUrl(env.novitaOpenAiBaseUrl || entry.defaultBaseUrl);
}

export function getCatalogEntry(id: ChatModelId): ModelCatalogEntry {
  return (
    MODEL_CATALOG.find((entry) => entry.id === id) ??
    MODEL_CATALOG.find((entry) => entry.id === DEFAULT_CHAT_MODEL_ID)!
  );
}

export function parseChatModelId(value?: string | null): ChatModelId {
  if (value === "homer" || value === "helios" || value === "virgil") {
    return value;
  }
  return DEFAULT_CHAT_MODEL_ID;
}

export function resolveModelRuntime(
  chatModelId: ChatModelId | string | null | undefined,
  env: ModelCatalogEnv,
): ModelRuntimeConfig {
  const entry = getCatalogEntry(parseChatModelId(chatModelId));
  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    modelSlug: modelSlugForEntry(entry, env),
    baseUrl: baseUrlForEntry(entry, env),
  };
}

/** UI selector options (frontend + API). Never includes secrets or upstream URLs. */
export type ChatModelOption = {
  id: ChatModelId;
  label: string;
  shortLabel: string;
  description: string;
  requiresUpgrade?: boolean;
  available: boolean;
};

export const CHAT_MODEL_OPTIONS: readonly ChatModelOption[] = MODEL_CATALOG.map(
  (entry) => ({
    id: entry.id,
    label: entry.label,
    shortLabel: entry.shortLabel,
    description: entry.description,
    requiresUpgrade: entry.requiresUpgrade,
    available: entry.available,
  }),
);

export function getChatModelOption(id: ChatModelId): ChatModelOption {
  return (
    CHAT_MODEL_OPTIONS.find((option) => option.id === id) ??
    CHAT_MODEL_OPTIONS.find((option) => option.id === DEFAULT_CHAT_MODEL_ID)!
  );
}

/** Collapsed selector label: "Helios 1.1" + effort shown separately in UI. */
export function formatChatModelVersionLabel(label: string): string {
  return `${label} ${CHAT_MODEL_VERSION}`;
}

/** @deprecated Use resolveModelRuntime().modelSlug */
export function resolveOpenAiModelId(
  chatModelId: ChatModelId,
  models: { homerModel: string; heliosModel: string },
): string {
  return resolveModelRuntime(chatModelId, {
    novitaOpenAiBaseUrl: "",
    homerModel: models.homerModel,
    heliosModel: models.heliosModel,
    virgilModel: MODEL_CONFIG.models.virgil.defaultSlug,
    thinkingModel: MODEL_CONFIG.models.thinking.defaultSlug,
  }).modelSlug;
}

export function modelCatalogEnvFromProcess(): ModelCatalogEnv {
  const providerModel =
    readProviderModel() ?? MODEL_CONFIG.models.virgil.defaultSlug;
  const providerBase = readProviderBaseUrl() ?? "";

  return {
    novitaOpenAiBaseUrl: providerBase,
    homerModel: normalizeUpstreamModelSlug(
      providerModel,
      MODEL_CONFIG.models.homer.defaultSlug,
    ),
    heliosModel: normalizeUpstreamModelSlug(
      providerModel,
      MODEL_CONFIG.models.helios.defaultSlug,
    ),
    virgilModel: normalizeUpstreamModelSlug(
      providerModel,
      MODEL_CONFIG.models.virgil.defaultSlug,
    ),
    thinkingModel: normalizeUpstreamModelSlug(
      providerModel,
      MODEL_CONFIG.models.thinking.defaultSlug,
    ),
  };
}
