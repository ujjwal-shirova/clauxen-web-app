"use client";

import React, { useCallback, useEffect, useState } from "react"; // React hooks — list state, API refresh, mobile pane
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import { Search, Plus, ChevronRight, Loader2 } from "lucide-react"; // icons — search/add affordances, list chevron, loading spinner
import * as customizeApi from "@/lib/api/customize"; // customize API — listConnectors, connectConnector, disconnectConnector
import type { ApiConnector } from "@/lib/api/customize"; // ApiConnector — server-installed connector row shape
import { useAuth } from "@/hooks/use-auth";
import { CustomizeMobileHeader } from "../customize-mobile-header";
import { useIsMobile } from "@/hooks/use-mobile"; // useIsMobile — list/detail split layout breakpoint

// static catalog — built-in connector definitions (id, name, brand SVG icons)
const connectorItems = [
  {
    id: "github",
    name: "GitHub",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.00536 1.4C4.35271 1.4 1.3999 4.42499 1.3999 8.16731C1.3999 11.1587 3.29187 13.6909 5.91653 14.5872C6.24468 14.6545 6.36488 14.4415 6.36488 14.2624C6.36488 14.1055 6.35407 13.5677 6.35407 13.0074C4.51659 13.4109 4.13395 12.2007 4.13395 12.2007C3.83865 11.4164 3.40112 11.2148 3.40112 11.2148C2.79971 10.8003 3.44493 10.8003 3.44493 10.8003C4.11204 10.8451 4.4621 11.4949 4.4621 11.4949C5.05255 12.5256 6.00401 12.2344 6.38679 12.0551C6.44141 11.6181 6.61651 11.3156 6.80242 11.1476C5.33689 10.9907 3.79498 10.4081 3.79498 7.80871C3.79498 7.06924 4.05728 6.46424 4.47291 5.99372C4.40734 5.8257 4.17762 5.13091 4.53863 4.201C4.53863 4.201 5.09636 4.0217 6.35393 4.89565C6.89234 4.74752 7.4476 4.67216 8.00536 4.67153C8.5631 4.67153 9.13165 4.75004 9.65666 4.89565C10.9144 4.0217 11.4721 4.201 11.4721 4.201C11.8331 5.13091 11.6033 5.8257 11.5377 5.99372C11.9643 6.46424 12.2157 7.06924 12.2157 7.80871C12.2157 10.4081 10.6738 10.9794 9.19736 11.1476C9.43803 11.3605 9.64571 11.7637 9.64571 12.4024C9.64571 13.3099 9.63489 14.0383 9.63489 14.2622C9.63489 14.4415 9.75523 14.6545 10.0832 14.5873C12.7079 13.6908 14.5999 11.1587 14.5999 8.16731C14.6107 4.42499 11.6471 1.4 8.00536 1.4Z"
        />
      </svg>
    ),
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1.95455 13.2527H4.18182V7.84362L1 5.45725V12.2982C1 12.8263 1.42795 13.2527 1.95455 13.2527Z"
          fill="#4285F4"
        />
        <path
          d="M11.8184 13.2527H14.0456C14.5738 13.2527 15.0002 12.8248 15.0002 12.2982V5.45725L11.8184 7.84362"
          fill="#34A853"
        />
        <path
          d="M11.8184 3.70725V7.84362L15.0002 5.45725V4.18453C15.0002 3.00407 13.6527 2.33112 12.7093 3.03907"
          fill="#FBBC04"
        />
        <path
          d="M4.18164 7.84362V3.70725L7.99982 6.57089L11.818 3.70725V7.84362L7.99982 10.7073"
          fill="#EA4335"
        />
        <path
          d="M1 4.18453V5.45725L4.18182 7.84362V3.70725L3.29091 3.03907C2.34591 2.33112 1 3.00407 1 4.18453Z"
          fill="#C5221F"
        />
      </svg>
    ),
  },
  {
    id: "calendar",
    name: "Google Calendar",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M11.4211 4.57892L8.34215 4.23682L4.57898 4.57892L4.23682 8L4.57891 11.4211L7.99999 11.8487L11.4211 11.4211L11.7632 7.91452L11.4211 4.57892Z"
          fill="white"
        />
        <path
          d="M5.98255 9.88669C5.72684 9.71392 5.54978 9.46166 5.45312 9.12808L6.0467 8.88348C6.10059 9.08875 6.19464 9.24781 6.32893 9.36071C6.46238 9.47362 6.62488 9.52919 6.81474 9.52919C7.0089 9.52919 7.17569 9.47017 7.31505 9.35213C7.45441 9.23409 7.52461 9.08355 7.52461 8.90142C7.52461 8.715 7.45103 8.56271 7.30393 8.44473C7.15684 8.32676 6.97211 8.26767 6.75143 8.26767H6.40849V7.68014H6.71633C6.9062 7.68014 7.06617 7.62885 7.19617 7.52622C7.32617 7.42358 7.39117 7.28331 7.39117 7.10456C7.39117 6.94551 7.33299 6.81889 7.2167 6.72399C7.10042 6.62909 6.95326 6.58118 6.77451 6.58118C6.60005 6.58118 6.46147 6.6274 6.35883 6.72061C6.2562 6.81382 6.18177 6.92841 6.13478 7.06355L5.54724 6.81895C5.62505 6.59828 5.76792 6.40328 5.97742 6.2348C6.18698 6.06632 6.45464 5.98162 6.77964 5.98162C7.01995 5.98162 7.23633 6.02784 7.42795 6.12105C7.61951 6.21426 7.77005 6.34341 7.87867 6.5076C7.98728 6.67264 8.04117 6.85743 8.04117 7.06264C8.04117 7.2722 7.99072 7.44919 7.88978 7.5946C7.78883 7.74 7.66481 7.85115 7.51772 7.92902V7.96406C7.71187 8.04531 7.87008 8.16933 7.99495 8.33612C8.11897 8.50291 8.18137 8.7022 8.18137 8.93483C8.18137 9.16747 8.12235 9.37527 8.00431 9.55747C7.88627 9.73966 7.72292 9.88331 7.51596 9.98764C7.30816 10.092 7.07468 10.145 6.81552 10.145C6.51535 10.1458 6.23826 10.0595 5.98255 9.88669Z"
          fill="#1A73E8"
        />
        <path
          d="M9.62503 6.94121L8.97672 7.41246L8.65088 6.91814L9.82003 6.07483H10.2682V10.0526H9.62503V6.94121Z"
          fill="#1A73E8"
        />
        <path
          d="M11.421 14.5L14.4999 11.4211L12.9605 10.7369L11.421 11.4211L10.7368 12.9605L11.421 14.5Z"
          fill="#EA4335"
        />
        <path
          d="M3.89453 12.9605L4.57872 14.5H11.4208V11.4211H4.57872L3.89453 12.9605Z"
          fill="#34A853"
        />
        <path
          d="M2.52628 1.5C1.95929 1.5 1.5 1.95929 1.5 2.52628V11.421L3.03946 12.1052L4.57892 11.421V4.57892H11.421L12.1052 3.03946L11.4211 1.5H2.52628Z"
          fill="#4285F4"
        />
        <path
          d="M1.5 11.4211V13.4737C1.5 14.0408 1.95929 14.5 2.52628 14.5H4.57892V11.4211H1.5Z"
          fill="#188038"
        />
        <path
          d="M11.4209 4.57892V11.421H14.4998V4.57892L12.9604 3.89473L11.4209 4.57892Z"
          fill="#FBBC04"
        />
        <path
          d="M14.4998 4.57892V2.52628C14.4998 1.95922 14.0405 1.5 13.4735 1.5H11.4209V4.57892H14.4998Z"
          fill="#1967D2"
        />
      </svg>
    ),
  },
  {
    id: "drive",
    name: "Google Drive",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1.84624 12.6235L2.48571 13.728C2.61858 13.9605 2.80959 14.1432 3.03382 14.2761L5.31765 10.3231H0.75C0.75 10.5805 0.816439 10.8379 0.949316 11.0705L1.84624 12.6235Z"
          fill="#0066DA"
        />
        <path
          d="M8.00011 5.67238L5.71628 1.71931C5.49205 1.85219 5.30104 2.0349 5.16816 2.26743L0.949316 9.57562C0.818882 9.80314 0.750174 10.0608 0.75 10.3231H5.31765L8.00011 5.67238Z"
          fill="#00AC47"
        />
        <path
          d="M12.9663 14.2761C13.1905 14.1432 13.3815 13.9605 13.5144 13.728L13.7802 13.2712L15.0508 11.0705C15.1837 10.8379 15.2501 10.5805 15.2501 10.3231H10.6821L11.6541 12.2331L12.9663 14.2761Z"
          fill="#EA4335"
        />
        <path
          d="M8.00013 5.67238L10.284 1.71931C10.0597 1.58643 9.80228 1.52 9.53652 1.52H6.46374C6.19799 1.52 5.94054 1.59474 5.71631 1.71931L8.00013 5.67238Z"
          fill="#00832D"
        />
        <path
          d="M10.6824 10.3231H5.31752L3.03369 14.2761C3.25792 14.409 3.51537 14.4754 3.78112 14.4754H12.2188C12.4846 14.4754 12.742 14.4007 12.9663 14.2761L10.6824 10.3231Z"
          fill="#2684FC"
        />
        <path
          d="M12.9414 5.92153L10.8319 2.26743C10.6991 2.0349 10.5081 1.85219 10.2838 1.71931L8 5.67238L10.6825 10.3231H15.2418C15.2418 10.0656 15.1754 9.80816 15.0425 9.57562L12.9414 5.92153Z"
          fill="#FFBA00"
        />
      </svg>
    ),
  },
];

const allowedConnectorIds = new Set(connectorItems.map((c) => c.id));

function ConnectorListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: (typeof connectorItems)[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect} // parent handleSelectConnector — id set + mobilePane detail
      className={cn(
        "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-all",
        isSelected ? "bg-zinc-100" : "hover:bg-zinc-100",
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-black/5 bg-white shadow-sm">
        {item.icon}
      </div>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-zinc-800">
        {item.name}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 md:hidden" />
    </button>
  );
}

interface ConnectorsViewProps {
  onMobileDetailChange?: (inDetail: boolean) => void;
}

export function ConnectorsView({ onMobileDetailChange }: ConnectorsViewProps) {
  const auth = useAuth();
  const isMobile = useIsMobile(); // breakpoint — single-pane list vs detail
  const [selectedConnector, setSelectedConnector] = useState<string | null>(
    connectorItems[0].id,
  );
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list"); // mobile navigation stack
  const [installed, setInstalled] = useState<ApiConnector[]>([]); // server-side installed connectors
  const [loading, setLoading] = useState(false); // list fetch in-flight
  const [connecting, setConnecting] = useState(false); // connect/disconnect button in-flight

  const refresh = useCallback(async () => {
    if (!auth.isAuthenticated) return; // guest — API call skip
    setLoading(true);
    try {
      const { connectors } = await customizeApi.listConnectors(); // GET installed rows
      setInstalled(connectors);
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentConnector = connectorItems.find(
    (c) => c.id === selectedConnector,
  ); // catalog metadata for detail pane
  const isConnected = installed.some(
    (c) => c.connectorId === selectedConnector,
  ); // OAuth/install status

  const handleSelectConnector = useCallback(
    (id: string) => {
      setSelectedConnector(id);
      if (isMobile) setMobilePane("detail");
    },
    [isMobile],
  );

  const handleConnect = async () => {
    if (!selectedConnector || !auth.isAuthenticated) return;
    if (!allowedConnectorIds.has(selectedConnector)) return;
    setConnecting(true);
    try {
      if (isConnected) {
        const { connectors } =
          await customizeApi.disconnectConnector(selectedConnector);
        setInstalled(connectors); // optimistic list replace from API response
      } else {
        const { connectors } =
          await customizeApi.connectConnector(selectedConnector);
        setInstalled(connectors);
      }
    } finally {
      setConnecting(false);
    }
  };

  const connectedItems = connectorItems.filter((c) =>
    installed.some((i) => i.connectorId === c.id),
  ); // Connected section rows
  const notConnectedItems = connectorItems.filter(
    (c) => !installed.some((i) => i.connectorId === c.id),
  ); // Not connected section rows

  const showList = !isMobile || mobilePane === "list";
  const showDetail = !isMobile || mobilePane === "detail";

  useEffect(() => {
    onMobileDetailChange?.(isMobile && mobilePane === "detail");
  }, [isMobile, mobilePane, onMobileDetailChange]);

  const listPanel = (
    <div className="flex h-full w-full min-w-0 shrink-0 flex-col bg-zinc-50 md:w-[320px] md:border-r md:border-zinc-200">
      <div className="flex min-h-[52px] shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <h2 className="text-[16px] font-semibold text-zinc-900">Connectors</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100"
            aria-label="Search connectors"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-all hover:bg-zinc-100"
            aria-label="Add connector"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {connectedItems.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] font-semibold uppercase tracking-tight text-zinc-500">
                  <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                  <span>Connected</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {connectedItems.map((item) => (
                    <ConnectorListItem
                      key={item.id}
                      item={item}
                      isSelected={selectedConnector === item.id}
                      onSelect={() => handleSelectConnector(item.id)}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] font-semibold uppercase tracking-tight text-zinc-500">
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
              <span>Not connected</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {notConnectedItems.map((item) => (
                <ConnectorListItem
                  key={item.id}
                  item={item}
                  isSelected={selectedConnector === item.id}
                  onSelect={() => handleSelectConnector(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const detailPanel = (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {isMobile && showDetail && currentConnector && (
        <CustomizeMobileHeader
          title={currentConnector.name}
          onBack={() => setMobilePane("list")}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[672px] p-4 pt-6 sm:p-8 sm:pt-12">
          {currentConnector ? (
            <div className="flex animate-in flex-col gap-5 duration-500 fade-in sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-zinc-50 shadow-sm sm:h-12 sm:w-12">
                  {currentConnector.icon}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate font-serif text-[20px] font-medium text-zinc-900 sm:text-[24px]">
                    {currentConnector.name}
                  </h1>
                  <p className="text-[13px] text-zinc-500 sm:text-[14px]">
                    {isConnected ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center sm:p-12">
                <p className="mb-5 text-[14px] text-zinc-500 sm:mb-6">
                  {isConnected
                    ? "Clauxen can use this connector in your chats."
                    : "Connect to give Clauxen more context."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting || !auth.isAuthenticated}
                  className={cn(appBtn.primaryLgAuto, "max-w-xs sm:px-8")}
                >
                  {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isConnected
                    ? "Disconnect"
                    : `Connect ${currentConnector.name}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[14px] text-zinc-500">
                Select a connector to view details.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <div
        className={cn(
          "min-h-0 min-w-0",
          isMobile
            ? showList
              ? "flex flex-1 flex-col"
              : "hidden"
            : "flex shrink-0",
        )}
      >
        {listPanel}
      </div>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isMobile && !showDetail && "hidden",
        )}
      >
        {detailPanel}
      </div>
    </div>
  );
}
