"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BrandIconProps {
  className?: string;
  size?: number;
}

export function GmailIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 6.5C2 5.12 3.12 4 4.5 4H6V14.5L2 11.5V6.5Z"
        fill="#4285F4"
      />
      <path
        d="M22 6.5C22 5.12 20.88 4 19.5 4H18V14.5L22 11.5V6.5Z"
        fill="#34A853"
      />
      <path
        d="M18 4L12 8.5L6 4H4.5C3.8 4 3.2 4.3 2.8 4.8L12 11.7L21.2 4.8C20.8 4.3 20.2 4 19.5 4H18Z"
        fill="#EA4335"
      />
      <path
        d="M2 11.5V18.5C2 19.88 3.12 21 4.5 21H6V14.5L2 11.5Z"
        fill="#188038"
      />
      <path
        d="M22 11.5V18.5C22 19.88 20.88 21 19.5 21H18V14.5L22 11.5Z"
        fill="#FBBC04"
      />
    </svg>
  );
}

export function GoogleDriveIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.2 3.5L15.8 3.5L21.5 13.5L13.9 13.5L8.2 3.5Z"
        fill="#FFBA00"
      />
      <path
        d="M2.5 13.5L6.3 7L13.9 20.5L6.3 20.5L2.5 13.5Z"
        fill="#0066DA"
      />
      <path
        d="M13.9 20.5L21.5 13.5L17.7 20.5L13.9 20.5Z"
        fill="#00AC47"
      />
      <path
        d="M6.3 20.5H17.7L21.5 13.5L17.7 7H6.3L2.5 13.5L6.3 20.5Z"
        fill="url(#gdrive-grad)"
        fillOpacity="0.1"
      />
      <defs>
        <linearGradient id="gdrive-grad" x1="2.5" y1="3.5" x2="21.5" y2="20.5">
          <stop stopColor="#0066DA" />
          <stop offset="1" stopColor="#00AC47" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HealthIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="7" fill="#E53935" />
      <path
        d="M12 18.5C12 18.5 6 14.5 6 10C6 7.8 7.8 6 10 6C10.8 6 11.5 6.3 12 6.8C12.5 6.3 13.2 6 14 6C16.2 6 18 7.8 18 10C18 14.5 12 18.5 12 18.5Z"
        fill="white"
      />
    </svg>
  );
}

export function GithubBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0 text-neutral-900 dark:text-neutral-100", className)}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function SupabaseBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.2 21.6C12.7 22.2 11.7 21.8 11.8 21L13.1 13H4.4C3.6 13 3.2 12.1 3.7 11.5L12.8 2.4C13.3 1.8 14.3 2.2 14.2 3L12.9 11H21.6C22.4 11 22.8 11.9 22.3 12.5L13.2 21.6Z"
        fill="url(#supabase-grad)"
      />
      <defs>
        <linearGradient id="supabase-grad" x1="12" y1="2" x2="12" y2="22">
          <stop stopColor="#3ECF8E" />
          <stop offset="1" stopColor="#1E9B65" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function OutlookBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="5" width="16" height="14" rx="2" fill="#0078D4" />
      <path
        d="M6 7L14 12.5L22 7"
        stroke="#50E6FF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="2" y="7" width="10" height="10" rx="2" fill="#002050" />
      <text
        x="7"
        y="14.5"
        fontSize="7.5"
        fontWeight="bold"
        fill="#FFFFFF"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        O
      </text>
    </svg>
  );
}

export function NotionBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4.5L18.5 3L20 4.5V19.5L18.5 21L5 20L4 18.5V4.5Z"
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth="1.2"
      />
      <path
        d="M7 7.5L14 6.5L17 7V17L14 17.5L8.5 9V16.5L7 17V7.5Z"
        fill="#000000"
      />
    </svg>
  );
}

export function LinearBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="#5E6AD2" />
      <path
        d="M4.5 19.5L19.5 4.5M4.5 15L15 4.5M4.5 10.5L10.5 4.5M9 19.5L19.5 9M13.5 19.5L19.5 13.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VercelBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0 text-black dark:text-white", className)}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 3L22 20.5H2L12 3Z" />
    </svg>
  );
}

export function HuggingFaceBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="#7C3AED" />
      <circle cx="12" cy="12" r="7.5" fill="#FFD21E" />
      <circle cx="9.5" cy="10.5" r="1" fill="#000000" />
      <circle cx="14.5" cy="10.5" r="1" fill="#000000" />
      <path
        d="M9 14C10 15.5 14 15.5 15 14"
        stroke="#000000"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MixpanelBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="#F43F5E" />
      <rect x="5" y="13" width="3" height="7" rx="1" fill="white" />
      <rect x="10.5" y="8" width="3" height="12" rx="1" fill="white" />
      <rect x="16" y="4" width="3" height="16" rx="1" fill="white" />
    </svg>
  );
}

export function LangChainBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="#84CC16" />
      <path
        d="M6 14C6 11 9 9 12 11C15 13 18 11 18 8M6 8C6 11 9 13 12 11C15 9 18 11 18 14"
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrowserToolsBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="6" fill="#0284C7" />
      <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2.5" fill="white" />
    </svg>
  );
}

export function MicrosoftBrandIcon({ className, size = 20 }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="3" width="8" height="8" rx="2" fill="#0078D4" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="#0078D4" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="#0078D4" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="#0078D4" />
    </svg>
  );
}

/**
 * Returns a custom brand icon for designated tools, or null if default mark should be used.
 */
export function getPluginBrandIcon(idOrName: string, size = 20): React.ReactNode | null {
  const key = idOrName.toLowerCase().trim();
  if (key === "gmail" || key.includes("gmail")) {
    return <GmailIcon size={size} />;
  }
  if (key === "google-drive" || key.includes("drive") || key === "gdrive") {
    return <GoogleDriveIcon size={size} />;
  }
  if (key === "health" || key.includes("health")) {
    return <HealthIcon size={size} />;
  }
  if (key === "github" || key.includes("github")) {
    return <GithubBrandIcon size={size} />;
  }
  if (key === "supabase" || key.includes("supabase")) {
    return <SupabaseBrandIcon size={size} />;
  }
  if (key === "outlook" || key.includes("outlook")) {
    return <OutlookBrandIcon size={size} />;
  }
  if (key === "notion" || key.includes("notion")) {
    return <NotionBrandIcon size={size} />;
  }
  if (key === "linear" || key.includes("linear")) {
    return <LinearBrandIcon size={size} />;
  }
  if (key === "vercel" || key.includes("vercel")) {
    return <VercelBrandIcon size={size} />;
  }
  if (key === "huggingface" || key.includes("hugging")) {
    return <HuggingFaceBrandIcon size={size} />;
  }
  if (key === "mixpanel" || key.includes("mixpanel") || key === "analytics") {
    return <MixpanelBrandIcon size={size} />;
  }
  if (key === "langchain" || key.includes("langchain") || key === "python") {
    return <LangChainBrandIcon size={size} />;
  }
  if (key === "browser" || key === "1password" || key.includes("browser")) {
    return <BrowserToolsBrandIcon size={size} />;
  }
  if (key === "microsoft" || key === "office" || key.includes("microsoft")) {
    return <MicrosoftBrandIcon size={size} />;
  }
  return null;
}
