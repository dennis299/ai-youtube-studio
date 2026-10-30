import { getPublish, listVideos, saveStats } from "../store";
import type { Stats } from "../schemas";
import { withYouTube } from "./client";
import { callCharged } from "./quota";

/** Refresh views/likes/comments (and average view duration when Analytics allows) for published videos. */
export async function fetchStats(slug: string): Promise<Stats[]> {
  const published: { videoId: string; youtubeId: string; publishDate: string }[] = [];
  for (const v of await listVideos(slug)) {
    const p = await getPublish(slug, v.id);
    if (p?.youtubeId) published.push({ videoId: v.id, youtubeId: p.youtubeId, publishDate: v.publishDate });
  }
  if (published.length === 0) return [];

  return withYouTube(async ({ yt, analytics }) => {
    const out: Stats[] = [];
    for (let i = 0; i < published.length; i += 50) {
      const batch = published.slice(i, i + 50);
      const res = await callCharged("videosList", 1, () =>
        yt.videos.list({ part: ["statistics"], id: batch.map((b) => b.youtubeId) }),
      );
      for (const item of res.data.items ?? []) {
        const b = batch.find((x) => x.youtubeId === item.id);
        if (!b) continue;
        let avgViewDurationSec: number | undefined;
        try {
          const a = await analytics.reports.query({
            ids: "channel==MINE",
            startDate: b.publishDate,
            endDate: new Date().toISOString().slice(0, 10),
            metrics: "averageViewDuration",
            filters: `video==${b.youtubeId}`,
          });
          const v = a.data.rows?.[0]?.[0];
          if (typeof v === "number") avgViewDurationSec = v;
        } catch {
          // Analytics lags a few days for new videos; views still count.
        }
        const s: Stats = {
          videoId: b.videoId,
          youtubeId: b.youtubeId,
          fetchedAt: new Date().toISOString(),
          views: Number(item.statistics?.viewCount ?? 0),
          likes: Number(item.statistics?.likeCount ?? 0),
          comments: Number(item.statistics?.commentCount ?? 0),
          avgViewDurationSec,
        };
        await saveStats(slug, s);
        out.push(s);
      }
    }
    return out;
  });
}
