import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeShort, segmentSeconds, shortArgs } from "@/lib/media/short";
import { approve, storyboardHash } from "@/lib/checkin";
import { getProduction, saveChannel, saveProduction, saveVideo, writeStoryboard } from "@/lib/store";
import type { Scene, Storyboard, VideoPlan } from "@/lib/schemas";
import { makeChannel, useTempDirs } from "./helpers";

const scenes: Scene[] = Array.from({ length: 12 }, (_, i) => ({
  n: i + 1, narration: "x", visual: "v", source: "stock", seconds: i < 6 ? 20 : 11,
}));

describe("Short cut-down", () => {
  it("turns a scene range into start/end seconds", () => {
    // scenes 1-6 are 20s each (120s); scenes 7-11 are 11s each
    expect(segmentSeconds(scenes, 7, 11)).toEqual({ startSec: 120, endSec: 175 });
  });

  it("keeps paths with spaces as single arguments", () => {
    const input = "E:\\Projects\\MTS business\\a b.mp4";
    const args = shortArgs({ input, output: "E:\\out dir\\short.mp4", startSec: 120, endSec: 175 });
    expect(args.filter((a) => a === input)).toHaveLength(1);
    expect(args.at(-1)).toBe("E:\\out dir\\short.mp4");
  });

  it("seeks to the segment and renders vertical 1080x1920", () => {
    const args = shortArgs({ input: "in.mp4", output: "out.mp4", startSec: 120, endSec: 175 });
    expect(args.join(" ")).toContain("-ss 120");
    expect(args.join(" ")).toContain("-to 175");
    expect(args.join(" ")).toContain("1080:1920");
  });

  it("burns in captions when an SRT is given", () => {
    const args = shortArgs({ input: "in.mp4", output: "out.mp4", startSec: 0, endSec: 30, captionsSrt: "C:\\a b\\cap.srt" });
    expect(args.join(" ")).toContain("subtitles=");
  });
});

describe("makeShort with a Short delivered by the render job", () => {
  let dirs: ReturnType<typeof useTempDirs>;
  beforeEach(() => { dirs = useTempDirs(); });
  afterEach(() => dirs.cleanup());

  it("adopts the delivered short.mp4 instead of re-cutting from estimated scene times", async () => {
    const video: VideoPlan = {
      id: "2026-11-w1-1", month: "2026-11", week: 1, publishDate: "2026-11-02", pillar: "The Fall",
      workingTitle: "Nokia", angle: "a", whyItWorks: "w", status: "rendered",
    };
    const sb: Storyboard = {
      videoId: video.id, titleOptions: ["T"], chosenTitle: "T", hook: "h", beats: [], scenes,
      outro: "o", thumbnailConcepts: [], shortSegment: { startScene: 7, endScene: 11, hookLine: "h" },
      sources: [], aiDisclosure: true,
    };
    await saveChannel(makeChannel());
    await saveVideo("built-and-broken", video);
    const approved = approve(sb, { original: true, visualsClean: true, disclosureSet: true, factsChecked: true });
    await writeStoryboard("built-and-broken", approved);
    const dir = path.join(dirs.root, "output", "built-and-broken", video.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "video.mp4"), "video");
    await writeFile(path.join(dir, "short.mp4"), "vertical short with hook");
    await saveProduction("built-and-broken", {
      videoId: video.id, jobId: "j", status: "rendered", videoPath: path.join(dir, "video.mp4"),
      storyboardHash: storyboardHash(approved),
    });

    const out = await makeShort("built-and-broken", video.id);

    expect(out).toBe(path.join(dir, "short.mp4"));
    expect(await readFile(out, "utf8")).toBe("vertical short with hook");
    expect((await getProduction("built-and-broken", video.id))?.shortPath).toBe(out);
  });
});
