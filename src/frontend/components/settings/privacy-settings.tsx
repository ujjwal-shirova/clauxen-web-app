'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { Switch } from '@/frontend/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/frontend/components/ui/accordion';

export function PrivacySettings() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#1f1e1d]/15 bg-[#f0eee6]">
            <img src="https://claude.ai/images/settings/data_privacy.svg" alt="Privacy" className="h-7 w-7" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-[16px] font-semibold">Privacy</h2>
            <p className="text-[14px] font-[430] text-[#73726c]">Shirova believes in transparent data practices</p>
          </div>
        </div>
        <p className="text-[14px] leading-relaxed">
          Learn how your information is protected when using Clauxen products, and visit our <a href="#" className="underline decoration-[#1f1e1d]/30 hover:text-black">Privacy Center</a> and <a href="#" className="underline decoration-[#1f1e1d]/30 hover:text-black">Privacy Policy</a> for more details.
        </p>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="protect" className="border-none">
            <AccordionTrigger className="py-2 text-[14px] font-[430] hover:no-underline">How we protect your data</AccordionTrigger>
            <AccordionContent className="pb-4 text-[14px] leading-relaxed text-[#73726c]">
              We use industry-standard encryption and security protocols to ensure your conversations and personal information remain secure at all times.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="use" className="border-none">
            <AccordionTrigger className="py-2 text-[14px] font-[430] hover:no-underline">How we use your data</AccordionTrigger>
            <AccordionContent className="pb-4 text-[14px] leading-relaxed text-[#73726c]">
              Your data is primarily used to provide and improve our services. We do not sell your personal information to third parties.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
      <section className="flex flex-col gap-6 text-[#3d3d3a]">
        <h2 className="text-[16px] font-semibold">Privacy settings</h2>
        <div className="flex items-center justify-between gap-8">
          <p className="text-[14px] font-[430]">Export data</p>
          <Button variant="outline" className="h-9 rounded-lg border-[#1f1e1d]/30 px-4 text-[#3d3d3a] hover:bg-[#f0eee6]">Export data</Button>
        </div>
        <div className="flex items-center justify-between gap-8">
          <p className="text-[14px] font-[430]">Shared chats</p>
          <Button variant="outline" className="h-9 rounded-lg border-[#1f1e1d]/30 px-4 text-[#3d3d3a] hover:bg-[#f0eee6]">Manage</Button>
        </div>
        <div className="flex items-center justify-between gap-8">
          <p className="text-[14px] font-[430]">Memory preferences</p>
          <Button variant="ghost" className="h-9 gap-1.5 rounded-lg px-3 text-[#3d3d3a] hover:bg-[#f0eee6]">Manage <ExternalLink className="h-3.5 w-3.5 opacity-60" /></Button>
        </div>
        <div className="flex items-start justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-[430]">Location metadata</p>
            <p className="text-[14px] leading-snug text-[#73726c]">Allow Clauxen to use coarse location metadata (city/region) to improve product experiences. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Learn more</a>.</p>
          </div>
          <Switch />
        </div>
        <div className="flex items-start justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-[430]">Help improve Clauxen</p>
            <p className="text-[14px] leading-snug text-[#73726c]">Allow the use of your chats and coding sessions to train and improve Shirova AI models. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Learn more</a>.</p>
          </div>
          <Switch checked />
        </div>
      </section>
    </div>
  );
}
