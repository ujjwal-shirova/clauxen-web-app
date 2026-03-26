'use client';

import React, { useState, useEffect } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Sidebar } from '@/components/sidebar';
import { ChatArea } from '@/components/chat-area';
import { UpgradeView } from '@/components/upgrade-view';
import { SettingsPage } from '@/components/settings-page';
import { AppsExtensionsView } from '@/components/apps-extensions-view';
import { GiftView } from '@/components/gift-view';
import { CustomizePage } from '@/components/customize-page';
import { ProjectsView } from '@/components/projects-view';
import { ArtifactsView } from '@/components/artifacts-view';
import { cn } from '@/lib/utils';

export default function Home() {
  const { 
    messages, 
    isGenerating, 
    handleSendMessage, 
    startNewChat,
    updateMessage,
    activeChatId,
  } = useChat();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'settings' | 'customize' | 'projects' | 'artifacts'>('chat');
  const [showUpgradeView, setShowUpgradeView] = useState(false);
  const [showAppsView, setShowAppsView] = useState(false);
  const [showGiftView, setShowGiftView] = useState(false);
  const [customizeTab, setCustomizeTab] = useState<'skills' | 'connectors' | null>(null);
  const [chatRenderKey, setChatRenderKey] = useState(0);

  // Force sidebar to stay collapsed when Customize page is active
  useEffect(() => {
    if (activeView === 'customize') {
      setIsSidebarCollapsed(true);
    }
  }, [activeView]);

  const handleNewChat = () => {
    startNewChat();
    setActiveView('chat');
    setIsSidebarCollapsed(false);
    setChatRenderKey((current) => current + 1);
  };

  const handleGoToView = (view: 'chat' | 'settings' | 'customize' | 'projects' | 'artifacts', tab?: 'skills' | 'connectors') => {
    setCustomizeTab(tab || null);
    setActiveView(view);
    
    if (view === 'customize') {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f7f8f2] text-[#3d3d3a] overflow-hidden font-sans relative">
      <Sidebar 
        handleNewChat={handleNewChat} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed} 
        onUpgradeClick={() => setShowUpgradeView(true)}
        onSettingsClick={() => handleGoToView('settings')}
        onCustomizeClick={() => handleGoToView('customize')}
        onAppsExtensionsClick={() => setShowAppsView(true)}
        onGiftClick={() => setShowGiftView(true)}
        onProjectsClick={() => handleGoToView('projects')}
        onArtifactsClick={() => handleGoToView('artifacts')}
        onHistoryClick={() => handleGoToView('chat')}
        activeView={activeView}
      />
      
      <main className={cn(
        "flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300 ease-in-out pt-2 pr-2",
        isSidebarCollapsed ? "pl-[48.8px]" : "pl-[288px]"
      )}>
        <div className="w-full flex-1 flex flex-col bg-[#faf9f5] rounded-tl-[28px] rounded-tr-[28px] border border-[hsl(var(--panel-edge))] shadow-[0_1px_2px_rgba(26,23,18,0.03),0_10px_30px_rgba(26,23,18,0.04)] overflow-hidden relative">
          <div className="w-full max-w-full flex-1 flex flex-col items-center overflow-y-auto min-h-0">
            {activeView === 'chat' && (
              <ChatArea 
                key={`${activeChatId ?? 'new-chat'}-${chatRenderKey}`}
                messages={messages} 
                onSendMessage={handleSendMessage} 
                isGenerating={isGenerating} 
                onUpgradeClick={() => setShowUpgradeView(true)} 
                updateMessage={updateMessage}
                activeChatId={activeChatId}
                onOpenAgentSwarm={() => setIsSidebarCollapsed(true)}
              />
            )}
            {activeView === 'settings' && (
              <SettingsPage 
                onClose={() => setActiveView('chat')} 
                onGoToCustomize={(tab) => handleGoToView('customize', tab)}
              />
            )}
            {activeView === 'customize' && (
              <CustomizePage 
                onClose={() => setActiveView('settings')} 
                initialTab={customizeTab}
              />
            )}
            {activeView === 'projects' && (
              <ProjectsView 
                onNewProject={() => {}} 
              />
            )}
            {activeView === 'artifacts' && (
              <ArtifactsView />
            )}
          </div>
        </div>
      </main>

      {showUpgradeView && (
        <UpgradeView onClose={() => setShowUpgradeView(false)} />
      )}

      {showAppsView && (
        <AppsExtensionsView onClose={() => setShowAppsView(false)} />
      )}

      {showGiftView && (
        <GiftView onClose={() => setShowGiftView(false)} />
      )}
    </div>
  );
}
