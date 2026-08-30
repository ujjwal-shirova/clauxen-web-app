import { AppContentLoader } from "@/components/app-content-loader";

export function AppRouteLoadingShell({
  label,
}: {
  label: string;
}) {
  return (
    <div
      className="app-page-surface flex h-full min-h-0 w-full flex-1 overflow-hidden bg-[var(--app-panel-bg)]"
      aria-busy="true"
      aria-label={label}
    >
      <AppContentLoader label={label} />
    </div>
  );
}
