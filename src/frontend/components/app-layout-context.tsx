"use client";

import { createContext, useContext } from "react";

export type AppLayoutContextValue = {
  isMobile: boolean;
  isSidebarCollapsed: boolean;
  openMobileNav: () => void;
  setSidebarCollapsed?: (collapsed: boolean) => void;
};

const AppLayoutContext = createContext<AppLayoutContextValue | null>(null);

export function AppLayoutProvider({
  value,
  children,
}: {
  value: AppLayoutContextValue;
  children: React.ReactNode;
}) {
  return (
    <AppLayoutContext.Provider value={value}>{children}</AppLayoutContext.Provider>
  );
}

export function useAppLayout(): AppLayoutContextValue {
  return (
    useContext(AppLayoutContext) ?? {
      isMobile: false,
      isSidebarCollapsed: true,
      openMobileNav: () => {},
    }
  );
}
