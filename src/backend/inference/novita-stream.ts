/** Novita OpenAI-compatible streaming params (see docs.novita.ai). */
export const NOVITA_STREAM_OPTIONS = {
  stream: true as const,
  stream_options: { include_usage: true },
};
