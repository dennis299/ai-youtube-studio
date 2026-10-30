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
import { getChannel, getInsights, listStats, listVideos } from "@/lib/store";

const n = new Intl.NumberFormat("en");

export default async function StatsPage(props: PageProps<"/channels/[slug]/stats">) {
  await syncJobs();
  const { slug } = await props.params;
  const [channel, stats, videos, insights, jobs, settings] = await Promise.all([
    getChannel(slug), listStats(slug), listVideos(slug), getInsights(slug), pendingJobs(slug, ["insights"]), loadSettings(),
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
      {!settings.google.tokens && <p className="text-sm text-muted-foreground">Connect your YouTube channel in Settings to pull stats.</p>}

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
