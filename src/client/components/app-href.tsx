"use client";

import {
  forwardRef,
  useCallback,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useInstantNavigate } from "@/hooks/use-instant-navigate";
import { cn } from "@/lib/utils";

export type AppHrefProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
  children?: ReactNode;
  /**
   * Soft left-click navigation (history + Next sync) without a full reload.
   * Middle-click / cmd-click / open-in-new-tab always use the real href.
   */
  soft?: boolean;
  replace?: boolean;
};

/** True for an unmodified primary-button click (soft-nav candidate). */
export function isPlainLeftClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return !isPlainLeftClick(event);
}

function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:|javascript:)/i.test(href);
}

/**
 * Plain `<a href>` for the signed-in app. No next/link.
 * Left-click soft-navigates; real href remains for progressive enhancement.
 */
export const AppHref = forwardRef<HTMLAnchorElement, AppHrefProps>(
  function AppHref(
    {
      href,
      soft = true,
      replace = false,
      onClick,
      onPointerEnter,
      onFocus,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const navigate = useInstantNavigate();
    const router = useRouter();

    const prefetchDestination = useCallback(() => {
      if (!soft || isExternalHref(href)) return;
      router.prefetch(href);
    }, [href, router, soft]);

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (!soft || isExternalHref(href) || isModifiedClick(event)) return;
      event.preventDefault();
      navigate(href, { replace });
    };

    return (
      <a
        ref={ref}
        href={href}
        onClick={handleClick}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          prefetchDestination();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          prefetchDestination();
        }}
        className={cn(className)}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
