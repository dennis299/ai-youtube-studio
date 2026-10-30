import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeChannel, useTempDirs } from "./helpers";
import { approve, storyboardHash } from "@/lib/checkin";
import { enqueueJob, ingestDoneJobs, retryJob } from "@/lib/jobs";
import { buildUploadKit } from "@/lib/publish/kit";
import { writeJson } from "@/lib/fsjson";
import { toYouTubeError } from "@/lib/youtube/errors";
import {
  getPublish, getVideo, listVideos, saveChannel, saveProduction, saveVideo, writeStoryboard,
} from "@/lib/store";
import type { Storyboard, VideoPlan } from "@/lib/schemas";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(async () => { dirs = useTempDirs(); await saveChannel(makeChannel()); });
afterEach(() => { dirs.cleanup(); vi.restoreAllMocks(); });

const slug = "built-and-broken";
const jobsDir = () => process.env.STUDIO_JOBS_DIR!;
const ticks = { original: true, visualsClean: true, disclosureSet: true, factsChecked: true };

const video: VideoPlan = {
  id: "2026-11-w1-1", month: "2026-11", week: 1, publishDate: "2026-11-02", pillar: "The Fall",
  workingTitle: "Nokia", angle: "a", whyItWorks: "w", status: "rendered",
};
const sb: Storyboard = {
  videoId: video.id, titleOptions: ["How Nokia Lost Everything"], chosenTitle: "How Nokia Lost Everything",
  hook: "hook", beats: [], scenes: [{ n: 1, narration: "n", visual: "v", source: "stock", seconds: 10 }],
  outro: "o", thumbnailConcepts: [], shortSegment: { startScene: 1, endScene: 1, hookLine: "h" },
  sources: ["https://a.example"], aiDisclosure: false,
};

async function renderedVideo(storyboard: Storyboard, hash: string | undefined) {
  await saveVideo(slug, video);
  await writeStoryboard(slug, storyboard);
  const file = path.join(dirs.root, "final.mp4");
  await writeFile(file, "video");
  await saveProduction(slug, { videoId: video.id, jobId: "j", status: "rendered", videoPath: file, storyboardHash: hash });
}

async function finish(jobId: string, patch: Record<string, unknown>) {
  const job = JSON.parse(await readFile(path.join(jobsDir(), "pending", `${jobId}.json`), "utf8"));
  await mkdir(path.join(jobsDir(), "done"), { recursive: true });
  await writeFile(path.join(jobsDir(), "done", `${jobId}.json`), JSON.stringify({ ...job, ...patch }));
}

describe("approval gate after production", () => {
  it("refuses an upload kit when the storyboard is no longer approved", async () => {
    await renderedVideo(sb, storyboardHash(sb));
    await expect(buildUploadKit(slug, video.id)).rejects.toThrow(/approved/i);
  });

  it("refuses an upload kit when the render came from a different storyboard", async () => {
    const approved = approve(sb, ticks);
    await renderedVideo(approved, "hash-of-an-older-storyboard");
    await expect(buildUploadKit(slug, video.id)).rejects.toThrow(/older version/i);
  });

  it("allows the kit when the render matches the approved storyboard", async () => {
    const approved = approve(sb, ticks);
    await renderedVideo(approved, storyboardHash(approved));
    await expect(buildUploadKit(slug, video.id)).resolves.toContain("kit");
  });

  it("will not retry a produce job whose storyboard changed since it was queued", async () => {
    const approved = approve(sb, ticks);
    await saveVideo(slug, { ...video, status: "producing" });
    await writeStoryboard(slug, approved);
    const job = await enqueueJob(slug, "produce", { channel: makeChannel(), video, storyboard: approved, openMontagePath: "x", outputDir: "y" });
    await finish(job.id, { status: "failed", error: "render crashed" });
    await ingestDoneJobs();
    await writeStoryboard(slug, { ...approved, hook: "edited", approval: undefined });
    await expect(retryJob(job.id)).rejects.toThrow(/approved/i);
  });

  it("a fresh storyboard result does not reset a rendered video", async () => {
    await saveVideo(slug, video);
    const job = await enqueueJob(slug, "storyboard", { channel: makeChannel(), kit: null, video });
    const { videoId: _v, approval: _a, ...out } = sb;
    await finish(job.id, { status: "done", output: out });
    await ingestDoneJobs();
    expect((await getVideo(slug, video.id))?.status).toBe("rendered");
  });
});

describe("robust ingest", () => {
  it("survives a failed job file with no input", async () => {
    const job = await enqueueJob(slug, "produce", { channel: makeChannel(), video, storyboard: sb, openMontagePath: "x", outputDir: "y" });
    await finish(job.id, { status: "failed", error: "boom", input: null });
    await expect(ingestDoneJobs()).resolves.toBeTruthy();
  });

  it("rejects a done file whose id does not match its filename", async () => {
    const victim = await enqueueJob(slug, "insights", { channel: makeChannel(), stats: [], videos: [] });
    const job = await enqueueJob(slug, "insights", { channel: makeChannel(), stats: [], videos: [] });
    await finish(job.id, { status: "done", id: victim.id, output: { winners: [], losers: [], guidance: "g" } });
    const res = await ingestDoneJobs();
    expect(res.failed.map((f) => f.id)).toContain(job.id);
    expect(existsSync(path.join(jobsDir(), "pending", `${victim.id}.json`))).toBe(true);
  });

  it("applies a result once even when two ingests run at the same time", async () => {
    const job = await enqueueJob(slug, "insights", { channel: makeChannel(), stats: [], videos: [] });
    await finish(job.id, { status: "done", output: { winners: [], losers: [], guidance: "g" } });
    const [a, b] = await Promise.all([ingestDoneJobs(), ingestDoneJobs()]);
    expect([...a.applied, ...b.applied]).toEqual([job.id]);
    expect([...a.failed, ...b.failed]).toEqual([]);
  });

  it("concurrent writes to the same file both succeed", async () => {
    const f = path.join(dirs.root, "x.json");
    await expect(Promise.all(Array.from({ length: 8 }, (_, i) => writeJson(f, { i })))).resolves.toBeTruthy();
  });
});

describe("re-planning", () => {
  const ideas = Array.from({ length: 20 }, (_, i) => ({ pillar: "P", workingTitle: `New ${i + 1}`, angle: "a", whyItWorks: "w" }));
  const planInput = { channel: makeChannel(), research: null, kit: null, month: "2026-11", insights: null };

  it("keeps a planned video whose storyboard job is still pending", async () => {
    await saveVideo(slug, { ...video, status: "planned" });
    await enqueueJob(slug, "storyboard", { channel: makeChannel(), kit: null, video: { ...video, status: "planned" } });
    const plan = await enqueueJob(slug, "monthly_plan", planInput);
    await finish(plan.id, { status: "done", output: { videos: ideas } });
    await ingestDoneJobs();
    expect((await getVideo(slug, video.id))?.workingTitle).toBe("Nokia");
    expect(await listVideos(slug)).toHaveLength(20);
  });

  it("rejects a storyboard written for a topic that has since changed", async () => {
    await saveVideo(slug, { ...video, status: "planned" });
    const job = await enqueueJob(slug, "storyboard", { channel: makeChannel(), kit: null, video: { ...video, status: "planned" } });
    await saveVideo(slug, { ...video, status: "planned", workingTitle: "Something else" });
    const { videoId: _v, approval: _a, ...out } = sb;
    await finish(job.id, { status: "done", output: out });
    const res = await ingestDoneJobs();
    expect(res.failed[0]?.error).toMatch(/topic changed/i);
  });
});

describe("expired Google token", () => {
  it("maps invalid_grant to the reconnect message", () => {
    const err = toYouTubeError({ response: { data: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }, status: 400 });
    expect(err.reason).toBe("authError");
    expect(err.message).toMatch(/reconnect/i);
  });
});

describe("API upload", () => {
  it("records the upload even if the thumbnail call fails, and does not throw", async () => {
    const approved = approve(sb, ticks);
    await renderedVideo(approved, storyboardHash(approved));
    const thumb = path.join(dirs.root, "thumb.png");
    await writeFile(thumb, "png");
    await saveProduction(slug, { videoId: video.id, jobId: "j", status: "rendered", videoPath: path.join(dirs.root, "final.mp4"), thumbnailPath: thumb, storyboardHash: storyboardHash(approved) });
    const { saveSettings } = await import("@/lib/settings");
    await saveSettings({ google: { audited: true, tokens: { access_token: "x" } } });

    const fakeRun = (async (fn: (c: never) => unknown) =>
      fn({
        yt: {
          videos: { insert: async () => ({ data: { id: "abcdefghijk" } }) },
          thumbnails: { set: async () => { throw new Error("thumbnail not allowed"); } },
        },
        analytics: {},
      } as never)) as never;
    const { uploadVideo } = await import("@/lib/youtube/upload");
    const res = await uploadVideo(slug, video.id, fakeRun);
    expect(res.youtubeId).toBe("abcdefghijk");
    expect(res.warning).toMatch(/thumbnail/i);
    expect((await getPublish(slug, video.id))?.youtubeId).toBe("abcdefghijk");
  }, 30000);
});
