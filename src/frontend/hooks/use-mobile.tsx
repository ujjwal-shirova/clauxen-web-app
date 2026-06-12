import * as React from "react";

/** Viewports below this use the drawer nav (no slim rail); matches Tailwind `lg`. */
const MOBILE_NAV_BREAKPOINT = 1024;

const MOBILE_MQ = `(max-width: ${MOBILE_NAV_BREAKPOINT - 1}px)`;

/**
 * True for narrow viewports (drawer / touch layout). Before the first client
 * measurement, returns true so we default to the mobile drawer (collapsed rail)
 * and avoid a flash of the desktop-expanded sidebar on phones.
 */
export function useIsMobile() {
  const [matches, setMatches] = React.useState<boolean | null>(null);

  React.useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_MQ);
    const sync = () => {
      setMatches(mql.matches);
    };
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return matches === null ? true : matches;
}
