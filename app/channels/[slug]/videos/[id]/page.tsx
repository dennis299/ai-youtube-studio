import Link from "next/link";
import { syncJobs } from "@/lib/sync";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { StatusBadge } from "@/components/status-badge";
import { WaitingForAgent } from "@/components/waiting-for-agent";
import {
  buildKitAction, linkPublishedAction, makeShortAction, produceAction, saveStoryboardAction,
  storyboardAction, updateVideoAction, uploadApiAction,
} from "@/app/actions";
import { isApproved } from "@/lib/checkin";
import { pendingJobs } from "@/lib/pending";
import { loadSettings } from "@/lib/settings";
import { getChannel, getProduction, getPublish, getStoryboard, getVideo } from "@/lib/store";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default async function VideoPage(props: PageProps<"/channels/[slug]/videos/[id]">) {
  await syncJobs();
  const { slug, id } = await props.params;
  const [channel, video, sb, prod, pub, settings] = await Promise.all([
    getChannel(slug), getVideo(slug, id), getStoryboard(slug, id), getProduction(slug, id), getPublish(slug, id), loadSettings(),
  ]);
  if (!channel || !video) notFound();
  const jobs = await pendingJobs(slug, ["storyboard", "produce"], (j) => (j.input as { video?: { id: string } }).video?.id === id);
  const approved = isApproved(sb);
  const total = sb?.scenes.reduce((a, s) => a + s.seconds, 0) ?? 0;
  const media = (kind: string) => `/api/media?slug=${slug}&id=${id}&kind=${kind}&v=${encodeURIComponent(prod?.videoPath ?? "")}`;

  return (
    <>
      <div className="space-y-2">
        <Link href={`/channels/${slug}/plan?month=${video.month}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {channel.name} · {video.month} plan
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{sb?.chosenTitle ?? video.workingTitle}</h1>
          <StatusBadge status={video.status} />
          {approved && <Badge className="bg-emerald-500/15 text-emerald-300">check-in approved</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{video.publishDate} · Week {video.week} · {video.pillar}</p>
      </div>
      <Flash searchParams={props.searchParams} />
      <WaitingForAgent jobs={jobs} back={`/channels/${slug}/videos/${id}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Topic</CardTitle></CardHeader>
            <CardContent>
              <form action={updateVideoAction} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={id} />
                <div className="space-y-1.5"><Label>Working title</Label><Input name="workingTitle" defaultValue={video.workingTitle} /></div>
                <div className="space-y-1.5"><Label>Angle</Label><Textarea name="angle" defaultValue={video.angle} /></div>
                <p className="text-xs text-muted-foreground">Why it should work: {video.whyItWorks}</p>
                <SubmitButton size="sm" variant="secondary">Save topic</SubmitButton>
              </form>
            </CardContent>
          </Card>

          {sb ? (
            <form action={saveStoryboardAction} className="space-y-6">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <Card>
                <CardHeader>
                  <CardTitle>Script</CardTitle>
                  <CardDescription>
                    {sb.scenes.length} scenes · {mmss(total)} total. Editing an approved storyboard sends it back to check-in.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <select name="chosenTitle" defaultValue={sb.chosenTitle} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                      {[...new Set([sb.chosenTitle, ...sb.titleOptions])].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5"><Label>Hook (first 15 seconds)</Label><Textarea name="hook" defaultValue={sb.hook} /></div>
                  <div className="space-y-3">
                    {sb.scenes.map((s) => (
                      <div key={s.n} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[48px_1fr_1fr_72px]">
                        <div className="text-xs text-muted-foreground">#{s.n}<br /><Badge variant="secondary" className="mt-1">{s.source}</Badge></div>
                        <Textarea name={`scene_${s.n}_narration`} defaultValue={s.narration} className="min-h-20 text-xs" />
                        <Textarea name={`scene_${s.n}_visual`} defaultValue={s.visual} className="min-h-20 text-xs text-muted-foreground" />
                        <Input name={`scene_${s.n}_seconds`} type="number" step="0.5" defaultValue={s.seconds} className="text-xs" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5"><Label>Outro</Label><Textarea name="outro" defaultValue={sb.outro} /></div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label>Short: first scene</Label><Input name="shortStart" type="number" defaultValue={sb.shortSegment.startScene} /></div>
                    <div className="space-y-1.5"><Label>Short: last scene</Label><Input name="shortEnd" type="number" defaultValue={sb.shortSegment.endScene} /></div>
                    <label className="flex items-center gap-2 pt-6 text-sm">
                      <input type="checkbox" name="aiDisclosure" defaultChecked={sb.aiDisclosure} /> AI disclosure
                    </label>
                  </div>
                  <SubmitButton>Save storyboard</SubmitButton>
                </CardContent>
              </Card>
            </form>
          ) : (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No storyboard yet.</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Storyboard</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <form action={storyboardAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="back" value={`/channels/${slug}/videos/${id}`} />
                <SubmitButton size="sm" variant={sb ? "secondary" : "default"} disabled={jobs.length > 0}>
                  {sb ? "Regenerate storyboard" : "Write storyboard"}
                </SubmitButton>
              </form>
              {sb && !approved && (
                <Link href={`/channels/${slug}/checkin?week=${video.month}-w${video.week}`} className="block text-primary underline underline-offset-4">
                  Approve at the weekly check-in →
                </Link>
              )}
              {sb && (
                <>
                  <div>
                    <p className="font-medium">Thumbnail concepts</p>
                    <ul className="list-disc pl-5 text-muted-foreground">{sb.thumbnailConcepts.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                  <div>
                    <p className="font-medium">Sources</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">{sb.sources.map((s) => <li key={s} className="break-all">{s}</li>)}</ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production</CardTitle>
              <CardDescription>OpenMontage · {channel.pipeline} · up to ${channel.budgetPerVideoUsd}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {prod && <p>Status: <strong>{prod.status}</strong>{prod.costUsd !== undefined && ` · $${prod.costUsd.toFixed(2)}`}</p>}
              {prod?.error && <p className="whitespace-pre-wrap text-xs text-destructive">{prod.error}</p>}
              {prod?.videoPath && (
                <video src={media("video")} controls className="w-full rounded-lg border" poster={prod.thumbnailPath ? media("thumb") : undefined} />
              )}
              {approved && (!prod || prod.status === "failed") && (
                <form action={produceAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="back" value={`/channels/${slug}/videos/${id}`} />
                  <SubmitButton size="sm" disabled={!settings.openMontagePath}>Produce with OpenMontage</SubmitButton>
                  {!settings.openMontagePath && <p className="mt-1 text-xs text-muted-foreground">Set the OpenMontage folder in Settings.</p>}
                </form>
              )}
              {!approved && !prod && <p className="text-muted-foreground">Production unlocks after check-in approval.</p>}
              {prod?.status === "rendered" && (
                <form action={makeShortAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton size="sm" variant="secondary">{prod.shortPath ? "Re-cut Short" : "Cut the Short (9:16)"}</SubmitButton>
                </form>
              )}
              {prod?.shortPath && (
                <video src={media("short")} controls className="mx-auto max-h-80 rounded-lg border" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
              <CardDescription>
                {channel.publishMode === "api" ? "API upload, scheduled with publishAt" : "Studio upload kit, uploaded by hand in YouTube Studio"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {pub?.url && <p>Live: <a href={pub.url} target="_blank" rel="noreferrer" className="text-primary underline">{pub.url}</a></p>}
              {pub?.kitPath && <p className="break-all text-xs text-muted-foreground">Kit: {pub.kitPath}</p>}
              {prod?.status === "rendered" && approved && !pub?.youtubeId && (
                <div className="flex flex-wrap gap-2">
                  <form action={buildKitAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={id} />
                    <SubmitButton size="sm">Build upload kit</SubmitButton>
                  </form>
                  {channel.publishMode === "api" && (
                    <form action={uploadApiAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={id} />
                      <SubmitButton size="sm" variant="secondary">Upload via API</SubmitButton>
                    </form>
                  )}
                </div>
              )}
              {prod?.status === "rendered" && (
                <form action={linkPublishedAction} className="space-y-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={id} />
                  <Label>Link published video</Label>
                  <div className="flex gap-2">
                    <Input name="url" placeholder="https://youtu.be/…" defaultValue={pub?.url ?? ""} />
                    <SubmitButton size="sm" variant="secondary">Link</SubmitButton>
                  </div>
                </form>
              )}
              {(!prod || prod.status !== "rendered") && <p className="text-muted-foreground">Publishing unlocks once the video is rendered.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
