/** @deprecated Import from `@/lib/model-catalog` instead. */
export {
  type ChatModelId,
  type ChatModelOption,
  CHAT_MODEL_OPTIONS,
  CHAT_MODEL_VERSION,
  DEFAULT_CHAT_MODEL_ID,
  formatChatModelVersionLabel,
  parseChatModelId,
  getChatModelOption,
  resolveOpenAiModelId,
} from "@/lib/model-catalog";

import { MODEL_CONFIG } from "@/lib/model-config";

/** @deprecated Use resolveModelRuntime("homer").modelSlug */
export const HOMER_OPENAI_MODEL = MODEL_CONFIG.models.homer.defaultSlug;
/** @deprecated Use resolveModelRuntime("helios").modelSlug */
export const HELIOS_OPENAI_MODEL = MODEL_CONFIG.models.helios.defaultSlug;
