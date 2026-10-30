"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runTask, type RunResult } from "@/lib/ai";
import { ingestDoneJobs, retryJob } from "@/lib/jobs";
import { getPreset } from "@/lib/presets";
import { loadSettings, saveSettings } from "@/lib/settings";
import path from "node:path";
import { outputDir } from "@/lib/fsjson";
import { makeShort } from "@/lib/media/short";
import { buildUploadKit, parseYouTubeId } from "@/lib/publish/kit";
import { fetchStats } from "@/lib/youtube/stats";
import { uploadVideo } from "@/lib/youtube/upload";
import {
  getChannel, getInsights, getKit, getPublish, getResearch, getStoryboard, getVideo, listStats, listVideos,
  saveChannel, saveKit, saveProduction, savePublish, saveVideo,
} from "@/lib/store";
import { approve, isApproved, saveStoryboard, storyboardHash } from "@/lib/checkin";
import { pendingJobs } from "@/lib/pending";
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

// ---------- plan, storyboards, check-in ----------

export async function planMonthAction(fd: FormData) {
  const slug = str(fd, "slug");
  const month = str(fd, "month");
  await attempt(`/channels/${slug}/plan?month=${month}`, async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Pick a month first.");
    const channel = await requireChannel(slug);
    const [research, kit, insights] = await Promise.all([getResearch(slug), getKit(slug), getInsights(slug)]);
    return ranMsg(await runTask(slug, "monthly_plan", { channel, research, kit, month, insights }), `The ${month} plan`);
  });
}

export async function storyboardAction(fd: FormData) {
  const slug = str(fd, "slug");
  const ids = fd.getAll("id").map(String);
  await attempt(str(fd, "back") || `/channels/${slug}/checkin`, async () => {
    const channel = await requireChannel(slug);
    const kit = await getKit(slug);
    const open = await pendingJobs(slug, ["storyboard"]);
    let queued = 0;
    let done = 0;
    for (const id of ids) {
      const video = await getVideo(slug, id);
      if (!video) continue;
      if (open.some((j) => (j.input as { video?: { id: string } }).video?.id === id)) continue;
      const r = await runTask(slug, "storyboard", { channel, kit, video });
      if (r.mode === "queued") queued++; else done++;
    }
    if (queued) return `${queued} storyboard(s) queued for your AI agent. Run the agent, then click "Check for results".`;
    return `${done} storyboard(s) written.`;
  });
}

export async function updateVideoAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(`/channels/${slug}/videos/${id}`, async () => {
    const v = await getVideo(slug, id);
    if (!v) throw new Error("Video not found.");
    await saveVideo(slug, { ...v, workingTitle: str(fd, "workingTitle") || v.workingTitle, angle: str(fd, "angle") || v.angle });
    return "Topic updated. Regenerate the storyboard to use it.";
  });
}

export async function saveStoryboardAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(`/channels/${slug}/videos/${id}`, async () => {
    const sb = await getStoryboard(slug, id);
    if (!sb) throw new Error("No storyboard to save.");
    const scenes = sb.scenes.map((s) => ({
      ...s,
      narration: str(fd, `scene_${s.n}_narration`) || s.narration,
      visual: str(fd, `scene_${s.n}_visual`) || s.visual,
      seconds: num(fd, `scene_${s.n}_seconds`, s.seconds),
    }));
    const saved = await saveStoryboard(slug, {
      ...sb,
      chosenTitle: str(fd, "chosenTitle") || sb.chosenTitle,
      hook: str(fd, "hook") || sb.hook,
      outro: str(fd, "outro") || sb.outro,
      aiDisclosure: fd.get("aiDisclosure") === "on",
      shortSegment: {
        ...sb.shortSegment,
        startScene: num(fd, "shortStart", sb.shortSegment.startScene),
        endScene: num(fd, "shortEnd", sb.shortSegment.endScene),
      },
      scenes,
    });
    return sb.approval && !saved.approval
      ? "Saved. Your edits changed an approved storyboard, so it needs check-in approval again."
      : "Storyboard saved.";
  });
}

export async function approveAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(str(fd, "back") || `/channels/${slug}/checkin`, async () => {
    const sb = await getStoryboard(slug, id);
    if (!sb) throw new Error("Generate the storyboard before approving.");
    const checklist = {
      original: fd.get("original") === "on",
      visualsClean: fd.get("visualsClean") === "on",
      disclosureSet: fd.get("disclosureSet") === "on",
      factsChecked: fd.get("factsChecked") === "on",
    };
    await saveStoryboard(slug, approve(sb, checklist));
    return `Approved "${sb.chosenTitle}".`;
  });
}

export async function unapproveAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(str(fd, "back") || `/channels/${slug}/checkin`, async () => {
    const sb = await getStoryboard(slug, id);
    if (!sb) throw new Error("No storyboard.");
    await saveStoryboard(slug, { ...sb, approval: undefined });
    return "Approval removed.";
  });
}

// ---------- produce, publish, stats ----------

export async function produceAction(fd: FormData) {
  const slug = str(fd, "slug");
  const ids = fd.getAll("id").map(String);
  await attempt(str(fd, "back") || `/channels/${slug}/checkin`, async () => {
    const channel = await requireChannel(slug);
    const settings = await loadSettings();
    if (!settings.openMontagePath) throw new Error("Set your OpenMontage folder in Settings first.");
    let queued = 0;
    for (const id of ids) {
      const [video, sb] = await Promise.all([getVideo(slug, id), getStoryboard(slug, id)]);
      if (!video || !sb) continue;
      if (!isApproved(sb)) throw new Error(`"${sb.chosenTitle}" is not approved. Approve it at the weekly check-in first.`);
      const r = await runTask(slug, "produce", {
        channel, video, storyboard: sb,
        openMontagePath: settings.openMontagePath,
        outputDir: path.join(outputDir(), slug, id),
      });
      if (r.mode === "queued") {
        await saveProduction(slug, { videoId: id, jobId: r.jobId, status: "queued", storyboardHash: storyboardHash(sb) });
        await saveVideo(slug, { ...video, status: "producing" });
        queued++;
      }
    }
    if (!queued) throw new Error("Nothing to produce.");
    const c = await getChannel(slug);
    if (c && c.stage !== "producing") await saveChannel({ ...c, stage: "producing" });
    return `${queued} video(s) sent to production. Run your agent so it can drive OpenMontage, then click "Check for results".`;
  });
}

export async function makeShortAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(`/channels/${slug}/videos/${id}`, async () => {
    await makeShort(slug, id);
    return "Short created (1080×1920).";
  });
}

export async function buildKitAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(`/channels/${slug}/videos/${id}`, async () => {
    const dir = await buildUploadKit(slug, id);
    return `Upload kit ready in ${dir}. Open upload.txt and follow the steps in YouTube Studio.`;
  });
}

export async function uploadApiAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(`/channels/${slug}/videos/${id}`, async () => {
    const { url, warning } = await uploadVideo(slug, id);
    return warning ? `Uploaded and scheduled: ${url}. ${warning}` : `Uploaded and scheduled: ${url}`;
  });
}

export async function linkPublishedAction(fd: FormData) {
  const slug = str(fd, "slug");
  const id = str(fd, "id");
  await attempt(`/channels/${slug}/videos/${id}`, async () => {
    const youtubeId = parseYouTubeId(str(fd, "url"));
    if (!youtubeId) throw new Error("That doesn't look like a YouTube video link.");
    const [video, prev] = await Promise.all([getVideo(slug, id), getPublish(slug, id)]);
    if (!video) throw new Error("Video not found.");
    await savePublish(slug, {
      videoId: id, mode: prev?.mode ?? "studio-kit", kitPath: prev?.kitPath,
      publishAt: prev?.publishAt ?? new Date().toISOString(),
      youtubeId, url: `https://youtu.be/${youtubeId}`,
    });
    await saveVideo(slug, { ...video, status: "published" });
    return "Linked. Stats for this video will show on the Stats page.";
  });
}

export async function fetchStatsAction(fd: FormData) {
  const slug = str(fd, "slug");
  await attempt(`/channels/${slug}/stats`, async () => {
    const stats = await fetchStats(slug);
    return `Updated stats for ${stats.length} video(s).`;
  });
}

export async function insightsAction(fd: FormData) {
  const slug = str(fd, "slug");
  await attempt(`/channels/${slug}/stats`, async () => {
    const channel = await requireChannel(slug);
    const [stats, videos] = await Promise.all([listStats(slug), listVideos(slug)]);
    if (!stats.length) throw new Error("No stats yet. Link or upload a video, then refresh stats.");
    const published = videos.filter((v) => stats.some((s) => s.videoId === v.id));
    return ranMsg(await runTask(slug, "insights", { channel, stats, videos: published }), "Stats analysis");
  });
}
