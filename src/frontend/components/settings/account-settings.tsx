'use client';

import { Check, Copy, MoreHorizontal } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';

interface AccountSettingsProps {
  copied: boolean;
  onCopyOrgId: () => void;
}

export function AccountSettings({ copied, onCopyOrgId }: AccountSettingsProps) {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
        <h2 className="text-[16px] font-semibold">Account</h2>
        <div className="flex items-center justify-between gap-8">
          <p className="text-[14px] font-[430]">Log out of all devices</p>
          <Button variant="outline" className="h-9 rounded-lg border-[#1f1e1d]/30 px-4 text-[#3d3d3a] hover:bg-[#f0eee6]">Log out</Button>
        </div>
        <div className="flex items-center justify-between gap-8">
          <p className="text-[14px] font-[430]">Delete your account</p>
          <Button className="h-9 rounded-lg bg-[#1f1e1d] px-4 font-medium text-white hover:bg-[#1f1e1d]/90">Delete account</Button>
        </div>
        <div className="flex items-center justify-between gap-8">
          <p className="text-[14px] font-[430]">Organization ID</p>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#f5f4ed] py-1 pl-4 pr-1 text-[#73726c]">
            <span className="font-mono text-[12px]">9c1e9229-9668-4a5b-98de-b1d3b4c0545a</span>
            <button onClick={onCopyOrgId} className="rounded-md p-1.5 transition-colors hover:bg-black/5">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-6 text-[#3d3d3a]">
        <h2 className="text-[16px] font-semibold">Active sessions</h2>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#1f1e1d]/15 font-medium text-[#73726c]">
                <th className="pb-3 pr-4 font-medium">Device</th>
                <th className="px-4 pb-3 font-medium">Location</th>
                <th className="px-4 pb-3 font-medium">Created</th>
                <th className="px-4 pb-3 font-medium">Updated</th>
                <th className="w-12 pb-3 pl-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="group border-b border-[#1f1e1d]/15 last:border-0">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    <span>Chrome (Windows)</span>
                    <span className="rounded-md bg-[#f0eee6] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#73726c]">Current</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-[#73726c]">Rewāri, Haryana, IN</td>
                <td className="px-4 py-4 text-[#73726c]">Feb 25, 2026</td>
                <td className="px-4 py-4 text-[#73726c]">Mar 6, 2026</td>
                <td className="py-4 pl-4">
                  <button className="rounded-md p-1.5 opacity-0 transition-all hover:bg-[#f0eee6] group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4 text-[#73726c]" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
