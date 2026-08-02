import {
  appMainShellClassName,
  appShellRootClassName,
} from "@/lib/app-shell-layout";

/**
 * Instant shell for `/c/*` (and other main routes that suspend) so the
 * document is not withheld while chat seed / RSC children resolve.
 */
export default function MainLoading() {
  return (
    <div className={appShellRootClassName(false)} data-app-boot-shell="">
      <div
        className="hidden w-[var(--sidebar-width,256px)] shrink-0 border-r border-zinc-200/80 bg-[var(--app-shell-bg,#fafafa)] md:block dark:border-zinc-800"
        aria-hidden
      />
      <div className={appMainShellClassName({ isMobile: false })}>
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="h-10 shrink-0" />
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
