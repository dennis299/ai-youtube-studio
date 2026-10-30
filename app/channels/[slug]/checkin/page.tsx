import Link from "next/link";
import { ScrollRow } from "@/components/scroll-row";
import { syncJobs } from "@/lib/sync";
import { CircleCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelNav } from "@/components/channel-nav";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { StatusBadge } from "@/components/status-badge";
import { WaitingForAgent } from "@/components/waiting-for-agent";
import { approveAction, produceAction, storyboardAction, unapproveAction } from "@/app/actions";
import { CHECKLIST, isApproved } from "@/lib/checkin";
import { pendingJobs } from "@/lib/pending";
import { getChannel, getStoryboard, listVideos } from "@/lib/store";

const DAY = new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

export default async function CheckinPage(props: PageProps<"/channels/[slug]/checkin">) {
  await syncJobs();
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const [channel, all] = await Promise.all([getChannel(slug), listVideos(slug)]);
  if (!channel) return null;

  const weeks = [...new Set(all.map((v) => `${v.month}-w${v.week}`))];
  // Default to the earliest week that still has something waiting for a human decision.
  const open = all.find((v) => ["planned", "storyboarded"].includes(v.status));
  const week = typeof sp.week === "string" ? sp.week : open ? `${open.month}-w${open.week}` : weeks.at(-1);
  const videos = all.filter((v) => `${v.month}-w${v.week}` === week);
  const boards = await Promise.all(videos.map((v) => getStoryboard(slug, v.id)));
  const jobs = await pendingJobs(slug, ["storyboard", "produce"], (j) =>
    videos.some((v) => (j.input as { video?: { id: string } }).video?.id === v.id));
  const back = `/channels/${slug}/checkin?week=${week}`;
  const missing = videos.filter((_, i) => !boards[i]);
  const approvedCount = boards.filter((b) => isApproved(b)).length;
  const readyToProduce = videos.filter((v, i) => isApproved(boards[i]) && v.status === "approved");

  return (
    <>
      <ChannelNav channel={channel} active="Weekly check-in" />
      <Flash searchParams={props.searchParams} />

      {!week ? (
        <p className="text-muted-foreground">Plan a month first, then come back here every week to approve the next 5 videos.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Week {week.split("-w")[1]} of {week.slice(0, 7)}</h2>
              <p className="text-sm text-muted-foreground">
                {approvedCount} of {videos.length} approved. Nothing gets produced or published until you approve it here.
              </p>
            </div>
            <ScrollRow className="relative w-full rounded-lg bg-muted/50 p-1 text-sm sm:w-auto">
              {weeks.map((w) => (
                <Link
                  key={w}
                  href={`?week=${w}`}
                  aria-current={w === week ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 transition-colors ${w === week ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Week {w.split("-w")[1]}
                </Link>
              ))}
            </ScrollRow>
          </div>

          <WaitingForAgent jobs={jobs} back={back} />

          {missing.length > 0 && (
            <form action={storyboardAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="back" value={back} />
              {missing.map((v) => <input key={v.id} type="hidden" name="id" value={v.id} />)}
              <SubmitButton>Write storyboards for this week ({missing.length})</SubmitButton>
            </form>
          )}

          {readyToProduce.length > 0 && (
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                <p><CircleCheck className="mr-2 inline size-4 text-emerald-400" />{readyToProduce.length} approved video(s) ready for production.</p>
                <form action={produceAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="back" value={back} />
                  {readyToProduce.map((v) => <input key={v.id} type="hidden" name="id" value={v.id} />)}
                  <SubmitButton>Produce approved videos</SubmitButton>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {videos.map((v, i) => {
              const sb = boards[i];
              const ok = isApproved(sb);
              const secs = sb?.scenes.reduce((a, s) => a + s.seconds, 0) ?? 0;
              return (
                <Card key={v.id} className={ok ? "border-emerald-500/40" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{DAY.format(new Date(`${v.publishDate}T12:00:00Z`))} · {v.pillar}</p>
                        <CardTitle className="mt-1 leading-snug">
                          <Link href={`/channels/${slug}/videos/${v.id}`} className="hover:underline">{sb?.chosenTitle ?? v.workingTitle}</Link>
                        </CardTitle>
                      </div>
                      <StatusBadge status={v.status} />
                    </div>
                    <CardDescription>{v.angle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {!sb ? (
                      <p className="text-muted-foreground">No storyboard yet.</p>
                    ) : (
                      <>
                        <p className="italic">“{sb.hook}”</p>
                        <p className="text-xs text-muted-foreground">
                          {sb.scenes.length} scenes · {Math.floor(secs / 60)}:{String(Math.round(secs % 60)).padStart(2, "0")} · Short: scenes {sb.shortSegment.startScene}–{sb.shortSegment.endScene}
                          {sb.aiDisclosure && " · AI disclosure ON"}
                        </p>
                        {ok ? (
                          <form action={unapproveAction} className="flex items-center justify-between">
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={v.id} />
                            <input type="hidden" name="back" value={back} />
                            <span className="text-emerald-300">Approved {new Date(sb.approval!.at).toLocaleDateString()}</span>
                            <SubmitButton size="sm" variant="ghost">Undo</SubmitButton>
                          </form>
                        ) : (
                          <form action={approveAction} className="space-y-2 rounded-lg border p-3">
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={v.id} />
                            <input type="hidden" name="back" value={back} />
                            {CHECKLIST.map((c) => (
                              <label key={c.key} className="flex items-start gap-2 text-xs">
                                <input type="checkbox" name={c.key} className="mt-0.5" required /> {c.label}
                              </label>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <SubmitButton size="sm">Approve</SubmitButton>
                              <Link href={`/channels/${slug}/videos/${v.id}`} className="inline-flex h-7 items-center rounded-md px-2.5 text-xs hover:bg-muted">Edit storyboard</Link>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
