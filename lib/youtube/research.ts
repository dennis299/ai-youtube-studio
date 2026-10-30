import { createHash } from "node:crypto";
import path from "node:path";
import { dataDir, readJson, writeJson } from "../fsjson";
import type { TopVideo } from "../schemas";
import { withYouTube } from "./client";
import { callCharged } from "./quota";

const CACHE_DAYS = 7;

/** ISO 8601 duration (PT1H2M3S) to seconds. */
export function durationToSeconds(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * Top long-form videos from the last 12 months for each query, enriched with
 * views and channel subscriber counts. Cached for 7 days to save quota.
 */
export async function researchNiche(queries: string[], perQuery = 10): Promise<TopVideo[]> {
  const key = createHash("sha256").update(JSON.stringify({ queries, perQuery })).digest("hex").slice(0, 16);
  const cacheFile = path.join(dataDir(), "cache", `research-${key}.json`);
  const cached = await readJson<{ at: string; videos: TopVideo[] }>(cacheFile);
  if (cached && Date.now() - Date.parse(cached.at) < CACHE_DAYS * 86400_000) return cached.videos;

  const since = new Date(Date.now() - 365 * 86400_000).toISOString();
  const videos = await withYouTube(async ({ yt }) => {
    const ids = new Set<string>();
    for (const q of queries) {
      for (const videoDuration of ["medium", "long"] as const) {
        const res = await callCharged("search", 1, () =>
          yt.search.list({
            part: ["id"], q, type: ["video"], order: "viewCount", publishedAfter: since,
            videoDuration, maxResults: Math.ceil(perQuery / 2), relevanceLanguage: "en",
          }),
        );
        res.data.items?.forEach((i) => i.id?.videoId && ids.add(i.id.videoId));
      }
    }
    if (ids.size === 0) return [];

    const details = [];
    const idList = [...ids];
    for (let i = 0; i < idList.length; i += 50) {
      const res = await callCharged("videosList", 1, () =>
        yt.videos.list({ part: ["snippet", "statistics", "contentDetails"], id: idList.slice(i, i + 50) }),
      );
      details.push(...(res.data.items ?? []));
    }

    const channelIds = [...new Set(details.map((v) => v.snippet?.channelId).filter(Boolean) as string[])];
    const subs = new Map<string, number>();
    for (let i = 0; i < channelIds.length; i += 50) {
      const res = await callCharged("channelsList", 1, () =>
        yt.channels.list({ part: ["statistics"], id: channelIds.slice(i, i + 50) }),
      );
      res.data.items?.forEach((c) => c.id && subs.set(c.id, Number(c.statistics?.subscriberCount ?? 0)));
    }

    return details
      .map((v): TopVideo => {
        const views = Number(v.statistics?.viewCount ?? 0);
        const s = subs.get(v.snippet?.channelId ?? "") ?? 0;
        return {
          id: v.id ?? "",
          title: v.snippet?.title ?? "",
          channel: v.snippet?.channelTitle ?? "",
          views,
          subs: s,
          ratio: s > 0 ? Math.round((views / s) * 100) / 100 : 0,
          durationSec: durationToSeconds(v.contentDetails?.duration ?? ""),
          publishedAt: v.snippet?.publishedAt ?? "",
        };
      })
      .sort((a, b) => b.views - a.views);
  });

  await writeJson(cacheFile, { at: new Date().toISOString(), videos });
  return videos;
}
