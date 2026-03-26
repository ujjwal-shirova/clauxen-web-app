'use client';

import React, { useState } from 'react';
import { cn } from '@/frontend/lib/utils';
import { Switch } from '@/frontend/components/ui/switch';
import { 
  ChevronDown, 
  RefreshCw, 
  X, 
  Copy, 
  Check, 
  MoreHorizontal, 
  ExternalLink, 
  ArrowUpRight,
  Info, 
  Mail, 
  Github 
} from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/frontend/components/ui/accordion";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/frontend/components/ui/radio-group";
import { ClaudeStar } from './icons';

const settingsNav = [
  { name: 'General' },
  { name: 'Account' },
  { name: 'Privacy' },
  { name: 'Billing' },
  { name: 'Capabilities' },
  { name: 'Connectors' },
  { name: 'Clauxen Code' },
];

const fontThemes = [
  { name: 'Default', serif: true },
  { name: 'Sans', serif: false },
  { name: 'System', serif: false },
  { name: 'Dyslexic friendly', dyslexic: true },
];

interface SettingsPageProps {
  onClose: () => void;
  onGoToCustomize: (tab: 'skills' | 'connectors') => void;
}

export function SettingsPage({ onClose, onGoToCustomize }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState('General');
  const [copied, setCopied] = useState(false);
  const [toolMode, setToolMode] = useState('auto');

  const handleCopyOrgId = () => {
    navigator.clipboard.writeText('9c1e9229-9668-4a5b-98de-b1d3b4c0545a');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 w-full max-w-[1280px] mx-auto px-8 pt-8 bg-[#faf9f5] h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between mb-8 text-[#3d3d3a]">
        <h1 className="text-[24px] font-serif font-medium">Settings</h1>
        <button onClick={onClose} className="p-2 hover:bg-[#f0eee6] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#73726c]" />
        </button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-8 pb-32">
        <aside className="self-start sticky top-4">
          <nav className="flex flex-col gap-1 -ml-3">
            {settingsNav.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  "flex items-center h-9 px-3 rounded-lg text-[14px] font-[430] transition-colors whitespace-nowrap",
                  activeTab === item.name
                    ? "bg-[#f0eee6] text-[#3d3d3a]"
                    : "text-[#73726c] hover:bg-[#f0eee6]/50"
                )}
              >
                {item.name}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex flex-col gap-8 max-w-[672px]">
          {activeTab === 'General' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
                <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Profile</h2>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap gap-5">
                    <div className="flex flex-col gap-1 flex-[3] min-w-[240px]">
                      <label className="text-[14px] font-[430] text-[#3d3d3a]">Full name</label>
                      <div className="flex gap-2">
                        <div className="relative group">
                          <button className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-[#1f1e1d]/15 shadow-sm transition-all hover:bg-[#f0eee6]">
                            <div className="w-8 h-8 rounded-full bg-[#3d3d3a] text-[#FAF9F5] flex items-center justify-center text-[14px] font-semibold">U</div>
                            <RefreshCw className="absolute inset-0 m-auto w-5 h-5 text-[#3d3d3a] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          defaultValue="Ujjwal"
                          className="flex-1 h-11 px-3 bg-white rounded-xl border border-[#1f1e1d]/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1b67b2]/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                      <label className="text-[14px] font-[430] text-[#3d3d3a]">What should Clauxen call you?</label>
                      <input 
                        type="text" 
                        defaultValue="Ujjwal"
                        className="h-11 px-3 bg-white rounded-xl border border-[#1f1e1d]/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1b67b2]/20 transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[14px] font-[430] text-[#3d3d3a]">What best describes your work?</label>
                    <button className="flex items-center justify-between h-11 px-3 bg-white rounded-xl border border-[#1f1e1d]/15 text-[14px] text-[#3d3d3a] hover:bg-gray-50 transition-colors">
                      <span>Select your work function</span>
                      <ChevronDown className="w-4 h-4 text-[#73726c]" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[14px] font-[430] text-[#3d3d3a]">What personal preferences should Clauxen consider in responses?</label>
                    <p className="text-[14px] text-[#73726c] font-[430] mb-2">
                      Your preferences will apply to all conversations, within <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Shirova's guidelines</a>.
                    </p>
                    <textarea 
                      rows={3}
                      placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
                      className="w-full p-3 bg-white rounded-xl border border-[#1f1e1d]/15 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1b67b2]/20 transition-all resize-none"
                    />
                  </div>
                </div>
              </section>
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
                <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Notifications</h2>
                <div className="flex items-center justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430] text-[#3d3d3a]">Response completions</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">
                      Get notified when Clauxen has finished a response. Most useful for long-running tasks like tool calls and Research.
                    </p>
                  </div>
                  <Switch checked />
                </div>
              </section>
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
                <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Appearance</h2>
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-4">
                    <p className="text-[14px] font-[430] text-[#3d3d3a]">Color mode</p>
                    <div className="flex gap-4">
                      {['Light', 'Auto', 'Dark'].map((mode) => (
                        <div key={mode} className="flex flex-col items-center gap-2 flex-1">
                          <button className={cn(
                            "w-full aspect-[4/3] rounded-xl border border-[#1f1e1d]/15 overflow-hidden transition-all hover:scale-[1.02] shadow-sm",
                            mode === 'Auto' && "border-[#1b67b2] ring-1 ring-[#1b67b2]"
                          )}>
                            <div className={cn(
                              "w-full h-full",
                              mode === 'Light' ? "bg-white" : mode === 'Dark' ? "bg-gray-900" : "bg-gradient-to-br from-white to-gray-900"
                            )} />
                          </button>
                          <span className="text-[14px] text-[#3d3d3a]">{mode}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="text-[14px] font-[430] text-[#3d3d3a]">Chat font</p>
                    <div className="flex gap-4">
                      {fontThemes.map((theme) => (
                        <div key={theme.name} className="flex flex-col items-center gap-2 flex-1">
                          <button className={cn(
                            "w-full aspect-[4/3] rounded-xl border border-[#1f1e1d]/15 bg-white flex items-center justify-center transition-all hover:scale-[1.02] shadow-sm",
                            theme.name === 'Default' && "border-[#1b67b2] ring-1 ring-[#1b67b2]"
                          )}>
                            <span className={cn(
                              "text-[24px]",
                              theme.serif ? "font-serif" : "font-sans",
                              theme.dyslexic && "italic"
                            )}>Aa</span>
                          </button>
                          <span className="text-[14px] text-[#3d3d3a] text-center leading-tight">{theme.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Account' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Account</h2>
                <div className="flex items-center justify-between gap-8">
                  <p className="text-[14px] font-[430]">Log out of all devices</p>
                  <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Log out</Button>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <p className="text-[14px] font-[430]">Delete your account</p>
                  <Button className="h-9 px-4 rounded-lg bg-[#1f1e1d] text-white hover:bg-[#1f1e1d]/90 font-medium">Delete account</Button>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <p className="text-[14px] font-[430]">Organization ID</p>
                  <div className="flex items-center gap-1.5 bg-[#f5f4ed] rounded-lg pl-4 pr-1 py-1 text-[#73726c]">
                    <span className="text-[12px] font-mono">9c1e9229-9668-4a5b-98de-b1d3b4c0545a</span>
                    <button onClick={handleCopyOrgId} className="p-1.5 hover:bg-black/5 rounded-md transition-colors">
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </section>
              <section className="flex flex-col gap-6 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Active sessions</h2>
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-[14px] border-collapse">
                    <thead>
                      <tr className="border-b border-[#1f1e1d]/15 text-[#73726c] font-medium">
                        <th className="pb-3 pr-4 font-medium">Device</th>
                        <th className="pb-3 px-4 font-medium">Location</th>
                        <th className="pb-3 px-4 font-medium">Created</th>
                        <th className="pb-3 px-4 font-medium">Updated</th>
                        <th className="pb-3 pl-4 font-medium w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#1f1e1d]/15 last:border-0 group">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <span>Chrome (Windows)</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-[#f0eee6] text-[10px] font-semibold uppercase text-[#73726c]">Current</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-[#73726c]">Rewāri, Haryana, IN</td>
                        <td className="py-4 px-4 text-[#73726c]">Feb 25, 2026</td>
                        <td className="py-4 px-4 text-[#73726c]">Mar 6, 2026</td>
                        <td className="py-4 pl-4">
                          <button className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[#f0eee6] rounded-md transition-all">
                            <MoreHorizontal className="w-4 h-4 text-[#73726c]" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Privacy' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-[#f0eee6] border border-[#1f1e1d]/15 flex items-center justify-center shrink-0">
                    <img src="https://claude.ai/images/settings/data_privacy.svg" alt="Privacy" className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-[16px] font-semibold">Privacy</h2>
                    <p className="text-[14px] text-[#73726c] font-[430]">Shirova believes in transparent data practices</p>
                  </div>
                </div>
                <p className="text-[14px] leading-relaxed">
                  Learn how your information is protected when using Clauxen products, and visit our <a href="#" className="underline decoration-[#1f1e1d]/30 hover:text-black">Privacy Center</a> and <a href="#" className="underline decoration-[#1f1e1d]/30 hover:text-black">Privacy Policy</a> for more details.
                </p>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="protect" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-2 text-[14px] font-[430]">How we protect your data</AccordionTrigger>
                    <AccordionContent className="text-[14px] text-[#73726c] leading-relaxed pb-4">
                      We use industry-standard encryption and security protocols to ensure your conversations and personal information remain secure at all times.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="use" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-2 text-[14px] font-[430]">How we use your data</AccordionTrigger>
                    <AccordionContent className="text-[14px] text-[#73726c] leading-relaxed pb-4">
                      Your data is primarily used to provide and improve our services. We do not sell your personal information to third parties.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </section>
              <section className="flex flex-col gap-6 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Privacy settings</h2>
                <div className="flex items-center justify-between gap-8">
                  <p className="text-[14px] font-[430]">Export data</p>
                  <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Export data</Button>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <p className="text-[14px] font-[430]">Shared chats</p>
                  <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Manage</Button>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <p className="text-[14px] font-[430]">Memory preferences</p>
                  <Button variant="ghost" className="h-9 px-3 gap-1.5 rounded-lg text-[#3d3d3a] hover:bg-[#f0eee6]">Manage <ExternalLink className="w-3.5 h-3.5 opacity-60" /></Button>
                </div>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">Location metadata</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Allow Clauxen to use coarse location metadata (city/region) to improve product experiences. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Learn more</a>.</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">Help improve Clauxen</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Allow the use of your chats and coding sessions to train and improve Shirova AI models. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Learn more</a>.</p>
                  </div>
                  <Switch checked />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Billing' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-white border border-[#1f1e1d]/15 shadow-sm overflow-hidden">
                      <ClaudeStar className="w-10 h-10 text-[#3d3d3a]" />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-[16px] font-semibold">Free plan</h2>
                      <p className="text-[14px] text-[#73726c] font-[430]">Try Clauxen</p>
                    </div>
                  </div>
                  <Button className="h-9 px-4 rounded-lg bg-[#1f1e1d] text-white hover:bg-[#1f1e1d]/90 font-medium">Upgrade plan</Button>
                </div>
                <ul className="space-y-1 mt-2">
                  {[
                    "Chat on web, iOS, Android, and on your desktop",
                    "Generate code and visualize data",
                    "Write, edit, and create content",
                    "Analyze text and images",
                    "Ability to search the web",
                    "Create files and execute code",
                    "Unlock more from Clauxen with desktop extensions",
                    "Connect Slack and Google Workspace services",
                    "Integrate any context or tool through connectors with remote MCP",
                    "Extended thinking for complex work"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 py-1">
                      <div className="mt-1 flex items-center justify-center w-4 h-4 rounded-full bg-green-500/10 text-green-600"><Check className="w-3 h-3" /></div>
                      <span className="text-[14px] leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="flex flex-col gap-6 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Invoices</h2>
                <div className="p-12 border border-dashed border-[#1f1e1d]/20 rounded-2xl flex flex-col items-center justify-center text-center bg-[#faf9f5]/50">
                  <p className="text-[14px] text-[#73726c] font-[430]">We have not sent you an invoice yet.</p>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Capabilities' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Memory</h2>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">Generate memory from chat history</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Allow Clauxen to remember relevant context from your chats. Memory includes your entire chat history with Clauxen. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Learn more</a>.</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">Import memory from other AI providers</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Bring relevant context and data from another AI provider to Clauxen. We'll provide a prompt you can use to fetch the memory from your other account. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Learn more</a>.</p>
                  </div>
                  <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Start import</Button>
                </div>
              </section>

              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Tool access</h2>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-[430]">Tool access mode</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Controls how connector tools are loaded in new conversations.</p>
                  </div>
                  <RadioGroup value={toolMode} onValueChange={setToolMode} className="flex flex-col gap-4 mt-2">
                    <div className="flex items-start gap-4">
                      <RadioGroupItem value="auto" id="auto" className="mt-1" />
                      <label htmlFor="auto" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-[14px] font-medium">Auto</span>
                        <span className="text-[14px] text-[#73726c]">Clauxen chooses for you.</span>
                      </label>
                    </div>
                    <div className="flex items-start gap-4">
                      <RadioGroupItem value="on-demand" id="on-demand" className="mt-1" />
                      <label htmlFor="on-demand" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-[14px] font-medium">On demand</span>
                        <span className="text-[14px] text-[#73726c]">Load when needed. More messages, lower accuracy.</span>
                      </label>
                    </div>
                    <div className="flex items-start gap-4">
                      <RadioGroupItem value="always" id="always" className="mt-1" />
                      <label htmlFor="always" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-[14px] font-medium">Always available</span>
                        <span className="text-[14px] text-[#73726c]">Ready from start. Fewer messages, better accuracy.</span>
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              </section>

              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Visuals</h2>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">Artifacts</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Ask Clauxen to generate content like code snippets, text documents, or website designs, and Clauxen will create an Artifact that appears in a dedicated window alongside your conversation.</p>
                  </div>
                  <Switch checked disabled className="opacity-50" />
                </div>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">AI-powered artifacts</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Create apps, prototypes, and interactive documents that use Clauxen inside the artifact. Start by saying, "Let's build an AI app..." to access the power of Shirova API.</p>
                  </div>
                  <Switch />
                </div>
              </section>

              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Code execution and file creation</h2>
                <div className="flex items-start justify-between gap-8">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-[430]">Code execution and file creation</p>
                    <p className="text-[14px] text-[#73726c] leading-snug">Clauxen can execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports.</p>
                  </div>
                  <Switch checked />
                </div>
                <div className="p-6 bg-[#f5f4ed] rounded-2xl border border-[#1f1e1d]/10 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-8">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[14px] font-medium">Allow network egress</p>
                      <p className="text-[14px] text-[#73726c] leading-snug">Allow Clauxen to access common package managers to install packages and libraries for data analysis, visualizations, and file processing. <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">View package manager domains</a>. Monitor chats closely as this comes with <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">security risks</a>.</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-6 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Skills</h2>
                <div className="p-4 bg-[#f5f4ed] border border-[#1f1e1d]/15 rounded-xl flex items-center justify-between gap-4">
                  <p className="text-[14px] leading-snug">Skills have moved to Customize. Head to the new Customize page to manage your skills and connectors.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => onGoToCustomize('skills')}
                    className="h-8 px-3 text-[12px] border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6] shrink-0"
                  >
                    Go to Customize
                  </Button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Connectors' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 text-[#3d3d3a]">
                <div className="p-4 bg-[#f5f4ed] border border-[#1f1e1d]/15 rounded-xl flex items-center justify-between gap-4">
                  <p className="text-[14px] leading-snug">Connectors have moved to Customize. Head to the new Customize page to manage your skills and connectors.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => onGoToCustomize('connectors')}
                    className="h-8 px-3 text-[12px] border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6] shrink-0"
                  >
                    Go to Customize
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-8 mt-4">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="text-[16px] font-semibold">Connectors</h2>
                    <p className="text-[14px] text-[#73726c] leading-snug">Allow Clauxen to reference other apps and services for more context.</p>
                  </div>
                  <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Browse connectors</Button>
                </div>

                <div className="flex flex-col gap-6 mt-4">
                  <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-white border border-[#1f1e1d]/15 shadow-sm flex items-center justify-center opacity-50">
                        <svg width="24" height="24" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.84624 12.6235L2.48571 13.728C2.61858 13.9605 2.80959 14.1432 3.03382 14.2761L5.31765 10.3231H0.75C0.75 10.5805 0.816439 10.8379 0.949316 11.0705L1.84624 12.6235Z" fill="#0066DA"></path>
                          <path d="M8.00011 5.67238L5.71628 1.71931C5.49205 1.85219 5.30104 2.0349 5.16816 2.26743L0.949316 9.57562C0.818882 9.80314 0.750174 10.0608 0.75 10.3231H5.31765L8.00011 5.67238Z" fill="#00AC47"></path>
                          <path d="M12.9663 14.2761C13.1905 14.1432 13.3815 13.9605 13.5144 13.728L13.7802 13.2712L15.0508 11.0705C15.1837 10.8379 15.2501 10.5805 15.2501 10.3231H10.6821L11.6541 12.2331L12.9663 14.2761Z" fill="#EA4335"></path>
                          <path d="M8.00013 5.67238L10.284 1.71931C10.0597 1.58643 9.80228 1.52 9.53652 1.52H6.46374C6.19799 1.52 5.94054 1.59474 5.71631 1.71931L8.00013 5.67238Z" fill="#00832D"></path>
                          <path d="M10.6824 10.3231H5.31752L3.03369 14.2761C3.25792 14.409 3.51537 14.4754 3.78112 14.4754H12.2188C12.4846 14.4754 12.742 14.4007 12.9663 14.2761L10.6824 10.3231Z" fill="#2684FC"></path>
                          <path d="M12.9414 5.92153L10.8319 2.26743C10.6991 2.0349 10.5081 1.85219 10.2838 1.71931L8 5.67238L10.6825 10.3231H15.2418C15.2418 10.0656 15.1754 9.80816 15.0425 9.57562L12.9414 5.92153Z" fill="#FFBA00"></path>
                        </svg>
                      </div>
                      <span className="text-[14px] font-medium opacity-50">Google Drive</span>
                    </div>
                    <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Connect</Button>
                  </div>

                  <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-white border border-[#1f1e1d]/15 shadow-sm flex items-center justify-center opacity-50">
                        <Mail className="w-6 h-6 text-[#EA4335]" />
                      </div>
                      <span className="text-[14px] font-medium opacity-50">Gmail</span>
                    </div>
                    <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Connect</Button>
                  </div>

                  <div className="flex items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-white border border-[#1f1e1d]/15 shadow-sm flex items-center justify-center opacity-50">
                        <Github className="w-6 h-6 text-[#333]" />
                      </div>
                      <span className="text-[14px] font-medium opacity-50">GitHub</span>
                    </div>
                    <Button variant="outline" className="h-9 px-4 rounded-lg border-[#1f1e1d]/30 text-[#3d3d3a] hover:bg-[#f0eee6]">Connect</Button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Clauxen Code' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-300">
              <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/15">
                <div className="flex items-start justify-between gap-6 text-[#3d3d3a]">
                  <div className="flex flex-col gap-4 flex-1">
                    <h2 className="text-[16px] font-semibold">Clauxen Code</h2>
                    <p className="text-[14px] text-[#73726c] leading-relaxed">
                      Clauxen Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands.
                    </p>
                    <a href="#" className="flex items-center gap-1.5 text-[14px] text-[#1b67b2] hover:underline font-medium">
                      Upgrade to Max or Pro <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="shrink-0">
                    <div className="p-1 bg-white border border-[#1f1e1d]/10 rounded-lg shadow-sm overflow-hidden">
                      <img 
                        src="https://claude.ai/_next/image?url=%2Fimages%2Fnudges%2Fclaudecode.png&w=384&q=75" 
                        alt="Clauxen Code Preview" 
                        className="w-[135px] h-auto rounded"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-[#f5f4ed] border border-[#1f1e1d]/15 rounded-xl flex items-start gap-3 text-[#3d3d3a]">
                  <div className="mt-0.5"><Info className="w-5 h-5 text-[#3d3d3a]" /></div>
                  <p className="text-[14px] leading-snug">
                    <span className="font-medium">How does usage work?</span> When you sign in to Clauxen Code using your subscription, your subscription usage limits are shared with Clauxen Code.
                  </p>
                </div>
              </section>

              <section className="flex flex-col gap-6 text-[#3d3d3a]">
                <h2 className="text-[16px] font-semibold">Manage your authorization tokens</h2>
                <div className="p-12 border border-dashed border-[#1f1e1d]/20 rounded-2xl flex flex-col items-center justify-center text-center bg-[#faf9f5]/50">
                  <p className="text-[14px] font-medium mb-1">No connected Clauxen Code instances</p>
                  <p className="text-[14px] text-[#73726c]">When you sign in to Clauxen Code, your authorization tokens will appear here.</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
