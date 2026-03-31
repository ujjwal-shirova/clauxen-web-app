'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/frontend/lib/utils';
import { settingsNav, SettingsTab, notificationDeliveryOptions } from '@/frontend/components/settings/constants';
import { GeneralSettings } from '@/frontend/components/settings/general-settings';
import { NotificationsSettings } from '@/frontend/components/settings/notifications-settings';
import { AccountSettings } from '@/frontend/components/settings/account-settings';
import { PrivacySettings } from '@/frontend/components/settings/privacy-settings';
import { BillingSettings } from '@/frontend/components/settings/billing-settings';
import { CapabilitiesSettings } from '@/frontend/components/settings/capabilities-settings';
import { ConnectorsSettings } from '@/frontend/components/settings/connectors-settings';
import { ClauxenCodeSettings } from '@/frontend/components/settings/clauxen-code-settings';

interface SettingsPageProps {
  onClose: () => void;
  onGoToCustomize: (tab: 'skills' | 'connectors') => void;
}

export function SettingsPage({ onClose, onGoToCustomize }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('General');
  const [copied, setCopied] = useState(false);
  const [toolMode, setToolMode] = useState('auto');
  const [colorMode, setColorMode] = useState('Auto');
  const [chatFont, setChatFont] = useState('Default');
  const [appearancePreset, setAppearancePreset] = useState('System');
  const [accentColor, setAccentColor] = useState('Blue');
  const [language, setLanguage] = useState('Auto-detect');
  const [spokenLanguage, setSpokenLanguage] = useState('Auto-detect');
  const [voice, setVoice] = useState('Ember');
  const [voiceIsolation, setVoiceIsolation] = useState(false);
  const [desktopAlerts, setDesktopAlerts] = useState(true);
  const [soundEffects, setSoundEffects] = useState(false);
  const [responseChannel, setResponseChannel] = useState('Push');
  const [groupChatChannel, setGroupChatChannel] = useState('Push');
  const [tasksChannel, setTasksChannel] = useState('Push, Email');
  const [projectsChannel, setProjectsChannel] = useState('Email');
  const [recommendationsChannel, setRecommendationsChannel] = useState('Push, Email');
  const [usageChannel, setUsageChannel] = useState('Push, Email');

  const handleCopyOrgId = () => {
    navigator.clipboard.writeText('9c1e9229-9668-4a5b-98de-b1d3b4c0545a');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cycleValue = (current: string, values: string[], setter: (value: string) => void) => {
    const currentIndex = values.indexOf(current);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % values.length;
    setter(values[nextIndex]);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'General':
        return (
          <GeneralSettings
            colorMode={colorMode}
            setColorMode={setColorMode}
            chatFont={chatFont}
            setChatFont={setChatFont}
            appearancePreset={appearancePreset}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            language={language}
            spokenLanguage={spokenLanguage}
            voice={voice}
            setVoice={setVoice}
            voiceIsolation={voiceIsolation}
            setVoiceIsolation={setVoiceIsolation}
            onCycleAppearancePreset={() => cycleValue(appearancePreset, ['System', 'Focused', 'Contrast'], setAppearancePreset)}
            onCycleLanguage={() => cycleValue(language, ['Auto-detect', 'English', 'Hindi', 'Spanish'], setLanguage)}
            onCycleSpokenLanguage={() => cycleValue(spokenLanguage, ['Auto-detect', 'English', 'Hindi', 'French'], setSpokenLanguage)}
          />
        );
      case 'Notifications':
        return (
          <NotificationsSettings
            responseChannel={responseChannel}
            groupChatChannel={groupChatChannel}
            tasksChannel={tasksChannel}
            projectsChannel={projectsChannel}
            recommendationsChannel={recommendationsChannel}
            usageChannel={usageChannel}
            desktopAlerts={desktopAlerts}
            setDesktopAlerts={setDesktopAlerts}
            soundEffects={soundEffects}
            setSoundEffects={setSoundEffects}
            onCycleResponseChannel={() => cycleValue(responseChannel, notificationDeliveryOptions, setResponseChannel)}
            onCycleGroupChatChannel={() => cycleValue(groupChatChannel, notificationDeliveryOptions, setGroupChatChannel)}
            onCycleTasksChannel={() => cycleValue(tasksChannel, notificationDeliveryOptions, setTasksChannel)}
            onCycleProjectsChannel={() => cycleValue(projectsChannel, notificationDeliveryOptions, setProjectsChannel)}
            onCycleRecommendationsChannel={() => cycleValue(recommendationsChannel, notificationDeliveryOptions, setRecommendationsChannel)}
            onCycleUsageChannel={() => cycleValue(usageChannel, notificationDeliveryOptions, setUsageChannel)}
          />
        );
      case 'Account':
        return <AccountSettings copied={copied} onCopyOrgId={handleCopyOrgId} />;
      case 'Privacy':
        return <PrivacySettings />;
      case 'Billing':
        return <BillingSettings />;
      case 'Capabilities':
        return <CapabilitiesSettings toolMode={toolMode} setToolMode={setToolMode} onGoToCustomize={onGoToCustomize} />;
      case 'Connectors':
        return <ConnectorsSettings onGoToCustomize={onGoToCustomize} />;
      case 'Clauxen Code':
        return <ClauxenCodeSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full max-w-[1280px] flex-1 overflow-y-auto bg-[#faf9f5] px-8 pt-8 mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-8 flex items-center justify-between text-[#3d3d3a]">
        <h1 className="font-serif text-[24px] font-medium">Settings</h1>
        <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-[#f0eee6]">
          <X className="h-5 w-5 text-[#73726c]" />
        </button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-8 pb-32">
        <aside className="sticky top-4 self-start">
          <nav className="-ml-3 flex flex-col gap-1">
            {settingsNav.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  'flex h-9 items-center whitespace-nowrap rounded-lg px-3 text-[14px] font-[430] transition-colors',
                  activeTab === item.name ? 'bg-[#f0eee6] text-[#3d3d3a]' : 'text-[#73726c] hover:bg-[#f0eee6]/50'
                )}
              >
                {item.name}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex max-w-[672px] flex-col gap-8">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}
