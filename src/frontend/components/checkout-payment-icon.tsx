"use client";

import React from "react";
import { cn } from "@/frontend/lib/utils";

export function CheckoutPaymentIcon({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={20}
      height={20}
      className={cn("h-5 w-5 shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
