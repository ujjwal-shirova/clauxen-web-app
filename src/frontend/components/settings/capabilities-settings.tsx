'use client';

import { Button } from '@/frontend/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/frontend/components/ui/radio-group';
import { Switch } from '@/frontend/components/ui/switch';
import { settingsRadioItemClass } from '@/frontend/components/settings/settings-ui';

const ALLOWED_TOOL_MODES = new Set(['auto', 'on-demand', 'always']);

interface CapabilitiesSettingsProps {
  toolMode: string;
  setToolMode: (value: string) => void;
  onGoToCustomize: (tab: 'skills' | 'connectors') => void;
}

export function CapabilitiesSettings({ toolMode, setToolMode, onGoToCustomize }: CapabilitiesSettingsProps) {
  const handleToolModeChange = (value: string) => {
    if (!ALLOWED_TOOL_MODES.has(value)) return;
    setToolMode(value);
  };
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      
      <section className="flex flex-col gap-6 pb-8 border-b border-zinc-200 text-zinc-700">
        
        <h2 className="text-[16px] font-semibold">Memory</h2>
          
        <div className="flex items-start justify-between gap-8">
          
          <div className="flex flex-col gap-1.5">
            
            <p className="text-[14px] font-[430]">Generate memory from chat history</p>
              
            <p className="text-[14px] leading-snug text-zinc-500">Allow Clauxen to remember relevant context from your chats. Memory includes your entire chat history with Clauxen. <a href="#" className="underline decoration-zinc-500/40 hover:text-zinc-800">Learn more</a>.</p>
              
          
          </div>
          <Switch   />
        
        </div>
        <div className="flex items-start justify-between gap-8">
          
          <div className="flex flex-col gap-1.5">
            
            <p className="text-[14px] font-[430]">Import memory from other AI providers</p>
              
            <p className="text-[14px] leading-snug text-zinc-500">Bring relevant context and data from another AI provider to Clauxen. We&apos;ll provide a prompt you can use to fetch the memory from your other account. <a href="#" className="underline decoration-zinc-500/40 hover:text-zinc-800">Learn more</a>.</p>
              
          
          </div>
          <Button variant="outline" className="h-9 rounded-lg border-zinc-300 px-4 text-zinc-700 hover:bg-zinc-100">Start import</Button>
            
        
        </div>
      
      </section>

      <section className="flex flex-col gap-6 pb-8 border-b border-zinc-200 text-zinc-700">
        
        <h2 className="text-[16px] font-semibold">Tool access</h2>
          
        <div className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-1">
            
            <p className="text-[14px] font-[430]">Tool access mode</p>
              
            <p className="text-[14px] leading-snug text-zinc-500">Controls how connector tools are loaded in new conversations.</p>
              
          
          </div>
          <RadioGroup value={toolMode} onValueChange={handleToolModeChange} className="mt-2 flex flex-col gap-4">
            
            <div className="flex items-start gap-4 rounded-lg p-2 transition-colors hover:bg-zinc-100">
              
              <RadioGroupItem value="auto" id="auto" className={settingsRadioItemClass} />
              <label htmlFor="auto" className="flex cursor-pointer flex-col gap-0.5">
                
                <span className="text-[14px] font-medium">Auto</span>
                  
                <span className="text-[14px] text-zinc-500">Clauxen chooses for you.</span>
                  
              
              </label>
            
            </div>
            <div className="flex items-start gap-4 rounded-lg p-2 transition-colors hover:bg-zinc-100">
              
              <RadioGroupItem value="on-demand" id="on-demand" className={settingsRadioItemClass} />
              <label htmlFor="on-demand" className="flex cursor-pointer flex-col gap-0.5">
                
                <span className="text-[14px] font-medium">On demand</span>
                  
                <span className="text-[14px] text-zinc-500">Load when needed. More messages, lower accuracy.</span>
                  
              
              </label>
            
            </div>
            <div className="flex items-start gap-4 rounded-lg p-2 transition-colors hover:bg-zinc-100">
              
              <RadioGroupItem value="always" id="always" className={settingsRadioItemClass} />
              <label htmlFor="always" className="flex cursor-pointer flex-col gap-0.5">
                
                <span className="text-[14px] font-medium">Always available</span>
                  
                <span className="text-[14px] text-zinc-500">Ready from start. Fewer messages, better accuracy.</span>
                  
              
              </label>
            
            </div>
          
          </RadioGroup>
        
        </div>
      
      </section>

      <section className="flex flex-col gap-6 pb-8 border-b border-zinc-200 text-zinc-700">
        
        <h2 className="text-[16px] font-semibold">Visuals</h2>
          
        <div className="flex items-start justify-between gap-8">
          
          <div className="flex flex-col gap-1.5">
            
            <p className="text-[14px] font-[430]">Artifacts</p>
              
            <p className="text-[14px] leading-snug text-zinc-500">Ask Clauxen to generate content like code snippets, text documents, or website designs, and Clauxen will create an Artifact that appears in a dedicated window alongside your conversation.</p>
              
          
          </div>
          <Switch checked disabled className="opacity-50"   />
        
        </div>
        <div className="flex items-start justify-between gap-8">
          
          <div className="flex flex-col gap-1.5">
            
            <p className="text-[14px] font-[430]">AI-powered artifacts</p>
              
            <p className="text-[14px] leading-snug text-zinc-500">Create apps, prototypes, and interactive documents that use Clauxen inside the artifact. Start by saying, &quot;Let&apos;s build an AI app...&quot; to access the power of Shirova API.</p>
              
          
          </div>
          <Switch   />
        
        </div>
      
      </section>

      <section className="flex flex-col gap-6 pb-8 border-b border-zinc-200 text-zinc-700">
        
        <h2 className="text-[16px] font-semibold">Code execution and file creation</h2>
          
        <div className="flex items-start justify-between gap-8">
          
          <div className="flex flex-col gap-1.5">
            
            <p className="text-[14px] font-[430]">Code execution and file creation</p>
              
            <p className="text-[14px] leading-snug text-zinc-500">Clauxen can execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports.</p>
              
          
          </div>
          <Switch checked   />
        
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          
          <div className="flex items-start justify-between gap-8">
            
            <div className="flex flex-col gap-1.5">
              
              <p className="text-[14px] font-medium">Allow network egress</p>
                
              <p className="text-[14px] leading-snug text-zinc-500">Allow Clauxen to access common package managers to install packages and libraries for data analysis, visualizations, and file processing. <a href="#" className="underline decoration-zinc-500/40 hover:text-zinc-800">View package manager domains</a>. Monitor chats closely as this comes with <a href="#" className="underline decoration-zinc-500/40 hover:text-zinc-800">security risks</a>.</p>
                
            
            </div>
            <Switch   />
          
          </div>
        
        </div>
      
      </section>

      <section className="flex flex-col gap-6 text-zinc-700">
        
        <h2 className="text-[16px] font-semibold">Skills</h2>
          
        <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          
          <p className="text-[14px] leading-snug">Skills have moved to Customize. Head to the new Customize page to manage your skills and connectors.</p>
            
          
          <Button
            
            variant="outline"
            
            onClick={() => onGoToCustomize('skills')}
            
            className="h-8 shrink-0 border-zinc-300 px-3 text-[12px] text-zinc-700 hover:bg-zinc-100"
          
          >
            Go to Customize
          
          </Button>
        
        </div>
      
      </section>
    
    </div>
  );
}
