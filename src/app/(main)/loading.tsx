/**
 * Soft loading fallback inside the main panel during RSC transitions.
 * Does not render outer shell or sidebar chrome (MainLayout already provides those).
 */
export default function MainLoading() {
  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col items-center justify-center">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-200" />
    </div>
  );
}
