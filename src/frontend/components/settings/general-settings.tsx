'use client';

import { RefreshCw, ChevronDown, Shield, Palette, Languages, Volume2, Play } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';
import { Button } from '@/frontend/components/ui/button';
import { Switch } from '@/frontend/components/ui/switch';
import { accentColors, fontThemes, voiceOptions } from './constants';

interface GeneralSettingsProps {
  colorMode: string;
  setColorMode: (value: string) => void;
  chatFont: string;
  setChatFont: (value: string) => void;
  appearancePreset: string;
  accentColor: string;
  setAccentColor: (value: string) => void;
  language: string;
  spokenLanguage: string;
  voice: string;
  setVoice: (value: string) => void;
  voiceIsolation: boolean;
  setVoiceIsolation: (value: boolean) => void;
  onCycleAppearancePreset: () => void;
  onCycleLanguage: () => void;
  onCycleSpokenLanguage: () => void;
}

export function GeneralSettings({
  colorMode,
  setColorMode,
  chatFont,
  setChatFont,
  appearancePreset,
  accentColor,
  setAccentColor,
  language,
  spokenLanguage,
  voice,
  setVoice,
  voiceIsolation,
  setVoiceIsolation,
  onCycleAppearancePreset,
  onCycleLanguage,
  onCycleSpokenLanguage,
}: GeneralSettingsProps) {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
        <div className="rounded-2xl border border-[#1f1e1d]/10 bg-[#f5f4ed] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1f1e1d]/10 bg-white text-[#3d3d3a] shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div className="max-w-[460px]">
                <h3 className="text-[15px] font-medium text-[#3d3d3a]">Secure your account</h3>
                <p className="mt-1 text-[14px] leading-snug text-[#73726c]">
                  Add passkeys, authenticator apps, or SMS verification to better protect your account when signing in.
                </p>
              </div>
            </div>
            <Button variant="outline" className="h-9 shrink-0 rounded-full border-[#1f1e1d]/20 bg-white px-4 text-[#3d3d3a] hover:bg-[#f0eee6]">
              Set up MFA
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
        <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Profile</h2>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-5">
            <div className="flex min-w-[240px] flex-[3] flex-col gap-1">
              <label className="text-[14px] font-[430] text-[#3d3d3a]">Full name</label>
              <div className="flex gap-2">
                <div className="relative group">
                  <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1f1e1d]/15 bg-white shadow-sm transition-all hover:bg-[#f0eee6]">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d3d3a] text-[14px] font-semibold text-[#FAF9F5]">U</div>
                    <RefreshCw className="absolute inset-0 m-auto h-5 w-5 text-[#3d3d3a] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </button>
                </div>
                <input
                  type="text"
                  defaultValue="Ujjwal"
                  className="h-11 flex-1 rounded-xl border border-[#1f1e1d]/15 bg-white px-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1b67b2]/20"
                />
              </div>
            </div>
            <div className="flex min-w-[240px] flex-1 flex-col gap-1">
              <label className="text-[14px] font-[430] text-[#3d3d3a]">What should Clauxen call you?</label>
              <input
                type="text"
                defaultValue="Ujjwal"
                className="h-11 rounded-xl border border-[#1f1e1d]/15 bg-white px-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1b67b2]/20"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-[430] text-[#3d3d3a]">What best describes your work?</label>
            <button className="flex h-11 items-center justify-between rounded-xl border border-[#1f1e1d]/15 bg-white px-3 text-[14px] text-[#3d3d3a] transition-colors hover:bg-gray-50">
              <span>Select your work function</span>
              <ChevronDown className="h-4 w-4 text-[#73726c]" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-[430] text-[#3d3d3a]">What personal preferences should Clauxen consider in responses?</label>
            <p className="mb-2 text-[14px] font-[430] text-[#73726c]">
              Your preferences will apply to all conversations, within <a href="#" className="underline decoration-[#73726c]/40 hover:text-[#3d3d3a]">Shirova&apos;s guidelines</a>.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. when learning new concepts, I find analogies particularly helpful"
              className="w-full resize-none rounded-xl border border-[#1f1e1d]/15 bg-white p-3 text-[14px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1b67b2]/20"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
        <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Appearance</h2>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <p className="text-[14px] font-[430] text-[#3d3d3a]">Color mode</p>
            <div className="flex gap-4">
              {['Light', 'Auto', 'Dark'].map((mode) => (
                <div key={mode} className="flex flex-1 flex-col items-center gap-2">
                  <button
                    onClick={() => setColorMode(mode)}
                    className={cn(
                      'aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#1f1e1d]/15 shadow-sm transition-all hover:scale-[1.02]',
                      colorMode === mode && 'border-[#1b67b2] ring-1 ring-[#1b67b2]'
                    )}
                  >
                    <div
                      className={cn(
                        'h-full w-full',
                        mode === 'Light' ? 'bg-white' : mode === 'Dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-white to-gray-900'
                      )}
                    />
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
                <div key={theme.name} className="flex flex-1 flex-col items-center gap-2">
                  <button
                    onClick={() => setChatFont(theme.name)}
                    className={cn(
                      'aspect-[4/3] w-full rounded-xl border border-[#1f1e1d]/15 bg-white shadow-sm transition-all hover:scale-[1.02] flex items-center justify-center',
                      chatFont === theme.name && 'border-[#1b67b2] ring-1 ring-[#1b67b2]'
                    )}
                  >
                    <span className={cn('text-[24px]', theme.serif ? 'font-serif' : 'font-sans', theme.dyslexic && 'italic')}>Aa</span>
                  </button>
                  <span className="text-center text-[14px] leading-tight text-[#3d3d3a]">{theme.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 pb-8">
        <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Workspace experience</h2>
        <div className="space-y-2 rounded-2xl border border-[#1f1e1d]/10 bg-white/70 px-4 py-2">
          <div className="flex min-h-[60px] items-center justify-between gap-6 border-b border-[#1f1e1d]/5 py-3">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-[#73726c]" />
              <span className="text-[14px] font-[430] text-[#3d3d3a]">Appearance preset</span>
            </div>
            <button
              onClick={onCycleAppearancePreset}
              className="flex h-9 items-center gap-2 rounded-lg border border-[#1f1e1d]/10 bg-white px-3 text-[14px] text-[#3d3d3a] shadow-sm transition-colors hover:bg-[#f7f6f0]"
            >
              <span>{appearancePreset}</span>
              <ChevronDown className="h-4 w-4 text-[#73726c]" />
            </button>
          </div>
          <div className="flex min-h-[60px] items-center justify-between gap-6 border-b border-[#1f1e1d]/5 py-3">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-[#73726c]" />
              <span className="text-[14px] font-[430] text-[#3d3d3a]">Accent color</span>
            </div>
            <div className="flex items-center gap-2">
              {accentColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setAccentColor(color.name)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border bg-white px-2.5 py-1.5 text-[13px] transition-colors',
                    accentColor === color.name
                      ? 'border-[#1f1e1d]/25 text-[#3d3d3a] shadow-sm'
                      : 'border-transparent text-[#73726c] hover:border-[#1f1e1d]/10'
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.value }} />
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-h-[60px] items-center justify-between gap-6 border-b border-[#1f1e1d]/5 py-3">
            <div className="flex items-center gap-3">
              <Languages className="h-4 w-4 text-[#73726c]" />
              <span className="text-[14px] font-[430] text-[#3d3d3a]">Language</span>
            </div>
            <button
              onClick={onCycleLanguage}
              className="flex h-9 items-center gap-2 rounded-lg border border-[#1f1e1d]/10 bg-white px-3 text-[14px] text-[#3d3d3a] shadow-sm transition-colors hover:bg-[#f7f6f0]"
            >
              <span>{language}</span>
              <ChevronDown className="h-4 w-4 text-[#73726c]" />
            </button>
          </div>
          <div className="py-3">
            <div className="flex min-h-[44px] items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 text-[#73726c]" />
                <span className="text-[14px] font-[430] text-[#3d3d3a]">Spoken language</span>
              </div>
              <button
                onClick={onCycleSpokenLanguage}
                className="flex h-9 items-center gap-2 rounded-lg border border-[#1f1e1d]/10 bg-white px-3 text-[14px] text-[#3d3d3a] shadow-sm transition-colors hover:bg-[#f7f6f0]"
              >
                <span>{spokenLanguage}</span>
                <ChevronDown className="h-4 w-4 text-[#73726c]" />
              </button>
            </div>
            <p className="mt-2 pr-12 text-[12px] leading-5 text-[#8f8f8f]">
              For best results, choose the language you mainly speak. If it is not listed, Clauxen can still fall back to auto-detection.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6 pb-8">
        <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Voice</h2>
        <div className="rounded-2xl border border-[#1f1e1d]/10 bg-white/80 p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-[14px] font-[430] text-[#3d3d3a]">Voice</p>
                <p className="text-[14px] leading-snug text-[#73726c]">
                  Choose the voice Clauxen uses for spoken replies and quick previews.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-9 rounded-full border-[#1f1e1d]/10 bg-[#faf9f5] px-3 text-[#3d3d3a] hover:bg-[#f0eee6]">
                  <Play className="mr-1 h-4 w-4" />
                  Play
                </Button>
                <div className="flex rounded-lg border border-[#1f1e1d]/10 bg-white p-1 shadow-sm">
                  {voiceOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setVoice(option)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-[13px] transition-colors',
                        voice === option ? 'bg-[#f0eee6] text-[#3d3d3a]' : 'text-[#73726c] hover:text-[#3d3d3a]'
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-8 border-t border-[#1f1e1d]/5 pt-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-[14px] font-[430] text-[#3d3d3a]">Separate voice workspace</p>
                <p className="text-[14px] leading-snug text-[#73726c]">
                  Keep voice sessions in a dedicated full-screen mode without live transcripts and side visuals.
                </p>
              </div>
              <Switch checked={voiceIsolation} onCheckedChange={setVoiceIsolation} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
