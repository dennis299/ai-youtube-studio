import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeChannel, useTempDirs } from "./helpers";
import { enqueueJob, ingestDoneJobs, listJobs } from "@/lib/jobs";
import { listVideos, saveChannel } from "@/lib/store";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(async () => { dirs = useTempDirs(); await saveChannel(makeChannel()); });
afterEach(() => dirs.cleanup());

const jobsDir = () => process.env.STUDIO_JOBS_DIR!;

async function finish(jobId: string, output: unknown) {
  const pending = path.join(jobsDir(), "pending", `${jobId}.json`);
  const job = JSON.parse(await readFile(pending, "utf8"));
  await mkdir(path.join(jobsDir(), "done"), { recursive: true });
  await writeFile(path.join(jobsDir(), "done", `${jobId}.json`), JSON.stringify({ ...job, status: "done", output }));
}

const planInput = () => ({ channel: makeChannel(), research: null, kit: null, month: "2026-11", insights: null });

const twentyVideos = Array.from({ length: 20 }, (_, i) => ({
  pillar: "The Fall", workingTitle: `Story ${i + 1}`, angle: "angle", whyItWorks: "because",
}));

describe("agent job queue", () => {
  it("writes a json job and a markdown brief", async () => {
    const job = await enqueueJob("built-and-broken", "monthly_plan", planInput());
    expect(existsSync(path.join(jobsDir(), "pending", `${job.id}.json`))).toBe(true);
    const brief = await readFile(path.join(jobsDir(), "pending", `${job.id}.md`), "utf8");
    expect(brief).toContain(job.id);
    expect(brief).toContain("jobs/done");
  });

  it("ingests a valid monthly plan into 20 weekday videos", async () => {
    const job = await enqueueJob("built-and-broken", "monthly_plan", planInput());
    await finish(job.id, { videos: twentyVideos });
    const res = await ingestDoneJobs();
    expect(res.applied).toEqual([job.id]);
    const videos = await listVideos("built-and-broken");
    expect(videos).toHaveLength(20);
    expect(videos[0]).toMatchObject({ id: "2026-11-w1-1", publishDate: "2026-11-02", status: "planned" });
    expect(existsSync(path.join(jobsDir(), "archive", `${job.id}.json`))).toBe(true);
    expect(existsSync(path.join(jobsDir(), "pending", `${job.id}.json`))).toBe(false);
  });

  it("marks a schema-invalid result as failed and keeps the file", async () => {
    const job = await enqueueJob("built-and-broken", "monthly_plan", planInput());
    await finish(job.id, { bad: 1 });
    const res = await ingestDoneJobs();
    expect(res.failed.map((f) => f.id)).toEqual([job.id]);
    const kept = JSON.parse(await readFile(path.join(jobsDir(), "done", `${job.id}.json`), "utf8"));
    expect(kept.status).toBe("failed");
    expect(kept.error).toBeTruthy();
    expect(await listVideos("built-and-broken")).toHaveLength(0);
  });

  it("reports a non-JSON done file as failed without throwing", async () => {
    await mkdir(path.join(jobsDir(), "done"), { recursive: true });
    await writeFile(path.join(jobsDir(), "done", "garbage.json"), "this is not json");
    const res = await ingestDoneJobs();
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].id).toBe("garbage");
    const jobs = await listJobs();
    expect(jobs.find((j) => j.id === "garbage")?.status).toBe("failed");
  });
});
