"use client";

import { Mail } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";

interface ConnectorsSettingsProps {
  onGoToCustomize: (tab: "skills" | "connectors") => void;
}

export function ConnectorsSettings({
  onGoToCustomize,
}: ConnectorsSettingsProps) {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 text-zinc-800">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[14px] leading-snug">
            Connectors have moved to Customize. Head to the new Customize page
            to manage your skills and connectors.
          </p>

          <Button
            variant="outline"
            onClick={() => onGoToCustomize("connectors")}
            className={cn(appBtn.secondarySm, "h-8 shrink-0 px-3 text-[12px]")}
          >
            Go to Customize
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[16px] font-semibold">Connectors</h2>

            <p className="text-[14px] leading-snug text-zinc-500">
              Allow Clauxen to reference other apps and services for more
              context.
            </p>
          </div>
          <Button
            variant="outline"
            className={cn(appBtn.secondary, "h-9 rounded-lg px-4")}
          >
            Browse connectors
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm opacity-50">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.84624 12.6235L2.48571 13.728C2.61858 13.9605 2.80959 14.1432 3.03382 14.2761L5.31765 10.3231H0.75C0.75 10.5805 0.816439 10.8379 0.949316 11.0705L1.84624 12.6235Z"
                    fill="#0066DA"
                  ></path>

                  <path
                    d="M8.00011 5.67238L5.71628 1.71931C5.49205 1.85219 5.30104 2.0349 5.16816 2.26743L0.949316 9.57562C0.818882 9.80314 0.750174 10.0608 0.75 10.3231H5.31765L8.00011 5.67238Z"
                    fill="#00AC47"
                  ></path>

                  <path
                    d="M12.9663 14.2761C13.1905 14.1432 13.3815 13.9605 13.5144 13.728L13.7802 13.2712L15.0508 11.0705C15.1837 10.8379 15.2501 10.5805 15.2501 10.3231H10.6821L11.6541 12.2331L12.9663 14.2761Z"
                    fill="#EA4335"
                  ></path>

                  <path
                    d="M8.00013 5.67238L10.284 1.71931C10.0597 1.58643 9.80228 1.52 9.53652 1.52H6.46374C6.19799 1.52 5.94054 1.59474 5.71631 1.71931L8.00013 5.67238Z"
                    fill="#00832D"
                  ></path>

                  <path
                    d="M10.6824 10.3231H5.31752L3.03369 14.2761C3.25792 14.409 3.51537 14.4754 3.78112 14.4754H12.2188C12.4846 14.4754 12.742 14.4007 12.9663 14.2761L10.6824 10.3231Z"
                    fill="#2684FC"
                  ></path>

                  <path
                    d="M12.9414 5.92153L10.8319 2.26743C10.6991 2.0349 10.5081 1.85219 10.2838 1.71931L8 5.67238L10.6825 10.3231H15.2418C15.2418 10.0656 15.1754 9.80816 15.0425 9.57562L12.9414 5.92153Z"
                    fill="#FFBA00"
                  ></path>
                </svg>
              </div>
              <span className="text-[14px] font-medium opacity-50">
                Google Drive
              </span>
            </div>
            <Button
              variant="outline"
              className="h-9 rounded-lg border-zinc-300 px-4 text-zinc-800 hover:bg-zinc-100"
            >
              Connect
            </Button>
          </div>

          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm opacity-50">
                <Mail className="h-6 w-6 text-[#EA4335]" />
              </div>
              <span className="text-[14px] font-medium opacity-50">Gmail</span>
            </div>
            <Button
              variant="outline"
              className="h-9 rounded-lg border-zinc-300 px-4 text-zinc-800 hover:bg-zinc-100"
            >
              Connect
            </Button>
          </div>

          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm opacity-50">
                <svg
                  className="h-6 w-6 text-[#333]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49v-1.72c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.99c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.77c0 .27.18.59.69.49A10.09 10.09 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
                </svg>
              </div>
              <span className="text-[14px] font-medium opacity-50">GitHub</span>
            </div>
            <Button
              variant="outline"
              className="h-9 rounded-lg border-zinc-300 px-4 text-zinc-800 hover:bg-zinc-100"
            >
              Connect
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
