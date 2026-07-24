"use client";

interface SettingsPlaceholderProps {
  title: string;
  description?: string;
}

export function SettingsPlaceholder({
  title,
  description = "This section is part of the new Clauxen settings experience. Content will be added in the next pass.",
}: SettingsPlaceholderProps) {
  return (
    <div className="flex animate-in fade-in flex-col gap-3 duration-300 text-zinc-800">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <p className="max-w-md text-[14px] leading-relaxed text-zinc-500">
        {description}
      </p>
    </div>
  );
}
