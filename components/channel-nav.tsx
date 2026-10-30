import Link from "next/link";
import type { Channel } from "@/lib/schemas";
import { cn } from "cn";
import { ScrollRow } from "@/components/scroll-row";

const STEPS = [
  { href: "", label: "Research" },
  { href: "/kit", label: "Channel kit" },
  { href: "/plan", label: "Monthly plan" },
  { href: "/checkin", label: "Weekly check-in" },
  { href: "/stats", label: "Stats" },
];

export function ChannelNav({ channel, active }: { channel: Channel; active: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Channel</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{channel.name}</h1>
        <p className="text-sm text-muted-foreground">{channel.niche}</p>
      </div>
      <ScrollRow className="relative -mx-4 border-b px-4 pb-px text-sm sm:mx-0 sm:px-0">
        {STEPS.map((s) => (
          <Link
            key={s.label}
            href={`/channels/${channel.slug}${s.href}`}
            aria-current={active === s.label ? "page" : undefined}
            className={cn(
              "relative px-3 py-2.5 text-muted-foreground transition-colors hover:text-foreground",
              active === s.label &&
                "font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
            )}
          >
            {s.label}
          </Link>
        ))}
      </ScrollRow>
    </div>
  );
}
