"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";

/** A horizontally scrolling row that brings its aria-current item into view on narrow screens. */
export function ScrollRow({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2;
  }, [children]);
  return (
    <nav ref={ref} className={cn("scroll-row", className)}>
      {children}
    </nav>
  );
}
