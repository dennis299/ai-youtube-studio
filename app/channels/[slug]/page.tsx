import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelNav } from "@/components/channel-nav";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { LinkButton } from "@/components/link-button";
import { WaitingForAgent } from "@/components/waiting-for-agent";
import { startResearchAction } from "@/app/actions";
import { pendingJobs } from "@/lib/pending";
import { loadSettings } from "@/lib/settings";
import { getChannel, getResearch } from "@/lib/store";

const fmt = new Intl.NumberFormat("en", { notation: "compact" });

export default async function ResearchPage(props: PageProps<"/channels/[slug]">) {
  const { slug } = await props.params;
  const [channel, research, jobs, settings] = await Promise.all([
    getChannel(slug), getResearch(slug), pendingJobs(slug, ["research"]), loadSettings(),
  ]);
  if (!channel) return null;

  return (
    <>
      <ChannelNav channel={channel} active="Research" />
      <Flash searchParams={props.searchParams} />
      <WaitingForAgent jobs={jobs} back={`/channels/${slug}`} />

      {!settings.google.tokens && (
        <p className="text-sm text-muted-foreground">
          Tip: connect your YouTube channel in Settings so research uses real view counts from the YouTube API.
          Without it, the AI does web research instead.
        </p>
      )}

      {research ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>What&apos;s working in this niche</CardTitle>
              <CardDescription>Searches: {research.queries.join(" · ")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <p className="whitespace-pre-line">{research.summary}</p>
              <ul className="list-disc space-y-1 pl-5">
                {research.patterns.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Content pillars</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {research.pillars.map((p) => (
                <div key={p.name}>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-muted-foreground">{p.why}</p>
                </div>
              ))}
              <LinkButton href={`/channels/${slug}/kit`} className="mt-2 w-full">
                Next: channel kit <ArrowRight />
              </LinkButton>
            </CardContent>
          </Card>
          {research.topVideos.length > 0 && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Top-performing videos</CardTitle>
                <CardDescription>Views ÷ subscribers above 1 means the video outran its channel, which is the signal to copy.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Video</TableHead><TableHead>Channel</TableHead>
                      <TableHead className="text-right">Views</TableHead><TableHead className="text-right">Views/subs</TableHead>
                      <TableHead className="text-right">Length</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {research.topVideos.slice(0, 25).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="max-w-md truncate">
                          <a href={`https://youtu.be/${v.id}`} target="_blank" rel="noreferrer" className="hover:underline">{v.title}</a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.channel}</TableCell>
                        <TableCell className="text-right">{fmt.format(v.views)}</TableCell>
                        <TableCell className="text-right">
                          {v.ratio >= 1 ? <Badge>{v.ratio}×</Badge> : <span className="text-muted-foreground">{v.ratio}×</span>}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{Math.round(v.durationSec / 60)} min</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        jobs.length === 0 && <p className="text-muted-foreground">No research yet.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{research ? "Re-run research" : "Run research"}</CardTitle>
          <CardDescription>Comma-separated YouTube searches that describe the niche.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={startResearchAction} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="slug" value={slug} />
            <Input name="queries" defaultValue={research?.queries.join(", ") ?? ""} placeholder={channel.niche} />
            <SubmitButton disabled={jobs.length > 0}>Research</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
