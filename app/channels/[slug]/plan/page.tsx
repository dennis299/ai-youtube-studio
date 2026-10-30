import Link from "next/link";
import { syncJobs } from "@/lib/sync";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChannelNav } from "@/components/channel-nav";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { LinkButton } from "@/components/link-button";
import { StatusBadge } from "@/components/status-badge";
import { WaitingForAgent } from "@/components/waiting-for-agent";
import { planMonthAction } from "@/app/actions";
import { pendingJobs } from "@/lib/pending";
import { getChannel, getInsights, listVideos } from "@/lib/store";

const DAY = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function defaultMonth(): string {
  const d = new Date();
  if (d.getDate() > 20) d.setMonth(d.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PlanPage(props: PageProps<"/channels/[slug]/plan">) {
  await syncJobs();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const all = await listVideos(slug);
  const months = [...new Set(all.map((v) => v.month))].sort();
  const month = typeof sp.month === "string" ? sp.month : months.at(-1) ?? defaultMonth();
  const [channel, jobs, insights] = await Promise.all([getChannel(slug), pendingJobs(slug, ["monthly_plan"]), getInsights(slug)]);
  if (!channel) return null;
  const videos = all.filter((v) => v.month === month);

  return (
    <>
      <ChannelNav channel={channel} active="Monthly plan" />
      <Flash searchParams={props.searchParams} />
      <WaitingForAgent jobs={jobs} back={`/channels/${slug}/plan?month=${month}`} />

      <Card>
        <CardHeader>
          <CardTitle>Plan a month</CardTitle>
          <CardDescription>
            {channel.cadence.perWeek} videos a week × 4 weeks = {channel.cadence.perWeek * 4} topics, built from your research
            {insights ? " and last month's stats" : ""}. Re-planning only replaces ideas that have no storyboard yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <form action={planMonthAction} className="flex items-center gap-3">
            <input type="hidden" name="slug" value={slug} />
            <Input type="month" name="month" defaultValue={month} className="w-44" />
            <SubmitButton disabled={jobs.length > 0}>{videos.length ? "Re-plan month" : "Plan month"}</SubmitButton>
          </form>
          {months.length > 1 && (
            <div className="flex gap-2 text-sm">
              {months.map((m) => (
                <Link key={m} href={`?month=${m}`} className={`rounded px-2 py-1 ${m === month ? "bg-muted" : "text-muted-foreground"}`}>{m}</Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {videos.length > 0 && (
        <div className="space-y-6">
          {[1, 2, 3, 4].map((week) => {
            const wk = videos.filter((v) => v.week === week);
            if (!wk.length) return null;
            return (
              <section key={week} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Week {week}</h2>
                  <LinkButton href={`/channels/${slug}/checkin?week=${month}-w${week}`} size="sm" variant="ghost">
                    Check-in <ArrowRight />
                  </LinkButton>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {wk.map((v) => (
                    <Link key={v.id} href={`/channels/${slug}/videos/${v.id}`}>
                      <Card className="h-full transition-colors hover:border-primary/50">
                        <CardContent className="space-y-2 py-4 text-sm">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{DAY.format(new Date(`${v.publishDate}T12:00:00Z`))}</span>
                            <StatusBadge status={v.status} />
                          </div>
                          <p className="font-medium leading-snug">{v.workingTitle}</p>
                          <p className="text-xs text-primary">{v.pillar}</p>
                          <p className="line-clamp-3 text-xs text-muted-foreground">{v.angle}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
