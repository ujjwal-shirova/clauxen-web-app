/**
 * Copied from Clauxen Code CLI `src/utils/format.ts` (formatDuration only).
 * Pure display formatter — no Ink / intl deps.
 */
export function formatDuration(
  ms: number,
  options?: { hideTrailingZeros?: boolean; mostSignificantOnly?: boolean },
): string {
  if (ms < 60000) {
    if (ms === 0) {
      return "0s";
    }
    if (ms < 1) {
      const s = (ms / 1000).toFixed(1);
      return `${s}s`;
    }
    const s = Math.floor(ms / 1000).toString();
    return `${s}s`;
  }

  let days = Math.floor(ms / 86400000);
  let hours = Math.floor((ms % 86400000) / 3600000);
  let minutes = Math.floor((ms % 3600000) / 60000);
  let seconds = Math.round((ms % 60000) / 1000);

  if (seconds === 60) {
    seconds = 0;
    minutes++;
  }
  if (minutes === 60) {
    minutes = 0;
    hours++;
  }
  if (hours === 24) {
    hours = 0;
    days++;
  }

  const hide = options?.hideTrailingZeros;

  if (options?.mostSignificantOnly) {
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  if (days > 0) {
    if (hide && hours === 0 && minutes === 0) return `${days}d`;
    if (hide && minutes === 0) return `${days}d ${hours}h`;
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    if (hide && minutes === 0 && seconds === 0) return `${hours}h`;
    if (hide && seconds === 0) return `${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    if (hide && seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
