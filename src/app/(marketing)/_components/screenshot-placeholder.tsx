import styles from "../marketing.module.css";

/** Replace this image slot with a real product capture when screenshots are ready. */
export function ScreenshotPlaceholder({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.screenshotSlot} ${compact ? styles.compactSlot : ""}`}
      role="img"
      aria-label={`${label}: screenshot placeholder`}
    >
      <div className={styles.slotMark} aria-hidden="true">
        ↗
      </div>
      <span>{label}</span>
      <small>Product screenshot</small>
    </div>
  );
}
