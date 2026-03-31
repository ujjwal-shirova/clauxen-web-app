'use client';

import { ChevronDown } from 'lucide-react';
import { Switch } from '@/frontend/components/ui/switch';

interface NotificationsSettingsProps {
  responseChannel: string;
  groupChatChannel: string;
  tasksChannel: string;
  projectsChannel: string;
  recommendationsChannel: string;
  usageChannel: string;
  desktopAlerts: boolean;
  setDesktopAlerts: (value: boolean) => void;
  soundEffects: boolean;
  setSoundEffects: (value: boolean) => void;
  onCycleResponseChannel: () => void;
  onCycleGroupChatChannel: () => void;
  onCycleTasksChannel: () => void;
  onCycleProjectsChannel: () => void;
  onCycleRecommendationsChannel: () => void;
  onCycleUsageChannel: () => void;
}

interface NotificationRowProps {
  title: string;
  description: React.ReactNode;
  value: string;
  onClick: () => void;
  borderless?: boolean;
}

function NotificationRow({ title, description, value, onClick, borderless = false }: NotificationRowProps) {
  return (
    <div className={`flex min-h-[68px] items-start justify-between gap-6 py-3 ${borderless ? '' : 'border-b border-[#1f1e1d]/5'}`}>
      <div className="pr-8">
        <h3 className="text-[14px] font-[430] text-[#3d3d3a]">{title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-[#8f8f8f]">{description}</p>
      </div>
      <button
        onClick={onClick}
        className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#1f1e1d]/10 bg-white px-3 text-[14px] text-[#3d3d3a] shadow-sm transition-colors hover:bg-[#f7f6f0]"
      >
        <span>{value}</span>
        <ChevronDown className="h-4 w-4 text-[#73726c]" />
      </button>
    </div>
  );
}

export function NotificationsSettings({
  responseChannel,
  groupChatChannel,
  tasksChannel,
  projectsChannel,
  recommendationsChannel,
  usageChannel,
  desktopAlerts,
  setDesktopAlerts,
  soundEffects,
  setSoundEffects,
  onCycleResponseChannel,
  onCycleGroupChatChannel,
  onCycleTasksChannel,
  onCycleProjectsChannel,
  onCycleRecommendationsChannel,
  onCycleUsageChannel,
}: NotificationsSettingsProps) {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <section className="flex flex-col gap-6 pb-8 border-b border-[#1f1e1d]/10">
        <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Notifications</h2>
        <div className="rounded-2xl border border-[#1f1e1d]/10 bg-white/80 px-4 py-2">
          <NotificationRow
            title="Responses"
            description="Get notified when Clauxen responds to requests that take time, like research, coding tasks, or image generation."
            value={responseChannel}
            onClick={onCycleResponseChannel}
          />
          <NotificationRow
            title="Group chats"
            description="You'll receive notifications for new messages from group chats."
            value={groupChatChannel}
            onClick={onCycleGroupChatChannel}
          />
          <NotificationRow
            title="Tasks"
            description={<><span>Get notified when tasks you&apos;ve created have updates. </span><a href="#" className="underline decoration-[#8f8f8f]/60 hover:text-[#3d3d3a]">Manage tasks</a></>}
            value={tasksChannel}
            onClick={onCycleTasksChannel}
          />
          <NotificationRow
            title="Projects"
            description="Get notified when you receive an email invitation to a shared project."
            value={projectsChannel}
            onClick={onCycleProjectsChannel}
          />
          <NotificationRow
            title="Recommendations"
            description="Stay in the loop on new tools, tips, and features from Clauxen."
            value={recommendationsChannel}
            onClick={onCycleRecommendationsChannel}
          />
          <NotificationRow
            title="Usage"
            description="We'll notify you when limits reset for features like image creation and intensive tools."
            value={usageChannel}
            onClick={onCycleUsageChannel}
            borderless
          />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-[16px] font-semibold text-[#3d3d3a]">Local alerts</h2>
        <div className="flex items-center justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-[430] text-[#3d3d3a]">Desktop alerts</p>
            <p className="text-[14px] leading-snug text-[#73726c]">
              Show browser notifications when background chats, builds, and research tasks finish.
            </p>
          </div>
          <Switch checked={desktopAlerts} onCheckedChange={setDesktopAlerts} />
        </div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-[430] text-[#3d3d3a]">Sound effects</p>
            <p className="text-[14px] leading-snug text-[#73726c]">
              Play subtle sounds for message delivery, call state changes, and completed actions.
            </p>
          </div>
          <Switch checked={soundEffects} onCheckedChange={setSoundEffects} />
        </div>
      </section>
    </div>
  );
}
