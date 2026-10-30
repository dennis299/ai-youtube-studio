import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeChannel, useTempDirs } from "./helpers";
import { saveChannel, getOverview } from "@/lib/store";
import { fetchChannelOverview, summarizeContentTypes, yppProgress } from "@/lib/youtube/overview";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(() => { dirs = useTempDirs(); });
afterEach(() => dirs.cleanup());

describe("summarizeContentTypes", () => {
  it("counts long-form and live watch time as hours, and keeps Shorts views apart", () => {
    const rows = [
      ["VIDEO_ON_DEMAND", 1200, 9000],
      ["LIVE_STREAM", 10, 600],
      ["SHORTS", 50000, 20000],
    ];
    expect(summarizeContentTypes(rows)).toEqual({ longFormHours: 160, shortsViews: 50000 });
  });

  it("returns zeros for an empty report", () => {
    expect(summarizeContentTypes(undefined)).toEqual({ longFormHours: 0, shortsViews: 0 });
  });
});

describe("yppProgress", () => {
  const base = { subscribers: 250, longFormHours12m: 1000, shortsViews90d: 2_500_000 };

  it("measures both YPP paths against 1,000 subs + 4,000 hours or 10M Shorts views", () => {
    const p = yppProgress(base);
    expect(p.subscribers).toEqual({ current: 250, target: 1000, pct: 25 });
    expect(p.watchHours).toEqual({ current: 1000, target: 4000, pct: 25 });
    expect(p.shortsViews).toEqual({ current: 2_500_000, target: 10_000_000, pct: 25 });
    expect(p.eligible).toBe(false);
  });

  it("is eligible with 1,000 subs and either path, and caps pct at 100", () => {
    expect(yppProgress({ ...base, subscribers: 1200, longFormHours12m: 4100 }).eligible).toBe(true);
    expect(yppProgress({ ...base, subscribers: 1000, shortsViews90d: 10_000_000 }).eligible).toBe(true);
    expect(yppProgress({ ...base, subscribers: 5000 }).subscribers.pct).toBe(100);
  });
});

describe("fetchChannelOverview", () => {
  it("combines channel statistics with both analytics windows and saves the result", async () => {
    await saveChannel(makeChannel());
    const queries: Record<string, unknown>[] = [];
    const fakeRun = (async (fn: (c: never) => unknown) =>
      fn({
        yt: {
          channels: {
            list: async () => ({
              data: { items: [{ statistics: { subscriberCount: "321", viewCount: "45678", videoCount: "12" } }] },
            }),
          },
        },
        analytics: {
          reports: {
            query: async (q: Record<string, unknown>) => {
              queries.push(q);
              return { data: { rows: [["VIDEO_ON_DEMAND", 900, 30000], ["SHORTS", 40000, 9000]] } };
            },
          },
        },
      } as never)) as never;

    const o = await fetchChannelOverview("built-and-broken", fakeRun);
    expect(o).toMatchObject({ subscribers: 321, totalViews: 45678, videoCount: 12, longFormHours12m: 500, shortsViews90d: 40000 });
    expect(queries.every((q) => q.dimensions === "creatorContentType")).toBe(true);
    expect(await getOverview("built-and-broken")).toMatchObject({ subscribers: 321 });
  });
});
