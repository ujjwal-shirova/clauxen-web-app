import { AppContentLoader } from "@/components/app-content-loader";

export default function PluginsLoading() {
  return (
    <div className="app-page-surface flex h-full min-h-0 w-full flex-1 overflow-hidden">
      <AppContentLoader label="Loading plugins" />
    </div>
  );
}
