import { cn } from "@/lib/utils";
import type { LucideIcon, LucideProps } from "lucide-react";

const sizeClasses = {
  xs: "icon-xs",
  sm: "icon-sm",
  md: "icon-md",
  lg: "icon-lg",
  xl: "icon-xl",
  "2xl": "icon-2xl",
} as const;

const variantClasses = {
  default: "",
  muted: "icon-muted",
  subtle: "icon-subtle",
  primary: "icon-primary", // brand primary accent — primary CTAs
} as const;

export type IconSize = keyof typeof sizeClasses;
export type IconVariant = keyof typeof variantClasses; // exported variant union — color semantics

export interface IconProps extends LucideProps {
  icon: LucideIcon;
  size?: IconSize; // optional size token — default `md`
  variant?: IconVariant; // optional color variant — default `default`
}

export function Icon({
  icon: LucideIcon,
  size = "md",
  variant = "default",
  className,
  ...props
}: IconProps) {
  const { dangerouslySetInnerHTML: _dangerouslySetInnerHTML, ...safeProps } =
    props;

  return (
    <LucideIcon
      className={cn(
        "lucide",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...safeProps}
    />
  );
}
