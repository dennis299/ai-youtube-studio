import Link from "next/link";
import { syncJobs } from "@/lib/sync";
import { ArrowRight, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/link-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SetupNotice } from "@/components/setup-notice";
import { listChannels, listVideos } from "@/lib/store";
import { listJobs } from "@/lib/jobs";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await syncJobs();
  const [channels, jobs, settings] = await Promise.all([listChannels(), listJobs(), loadSettings()]);
  const pending = jobs.filter((j) => j.status === "pending" || j.status === "in_progress").length;
  const counts = await Promise.all(channels.map(async (c) => {
    const videos = await listVideos(c.slug);
    return {
      c,
      planned: videos.length,
      approved: videos.filter((v) => ["approved", "producing", "rendered", "published"].includes(v.status)).length,
      published: videos.filter((v) => v.status === "published").length,
    };
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your channels</h1>
        <p className="text-muted-foreground">
          Niche → research → channel kit → monthly plan → storyboards → weekly check-in → produce → publish → learn.
        </p>
      </header>

      <SetupNotice settings={settings} />

      {pending > 0 && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              <Sparkles className="mr-2 inline size-4 text-primary" />
              {pending} job{pending === 1 ? "" : "s"} waiting for your AI agent.
            </p>
            <LinkButton href="/jobs" size="sm" variant="secondary">Open job inbox</LinkButton>
          </CardContent>
        </Card>
      )}

      {channels.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No channels yet</CardTitle>
            <CardDescription>Pick a niche and let the AI research what is already working on YouTube.</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkButton href="/channels/new">Find a niche <ArrowRight className="size-4" /></LinkButton>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {counts.map(({ c, planned, approved, published }) => (
            <Link key={c.slug} href={`/channels/${c.slug}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{c.name}</CardTitle>
                    <Badge variant="secondary">{c.stage}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">{c.niche}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-6 text-sm text-muted-foreground">
                  <span><strong className="text-foreground">{planned}</strong> planned</span>
                  <span><strong className="text-foreground">{approved}</strong> approved</span>
                  <span><strong className="text-foreground">{published}</strong> published</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
