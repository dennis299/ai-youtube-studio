import Link from "next/link";
import { Clapperboard, Inbox, LayoutDashboard, Plus, Settings } from "lucide-react";
import { listChannels } from "@/lib/store";

export async function Sidebar() {
  const channels = await listChannels();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-4 py-6">
      <Link href="/" className="flex items-center gap-2 px-2 font-semibold">
        <Clapperboard className="size-5 text-primary" />
        AI YouTube Studio
      </Link>
      <nav className="flex flex-col gap-1 text-sm">
        <NavLink href="/" icon={<LayoutDashboard className="size-4" />}>Dashboard</NavLink>
        <NavLink href="/jobs" icon={<Inbox className="size-4" />}>Agent jobs</NavLink>
        <NavLink href="/settings" icon={<Settings className="size-4" />}>Settings</NavLink>
      </nav>
      <div className="flex flex-col gap-1 text-sm">
        <p className="px-2 text-xs uppercase tracking-wide text-muted-foreground">Channels</p>
        {channels.map((c) => (
          <NavLink key={c.slug} href={`/channels/${c.slug}`}>{c.name}</NavLink>
        ))}
        <NavLink href="/channels/new" icon={<Plus className="size-4" />}>New channel</NavLink>
      </div>
    </aside>
  );
}

function NavLink({ href, icon, children }: { href: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
