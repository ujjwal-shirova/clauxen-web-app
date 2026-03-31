'use client';

import { Check } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { ClaudeStar } from '@/frontend/components/icons';

export function BillingSettings() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#1f1e1d]/15 bg-white shadow-sm">
              <ClaudeStar className="h-10 w-10 text-[#3d3d3a]" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[16px] font-semibold">Free plan</h2>
              <p className="text-[14px] font-[430] text-[#73726c]">Try Clauxen</p>
            </div>
          </div>
          <Button className="h-9 rounded-lg bg-[#1f1e1d] px-4 font-medium text-white hover:bg-[#1f1e1d]/90">Upgrade plan</Button>
        </div>
        <ul className="mt-2 space-y-1">
          {[
            'Chat on web, iOS, Android, and on your desktop',
            'Generate code and visualize data',
            'Write, edit, and create content',
            'Analyze text and images',
            'Ability to search the web',
            'Create files and execute code',
            'Unlock more from Clauxen with desktop extensions',
            'Connect Slack and Google Workspace services',
            'Integrate any context or tool through connectors with remote MCP',
            'Extended thinking for complex work',
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-3 py-1">
              <div className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500/10 text-green-600">
                <Check className="h-3 w-3" />
              </div>
              <span className="text-[14px] leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-6 text-[#3d3d3a]">
        <h2 className="text-[16px] font-semibold">Invoices</h2>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1f1e1d]/20 bg-[#faf9f5]/50 p-12 text-center">
          <p className="text-[14px] font-[430] text-[#73726c]">We have not sent you an invoice yet.</p>
        </div>
      </section>
    </div>
  );
}
