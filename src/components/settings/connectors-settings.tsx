"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appBtn } from "@/lib/app-buttons";
import * as settingsApi from "@/lib/api/settings-extended";

interface ConnectorsSettingsProps {
  onGoToCustomize: (tab: "skills" | "connectors") => void;
}

export function ConnectorsSettings({
  onGoToCustomize,
}: ConnectorsSettingsProps) {
  const [accounts, setAccounts] = useState<
    Array<{ id: string; provider: string; status: string }>
  >([]);
  const [installations, setInstallations] = useState<
    Array<{ id: string; connectorName: string; status: string }>
  >([]);

  useEffect(() => {
    void settingsApi
      .listConnectedAccounts()
      .then(({ accounts: a, installations: i }) => {
        setAccounts(a);
        setInstallations(i);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 text-zinc-800">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[14px] leading-snug">
            Manage connectors from the Connectors tab in Settings.
          </p>

          <Button
            variant="outline"
            onClick={() => onGoToCustomize("connectors")}
            className={cn(appBtn.secondarySm, "h-8 shrink-0 px-3 text-[12px]")}
          >
            Go to Connectors
          </Button>
        </div>

        <div className="mt-4">
          <h2 className="text-[16px] font-semibold">Connected accounts</h2>
          {accounts.length === 0 && installations.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No connected apps yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span>{account.provider}</span>
                  <span className="text-zinc-500">{account.status}</span>
                </li>
              ))}
              {installations.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span>{row.connectorName}</span>
                  <span className="text-zinc-500">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
