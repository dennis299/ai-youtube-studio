"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runTask, type RunResult } from "@/lib/ai";
import { ingestDoneJobs, retryJob } from "@/lib/jobs";
import { getPreset } from "@/lib/presets";
import { loadSettings, saveSettings } from "@/lib/settings";
import { getChannel, getKit, getResearch, saveChannel, saveKit } from "@/lib/store";
import { disconnectGoogle } from "@/lib/youtube/client";
import { researchNiche } from "@/lib/youtube/research";
import type { Channel } from "@/lib/schemas";

// ---------- helpers ----------

function withParam(back: string, key: "ok" | "error", msg: string): string {
  const url = new URL(back, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  url.searchParams.set(key, msg);
  return url.pathname + url.search;
}

/** Run `fn`, then redirect back with ?ok= or ?error= so the page can show the result. */
async function attempt(back: string, fn: () => Promise<string>): Promise<never> {
  let msg: string;
  let failed = false;
  try {
    msg = await fn();
  } catch (err) {
    msg = (err as Error).message || String(err);
    failed = true;
  }
  revalidatePath("/", "layout");
  redirect(withParam(back, failed ? "error" : "ok", msg));
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d: number) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) && n > 0 ? n : d;
};

const ranMsg = (r: RunResult, what: string) =>
  r.mode === "done" ? `${what} is done.` : `${what} was queued for your AI agent. Run the agent, then click "Check for results".`;

async function requireChannel(slug: string): Promise<Channel> {
  const c = await getChannel(slug);
  if (!c) throw new Error(`Channel "${slug}" not found.`);
  return c;
}

export const slugify = async (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "channel";

async function startResearch(channel: Channel, queries: string[]): Promise<RunResult> {
  const settings = await loadSettings();
  const topVideos = settings.google.tokens ? await researchNiche(queries) : [];
  return runTask(channel.slug, "research", { channel, queries, topVideos });
}

// ---------- channels ----------

export async function createChannelAction(fd: FormData) {
  const preset = getPreset(str(fd, "preset"));
  const name = str(fd, "name") || preset?.label || "My channel";
  const slug = await slugify(name);
  const queries = (str(fd, "queries") || preset?.exampleQueries.join(", ") || name)
    .split(",").map((q) => q.trim()).filter(Boolean);
  const channel: Channel = {
    slug,
    name,
    niche: str(fd, "niche") || preset?.niche || name,
    style: str(fd, "style") || preset?.style || "",
    audience: str(fd, "audience") || preset?.audience || "",
    language: "en",
    cadence: { perWeek: Math.min(num(fd, "perWeek", 5), 7), days: [1, 2, 3, 4, 5, 6, 0].slice(0, Math.min(num(fd, "perWeek", 5), 7)) },
    videoMinutes: [num(fd, "minMinutes", 8), num(fd, "maxMinutes", 10)],
    budgetPerVideoUsd: num(fd, "budget", 5),
    pipeline: "documentary-montage",
    publishMode: (await loadSettings()).google.audited ? "api" : "studio-kit",
    stage: "research",
    createdAt: new Date().toISOString(),
  };
  let failed = "";
  try {
    if (await getChannel(slug)) throw new Error(`A channel called "${name}" already exists.`);
    await saveChannel(channel);
    await startResearch(channel, queries);
  } catch (err) {
    failed = (err as Error).message;
  }
  revalidatePath("/", "layout");
  if (failed && !(await getChannel(slug))) redirect(withParam("/channels/new", "error", failed));
  redirect(withParam(`/channels/${slug}`, failed ? "error" : "ok", failed || "Channel created. Research has started."));
}

export async function startResearchAction(fd: FormData) {
  const slug = str(fd, "slug");
  await attempt(`/channels/${slug}`, async () => {
    const channel = await requireChannel(slug);
    const prev = await getResearch(slug);
    const queries = (str(fd, "queries") || prev?.queries.join(", ") || channel.niche)
      .split(",").map((q) => q.trim()).filter(Boolean);
    return ranMsg(await startResearch(channel, queries), "Research");
  });
}

export async function startKitAction(fd: FormData) {
  const slug = str(fd, "slug");
  await attempt(`/channels/${slug}/kit`, async () => {
    const channel = await requireChannel(slug);
    return ranMsg(await runTask(slug, "channel_kit", { channel, research: await getResearch(slug) }), "Channel kit");
  });
}

export async function chooseNameAction(fd: FormData) {
  const slug = str(fd, "slug");
  const name = str(fd, "name");
  await attempt(`/channels/${slug}/kit`, async () => {
    const channel = await requireChannel(slug);
    const kit = await getKit(slug);
    if (kit) await saveKit(slug, { ...kit, chosenName: name });
    await saveChannel({ ...channel, name });
    return `Channel name set to "${name}". Rename it in YouTube Studio → Customization too.`;
  });
}

export async function updateChannelAction(fd: FormData) {
  const slug = str(fd, "slug");
  await attempt(`/channels/${slug}/kit`, async () => {
    const c = await requireChannel(slug);
    await saveChannel({
      ...c,
      budgetPerVideoUsd: num(fd, "budget", c.budgetPerVideoUsd),
      videoMinutes: [num(fd, "minMinutes", c.videoMinutes[0]), num(fd, "maxMinutes", c.videoMinutes[1])],
      publishMode: str(fd, "publishMode") === "api" ? "api" : "studio-kit",
      pipeline: str(fd, "pipeline") || c.pipeline,
    });
    return "Channel settings saved.";
  });
}

// ---------- jobs ----------

export async function syncJobsAction(fd: FormData) {
  await attempt(str(fd, "back") || "/jobs", async () => {
    const { applied, failed } = await ingestDoneJobs();
    if (failed.length) throw new Error(`${failed.length} job result(s) failed validation. See the Agent jobs page.`);
    return applied.length ? `Applied ${applied.length} result(s) from your agent.` : "No new results yet.";
  });
}

export async function retryJobAction(fd: FormData) {
  await attempt("/jobs", async () => {
    await retryJob(str(fd, "id"));
    return "Job moved back to the pending queue.";
  });
}

// ---------- settings ----------

export async function saveSettingsAction(fd: FormData) {
  await attempt("/settings", async () => {
    const current = await loadSettings();
    const keep = (k: string, prev?: string) => (str(fd, k) ? str(fd, k) : prev);
    const aiMode = str(fd, "aiMode");
    await saveSettings({
      aiMode: aiMode === "openai" || aiMode === "anthropic" ? aiMode : "agent",
      openaiKey: keep("openaiKey", current.openaiKey),
      anthropicKey: keep("anthropicKey", current.anthropicKey),
      openaiModel: str(fd, "openaiModel") || current.openaiModel,
      anthropicModel: str(fd, "anthropicModel") || current.anthropicModel,
      google: {
        ...current.google,
        clientId: keep("clientId", current.google.clientId),
        clientSecret: keep("clientSecret", current.google.clientSecret),
        audited: fd.get("audited") === "on",
      },
      openMontagePath: str(fd, "openMontagePath") || undefined,
      ffmpegPath: str(fd, "ffmpegPath") || "ffmpeg",
      agentCommand: str(fd, "agentCommand") || current.agentCommand,
    });
    return "Settings saved.";
  });
}

export async function disconnectGoogleAction() {
  await attempt("/settings", async () => {
    await disconnectGoogle();
    return "YouTube channel disconnected.";
  });
}
