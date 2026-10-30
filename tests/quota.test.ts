import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTempDirs } from "./helpers";
import { assertQuota, callCharged, chargeQuota, pacificDate, QuotaError, remainingQuota } from "@/lib/youtube/quota";
import { YouTubeError, toYouTubeError } from "@/lib/youtube/errors";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(() => { dirs = useTempDirs(); });
afterEach(() => dirs.cleanup());

const day1 = new Date("2026-11-02T18:00:00Z"); // 10:00 Pacific, Nov 2
const day2 = new Date("2026-11-03T09:00:00Z"); // 01:00 Pacific, Nov 3

describe("quota", () => {
  it("charges searches and uploads against the 10,000 daily units", async () => {
    await chargeQuota("search", 3, day1);
    await chargeQuota("insert", 1, day1);
    expect(await remainingQuota(day1)).toBe(8100);
  });

  it("resets on a new Pacific-time day", async () => {
    await chargeQuota("insert", 2, day1);
    expect(await remainingQuota(day2)).toBe(10000);
  });

  it("uses the Pacific date, not UTC", () => {
    expect(pacificDate(new Date("2026-11-03T05:00:00Z"))).toBe("2026-11-02");
  });

  it("refuses an operation that would exceed the quota", async () => {
    await expect(assertQuota("insert", 7, day1)).rejects.toBeInstanceOf(QuotaError);
  });

  it("does not charge a call that fails", async () => {
    await expect(callCharged("search", 1, async () => { throw new Error("boom"); }, day1)).rejects.toThrow();
    expect(await remainingQuota(day1)).toBe(10000);
    await callCharged("search", 1, async () => "ok", day1);
    expect(await remainingQuota(day1)).toBe(9900);
  });
});

describe("youtube errors", () => {
  it("turns quotaExceeded into a plain-English message", () => {
    const err = toYouTubeError({ code: 403, errors: [{ reason: "quotaExceeded" }], message: "raw" });
    expect(err).toBeInstanceOf(YouTubeError);
    expect(err.reason).toBe("quotaExceeded");
    expect(err.message).toMatch(/daily YouTube API quota/i);
  });

  it("keeps unknown errors readable", () => {
    expect(toYouTubeError(new Error("socket hang up")).message).toContain("socket hang up");
  });
});
