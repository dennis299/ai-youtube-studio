import Link from "next/link";
import { syncJobs } from "@/lib/sync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelNav } from "@/components/channel-nav";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { WaitingForAgent } from "@/components/waiting-for-agent";
import { fetchStatsAction, insightsAction } from "@/app/actions";
import { pendingJobs } from "@/lib/pending";
import { loadSettings } from "@/lib/settings";
import { getChannel, getInsights, getOverview, listStats, listVideos } from "@/lib/store";
import { yppProgress } from "@/lib/youtube/overview";
import { ExternalLink } from "lucide-react";

const n = new Intl.NumberFormat("en");

export default async function StatsPage(props: PageProps<"/channels/[slug]/stats">) {
  await syncJobs();
  const { slug } = await props.params;
  const [channel, stats, videos, insights, jobs, settings, overview] = await Promise.all([
    getChannel(slug), listStats(slug), listVideos(slug), getInsights(slug), pendingJobs(slug, ["insights"]), loadSettings(), getOverview(slug),
  ]);
  if (!channel) return null;
  const rows = stats
    .map((s) => ({ s, v: videos.find((v) => v.id === s.videoId) }))
    .sort((a, b) => b.s.views - a.s.views);

  return (
    <>
      <ChannelNav channel={channel} active="Stats" />
      <Flash searchParams={props.searchParams} />
      <WaitingForAgent jobs={jobs} back={`/channels/${slug}/stats`} />

      <div className="flex flex-wrap gap-3">
        <form action={fetchStatsAction}>
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton disabled={!settings.google.tokens}>Refresh stats from YouTube</SubmitButton>
        </form>
        <form action={insightsAction}>
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton variant="secondary" disabled={!stats.length || jobs.length > 0}>Learn from these stats</SubmitButton>
        </form>
      </div>
      {!settings.google.tokens && (
        <p className="text-sm text-muted-foreground">
          <Link href="/settings" className="text-primary underline underline-offset-4">Connect your YouTube channel</Link> to pull subscribers, views and watch hours.
        </p>
      )}

      {overview && <ChannelOverviewCards overview={overview} />}

      <Card>
        <CardHeader>
          <CardTitle>Published videos</CardTitle>
          <CardDescription>Insights from here feed straight into the next monthly plan.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing published and linked yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead><TableHead>Pillar</TableHead>
                  <TableHead className="text-right">Views</TableHead><TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead><TableHead className="text-right">Avg view</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ s, v }) => (
                  <TableRow key={s.videoId}>
                    <TableCell><Link href={`/channels/${slug}/videos/${s.videoId}`} className="hover:underline">{v?.workingTitle ?? s.videoId}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{v?.pillar}</TableCell>
                    <TableCell className="text-right">{n.format(s.views)}</TableCell>
                    <TableCell className="text-right">{n.format(s.likes)}</TableCell>
                    <TableCell className="text-right">{n.format(s.comments)}</TableCell>
                    <TableCell className="text-right">{s.avgViewDurationSec ? `${Math.floor(s.avgViewDurationSec / 60)}:${String(Math.round(s.avgViewDurationSec % 60)).padStart(2, "0")}` : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {insights && (
        <Card>
          <CardHeader><CardTitle>What the stats say</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <div><p className="font-medium text-emerald-300">Winners</p><ul className="list-disc pl-5">{insights.winners.map((w) => <li key={w}>{w}</li>)}</ul></div>
            <div><p className="font-medium text-destructive">Losers</p><ul className="list-disc pl-5">{insights.losers.map((w) => <li key={w}>{w}</li>)}</ul></div>
            <div><p className="font-medium">Guidance for next month</p><p className="text-muted-foreground">{insights.guidance}</p></div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

type Overview = NonNullable<Awaited<ReturnType<typeof getOverview>>>;

function ChannelOverviewCards({ overview }: { overview: Overview }) {
  const ypp = yppProgress(overview);
  const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const tiles = [
    { label: "Subscribers", value: n.format(overview.subscribers) },
    { label: "Total views", value: compact.format(overview.totalViews) },
    { label: "Watch hours · 12 mo", value: n.format(overview.longFormHours12m) },
    { label: "Shorts views · 90 days", value: compact.format(overview.shortsViews90d) },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} size="sm">
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Road to monetization</CardTitle>
          <CardDescription>
            {ypp.eligible
              ? "You meet the YouTube Partner Program thresholds. Apply in YouTube Studio → Earn."
              : "YouTube Partner Program: 1,000 subscribers plus either 4,000 long-form watch hours (12 months) or 10M Shorts views (90 days)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Meter label="Subscribers" m={ypp.subscribers} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Meter label="Watch hours (path A)" m={ypp.watchHours} />
            <Meter label="Shorts views (path B)" m={ypp.shortsViews} />
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Updated {new Date(overview.fetchedAt).toLocaleString("en")}. Estimates from YouTube Analytics; Studio&apos;s Earn tab has the official count.</span>
            <a href="https://studio.youtube.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Open YouTube Studio <ExternalLink className="size-3" />
            </a>
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function Meter({ label, m }: { label: string; m: { current: number; target: number; pct: number } }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {n.format(m.current)} / {n.format(m.target)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${m.pct === 100 ? "bg-emerald-400" : "bg-primary"}`} style={{ width: `${Math.max(m.pct, 1)}%` }} />
      </div>
    </div>
  );
}
