import Link from "next/link";
import type { Channel } from "@/lib/schemas";

const STEPS = [
  { href: "", label: "Research" },
  { href: "/kit", label: "Channel kit" },
  { href: "/plan", label: "Monthly plan" },
  { href: "/checkin", label: "Weekly check-in" },
  { href: "/stats", label: "Stats" },
];

export function ChannelNav({ channel, active }: { channel: Channel; active: string }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Channel</p>
        <h1 className="text-3xl font-semibold tracking-tight">{channel.name}</h1>
        <p className="text-sm text-muted-foreground">{channel.niche}</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b pb-2 text-sm">
        {STEPS.map((s) => (
          <Link
            key={s.label}
            href={`/channels/${channel.slug}${s.href}`}
            className={`rounded-md px-3 py-1.5 ${active === s.label ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
