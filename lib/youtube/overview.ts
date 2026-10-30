import { saveOverview } from "../store";
import type { ChannelOverview } from "../schemas";
import { withYouTube } from "./client";
import { callCharged } from "./quota";

/** YouTube Partner Program (ads + Premium revenue) thresholds. Check YouTube Studio → Earn for the official count. */
export const YPP = { subscribers: 1000, watchHours: 4000, shortsViews: 10_000_000 } as const;

type Runner = typeof withYouTube;
type Row = unknown[];

/** Analytics rows are [creatorContentType, views, estimatedMinutesWatched]. Shorts watch time doesn't count toward YPP hours. */
export function summarizeContentTypes(rows: Row[] | undefined | null): { longFormHours: number; shortsViews: number } {
  let minutes = 0;
  let shortsViews = 0;
  for (const [type, views, mins] of rows ?? []) {
    if (type === "SHORTS") shortsViews += Number(views) || 0;
    else if (type === "VIDEO_ON_DEMAND" || type === "LIVE_STREAM") minutes += Number(mins) || 0;
  }
  return { longFormHours: Math.floor(minutes / 60), shortsViews };
}

type Meter = { current: number; target: number; pct: number };
const meter = (current: number, target: number): Meter => ({
  current,
  target,
  pct: Math.min(100, Math.floor((current / target) * 100)),
});

export function yppProgress(o: Pick<ChannelOverview, "subscribers" | "longFormHours12m" | "shortsViews90d">) {
  const subscribers = meter(o.subscribers, YPP.subscribers);
  const watchHours = meter(o.longFormHours12m, YPP.watchHours);
  const shortsViews = meter(o.shortsViews90d, YPP.shortsViews);
  const eligible = subscribers.pct === 100 && (watchHours.pct === 100 || shortsViews.pct === 100);
  return { subscribers, watchHours, shortsViews, eligible };
}

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Subscribers, lifetime views, and the two YPP windows for the connected channel. Costs 1 quota unit. */
export async function fetchChannelOverview(slug: string, run: Runner = withYouTube): Promise<ChannelOverview> {
  const overview = await run(async ({ yt, analytics }) => {
    const ch = await callCharged("channelsList", 1, () => yt.channels.list({ part: ["statistics"], mine: true }));
    const st = ch.data.items?.[0]?.statistics;
    if (!st) throw new Error("YouTube returned no channel for this account.");

    const byType = async (days: number) => {
      const res = await analytics.reports.query({
        ids: "channel==MINE",
        startDate: isoDaysAgo(days),
        endDate: isoDaysAgo(0),
        metrics: "views,estimatedMinutesWatched",
        dimensions: "creatorContentType",
      });
      return summarizeContentTypes(res.data.rows as Row[] | undefined);
    };
    const [year, quarter] = await Promise.all([byType(365), byType(90)]);

    return {
      fetchedAt: new Date().toISOString(),
      subscribers: Number(st.subscriberCount ?? 0),
      totalViews: Number(st.viewCount ?? 0),
      videoCount: Number(st.videoCount ?? 0),
      longFormHours12m: year.longFormHours,
      shortsViews90d: quarter.shortsViews,
    } satisfies ChannelOverview;
  });
  await saveOverview(slug, overview);
  return overview;
}
