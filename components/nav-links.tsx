"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, Plus, Settings, Tv } from "lucide-react";
import { cn } from "cn";

export type NavChannel = { slug: string; name: string };

/** Sidebar / drawer links with the current page highlighted. */
export function NavLinks({ channels, onNavigate }: { channels: NavChannel[]; onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

  const item = (href: string, label: string, icon: React.ReactNode, active = isActive(href)) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
        active && "bg-primary/10 font-medium text-foreground ring-1 ring-primary/25 [&_svg]:text-primary",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <>
      <nav className="flex flex-col gap-0.5 text-sm">
        {item("/", "Dashboard", <LayoutDashboard className="size-4" />)}
        {item("/jobs", "Agent jobs", <Inbox className="size-4" />)}
        {item("/settings", "Settings", <Settings className="size-4" />)}
      </nav>
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Channels</p>
        {channels.map((c) =>
          item(`/channels/${c.slug}`, c.name, <Tv className="size-4" />),
        )}
        {item("/channels/new", "New channel", <Plus className="size-4" />, path === "/channels/new")}
      </div>
    </>
  );
}
