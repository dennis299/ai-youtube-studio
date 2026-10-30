import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { makeChannel, useTempDirs } from "./helpers";
import { getChannel, listChannels, saveChannel, saveVideo, listVideos } from "@/lib/store";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(() => { dirs = useTempDirs(); });
afterEach(() => dirs.cleanup());

describe("store", () => {
  it("round-trips a channel", async () => {
    const c = makeChannel();
    await saveChannel(c);
    expect(await getChannel("built-and-broken")).toEqual(c);
  });

  it("returns null for a missing channel", async () => {
    expect(await getChannel("nope")).toBeNull();
  });

  it("lists channels sorted by createdAt", async () => {
    await saveChannel(makeChannel({ slug: "b", createdAt: "2026-10-30T12:00:00.000Z" }));
    await saveChannel(makeChannel({ slug: "a", createdAt: "2026-10-29T12:00:00.000Z" }));
    expect((await listChannels()).map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("rejects a video with an invalid status", async () => {
    await saveChannel(makeChannel());
    await expect(
      saveVideo("built-and-broken", {
        id: "2026-11-w1-1", month: "2026-11", week: 1, publishDate: "2026-11-02",
        pillar: "The Fall", workingTitle: "Nokia", angle: "a", whyItWorks: "b",
        status: "bogus" as never,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("lists videos sorted by publish date", async () => {
    await saveChannel(makeChannel());
    const base = { month: "2026-11", week: 1 as const, pillar: "p", workingTitle: "t", angle: "a", whyItWorks: "w", status: "planned" as const };
    await saveVideo("built-and-broken", { ...base, id: "x2", publishDate: "2026-11-03" });
    await saveVideo("built-and-broken", { ...base, id: "x1", publishDate: "2026-11-02" });
    expect((await listVideos("built-and-broken")).map((v) => v.id)).toEqual(["x1", "x2"]);
  });
});
