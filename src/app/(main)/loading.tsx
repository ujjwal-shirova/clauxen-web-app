/**
 * Soft loading fallback inside the main panel during RSC transitions.
 * Does not render outer shell or sidebar chrome (MainLayout already provides those).
 */
export default function MainLoading() {
  return (
    <div className="app-page-surface flex h-full w-full min-h-0 flex-1 overflow-hidden">
      <AppContentLoader label="Loading page" />
    </div>
  );
}
import { AppContentLoader } from "@/components/app-content-loader";
