"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { NavLinks, type NavChannel } from "@/components/nav-links";

/** Top bar + slide-in drawer, shown below the md breakpoint where the sidebar is hidden. */
export function MobileNav({ channels }: { channels: NavChannel[] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md md:hidden">
      <Brand />
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
          <Menu />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 border-r bg-sidebar px-4 py-4 shadow-2xl outline-none transition-transform duration-200 ease-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full">
            <div className="flex items-center justify-between">
              <Brand onNavigate={() => setOpen(false)} />
              <DialogPrimitive.Close render={<Button variant="ghost" size="icon" aria-label="Close menu" />}>
                <X />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <NavLinks channels={channels} onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </header>
  );
}
