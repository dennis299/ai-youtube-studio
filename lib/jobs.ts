import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { jobsDir, readJson, writeJson } from "./fsjson";
import { getTask, type TaskType } from "./tasks";

export const JobSchema = z.object({
  id: z.string(),
  type: z.enum(["research", "channel_kit", "monthly_plan", "storyboard", "produce", "insights"]),
  slug: z.string(),
  title: z.string(),
  createdAt: z.string(),
  status: z.enum(["pending", "in_progress", "done", "failed"]),
  input: z.unknown(),
  brief: z.string(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});
export type Job = z.infer<typeof JobSchema>;

const dir = (sub: "pending" | "done" | "archive") => path.join(jobsDir(), sub);

function newId(type: TaskType): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${type.replace("_", "-")}-${randomBytes(2).toString("hex")}`;
}

function agentHeader(job: Pick<Job, "id" | "type" | "slug">): string {
  return `<!-- AI YouTube Studio agent job -->
> **Job \`${job.id}\`** · type \`${job.type}\` · channel \`${job.slug}\`
>
> When finished: copy \`jobs/pending/${job.id}.json\` to \`jobs/done/${job.id}.json\`, set \`"status": "done"\` and put your result in \`"output"\`.
> Then delete both pending files. If you cannot finish, write it to jobs/done with \`"status": "failed"\` and an \`"error"\` message.
> Full instructions: AGENTS.md in the studio repo.

`;
}

export async function enqueueJob(slug: string, type: TaskType, input: unknown): Promise<Job> {
  const task = getTask(type);
  const id = newId(type);
  const job: Job = {
    id, type, slug,
    title: task.title(input),
    createdAt: new Date().toISOString(),
    status: "pending",
    input,
    brief: `${id}.md`,
  };
  await mkdir(dir("pending"), { recursive: true });
  await writeFile(path.join(dir("pending"), `${id}.md`), agentHeader(job) + task.buildPrompt(input), "utf8");
  await writeJson(path.join(dir("pending"), `${id}.json`), job);
  return job;
}

async function jsonFiles(d: string): Promise<string[]> {
  try {
    return (await readdir(d)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

/** Read one job file; unreadable files come back as a synthetic failed job. */
async function readJob(file: string, fallbackStatus?: Job["status"]): Promise<Job> {
  const id = path.basename(file, ".json");
  try {
    const job = JobSchema.parse(JSON.parse(await readFile(file, "utf8")));
    return fallbackStatus ? { ...job, status: fallbackStatus } : job;
  } catch (err) {
    return {
      id, type: "research", slug: "?", title: `Unreadable job file ${id}.json`, createdAt: "",
      status: "failed", input: null, brief: "", error: `Could not read job file: ${(err as Error).message}`,
    };
  }
}

export async function listJobs(): Promise<Job[]> {
  const out: Job[] = [];
  for (const sub of ["pending", "done", "archive"] as const) {
    for (const f of await jsonFiles(dir(sub))) {
      out.push(await readJob(path.join(dir(sub), f), sub === "archive" ? "done" : undefined));
    }
  }
  const seen = new Map<string, Job>();
  for (const j of out) seen.set(j.id, j); // later folders win (done over pending)
  return [...seen.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getJob(id: string): Promise<Job | null> {
  return (await listJobs()).find((j) => j.id === id) ?? null;
}

/** Apply every finished job in jobs/done. Bad results are marked failed and left in place. */
export async function ingestDoneJobs(): Promise<{ applied: string[]; failed: { id: string; error: string }[] }> {
  const applied: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const f of await jsonFiles(dir("done"))) {
    const file = path.join(dir("done"), f);
    const id = path.basename(f, ".json");
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      failed.push({ id, error: `Not valid JSON: ${(err as Error).message}` });
      continue;
    }
    const parsed = JobSchema.safeParse(raw);
    if (!parsed.success) {
      failed.push({ id, error: `Not a job file: ${parsed.error.message}` });
      continue;
    }
    const job = parsed.data;
    if (job.status === "failed") {
      // Already reported; give the task a chance to record it once.
      if (!job.error?.startsWith("[recorded] ")) {
        await getTask(job.type).onFail?.(job.slug, job.input, job.error ?? "Agent reported failure");
        await writeJson(file, { ...job, error: `[recorded] ${job.error ?? "Agent reported failure"}` });
      }
      failed.push({ id: job.id, error: job.error ?? "failed" });
      continue;
    }

    const task = getTask(job.type);
    try {
      const output = task.outputSchema.parse(job.output);
      await task.apply(job.slug, job.input, output);
    } catch (err) {
      const error = err instanceof z.ZodError ? `Output did not match the schema: ${err.message}` : (err as Error).message;
      await writeJson(file, { ...job, status: "failed", error });
      failed.push({ id: job.id, error });
      continue;
    }

    await writeJson(path.join(dir("archive"), `${job.id}.json`), { ...job, status: "done" });
    await rm(file, { force: true });
    await rm(path.join(dir("pending"), `${job.id}.json`), { force: true });
    await rm(path.join(dir("pending"), `${job.id}.md`), { force: true });
    applied.push(job.id);
  }
  return { applied, failed };
}

/** Put a failed job back in the pending queue. */
export async function retryJob(id: string): Promise<void> {
  const file = path.join(dir("done"), `${id}.json`);
  const job = JobSchema.parse(await readJson(file));
  const task = getTask(job.type);
  await mkdir(dir("pending"), { recursive: true });
  await writeFile(path.join(dir("pending"), `${id}.md`), agentHeader(job) + task.buildPrompt(job.input), "utf8");
  await writeJson(path.join(dir("pending"), `${id}.json`), { ...job, status: "pending", output: undefined, error: undefined });
  await rm(file, { force: true });
}
