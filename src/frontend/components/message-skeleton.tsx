
'use client';

import React from 'react';
import { Skeleton } from '@/frontend/components/ui/skeleton';

export function MessageSkeleton() {
  return (
    <div className="flex items-start gap-4 animate-in fade-in">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-full bg-gray-200" />
        <Skeleton className="h-4 w-5/6 bg-gray-200" />
        <Skeleton className="h-4 w-3/4 bg-gray-200" />
      </div>
    </div>
  );
}
