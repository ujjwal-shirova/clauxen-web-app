'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Info } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { useApiKeys } from '@/frontend/hooks/use-api-keys';
import { useAuth } from '@/frontend/hooks/use-auth';

const API_KEY_NAME_MAX = 128;

function sanitizeApiKeyName(name: string): string {
  return name.trim().slice(0, API_KEY_NAME_MAX);
}

export function ClauxenCodeSettings() {
  const auth = useAuth();
  const { keys, loading, createKey, revokeKey } = useApiKeys(auth.isAuthenticated);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setCreatedKey(null);
    };
  }, []);

  const handleCreate = async () => {
    if (!auth.isAuthenticated) return;
    const name = window.prompt('Token name');
    const safeName = name ? sanitizeApiKeyName(name) : '';
    if (!safeName) return;
    const key = await createKey(safeName);
    setCreatedKey(key.key);
  };

  const handleRevoke = async (keyId: string) => {
    if (!auth.isAuthenticated) return;
    await revokeKey(keyId);
    setCreatedKey(null);
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      
      <section className="flex flex-col gap-6 pb-8 border-b border-zinc-200">
        
        <div className="flex items-start justify-between gap-6 text-zinc-800">
          
          <div className="flex flex-1 flex-col gap-4">
            
            <h2 className="text-[16px] font-semibold">Clauxen Code</h2>
              
            <p className="text-[14px] leading-relaxed text-zinc-500">
              
              Clauxen Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands.
            
            </p>
            <a href="#" className="flex items-center gap-1.5 text-[14px] font-medium text-[#1b67b2] hover:underline">
              
              Upgrade to Max or Pro <ArrowUpRight className="h-3.5 w-3.5" />
            
            </a>
          
          </div>
        
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-800">
          
          <div className="mt-0.5"><Info className="h-5 w-5 text-zinc-800" /></div>
            
          <p className="text-[14px] leading-snug">
            
            
            <span className="font-medium">How does usage work?</span> API keys authenticate requests to the Clauxen inference API.
          
          </p>
        
        </div>
      
      </section>

      <section className="flex flex-col gap-6 text-zinc-800">
        
        <div className="flex items-center justify-between">
          
          <h2 className="text-[16px] font-semibold">API keys</h2>
            
          
          <Button
            
            onClick={() => void handleCreate()}
            
            className="h-9 rounded-lg bg-zinc-900 px-4 text-white hover:bg-zinc-800 no-hover-overlay"
          
          >
            Create key
          
          </Button>
        
        </div>

        
        {createdKey && (
          <div className="rounded-xl border border-green-500/30 bg-green-50 p-4 text-sm">
            
            <p className="font-medium mb-2">Copy your key now — it won&apos;t be shown again:</p>
              
            <code className="break-all text-xs">{createdKey}</code>
              
          
          </div>
        )}

        
        {loading && <p className="text-sm text-zinc-500">Loading keys…</p>}

        
        {!loading && keys.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-12 text-center">
            
            <p className="mb-1 text-[14px] font-medium">No API keys yet</p>
              
            <p className="text-[14px] text-zinc-500">Create a key to use Clauxen from your IDE or scripts.</p>
              
          
          </div>
        )}

        <ul className="flex flex-col gap-2">
          
          
          {keys.map((key) => (
            
            <li
              
              key={key.id}
              
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
            
            >
              <div>
                
                <p className="font-medium text-sm">{key.name}</p>
                  
                <p className="text-xs text-zinc-500 font-mono">{key.key_prefix}…</p>
                  
              
              </div>
              <Button variant="outline" size="sm" disabled={!auth.isAuthenticated} onClick={() => void handleRevoke(key.id)}>
                
                Revoke
              
              </Button>
            
            </li>
          ))}
        
        </ul>
      
      </section>
    
    </div>
  );
}
