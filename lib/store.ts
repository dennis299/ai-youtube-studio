import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import { dataDir, readJson, writeJson } from "./fsjson";
import {
  ChannelKitSchema, ChannelOverviewSchema, ChannelSchema, InsightsSchema, ProductionSchema, PublishSchema,
  ResearchSchema, StatsSchema, StoryboardSchema, VideoPlanSchema,
  type Channel, type ChannelKit, type ChannelOverview, type Insights, type Production, type Publish,
  type Research, type Stats, type Storyboard, type VideoPlan,
} from "./schemas";

const channelsDir = () => path.join(dataDir(), "channels");
const channelDir = (slug: string) => path.join(channelsDir(), slug);
const videoDir = (slug: string, id: string) => path.join(channelDir(slug), "videos", id);

async function read<T>(file: string, schema: ZodType<T>): Promise<T | null> {
  const raw = await readJson(file);
  return raw === null ? null : schema.parse(raw);
}

async function write<T>(file: string, schema: ZodType<T>, value: T): Promise<T> {
  const parsed = schema.parse(value);
  await writeJson(file, parsed);
  return parsed;
}

async function subdirs(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

// Channels
export const getChannel = (slug: string) => read(path.join(channelDir(slug), "channel.json"), ChannelSchema);
export const saveChannel = (c: Channel) => write(path.join(channelDir(c.slug), "channel.json"), ChannelSchema, c);

export async function listChannels(): Promise<Channel[]> {
  const all = await Promise.all((await subdirs(channelsDir())).map(getChannel));
  return all.filter((c): c is Channel => c !== null).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Channel-level documents
export const getResearch = (slug: string) => read(path.join(channelDir(slug), "research.json"), ResearchSchema);
export const saveResearch = (slug: string, r: Research) => write(path.join(channelDir(slug), "research.json"), ResearchSchema, r);
export const getKit = (slug: string) => read(path.join(channelDir(slug), "kit.json"), ChannelKitSchema);
export const saveKit = (slug: string, k: ChannelKit) => write(path.join(channelDir(slug), "kit.json"), ChannelKitSchema, k);
export const getInsights = (slug: string) => read(path.join(channelDir(slug), "insights.json"), InsightsSchema);
export const saveInsights = (slug: string, i: Insights) => write(path.join(channelDir(slug), "insights.json"), InsightsSchema, i);
export const getOverview = (slug: string) => read(path.join(channelDir(slug), "overview.json"), ChannelOverviewSchema);
export const saveOverview = (slug: string, o: ChannelOverview) => write(path.join(channelDir(slug), "overview.json"), ChannelOverviewSchema, o);

// Videos
export const getVideo = (slug: string, id: string) => read(path.join(videoDir(slug, id), "video.json"), VideoPlanSchema);
export const saveVideo = (slug: string, v: VideoPlan) => write(path.join(videoDir(slug, v.id), "video.json"), VideoPlanSchema, v);

export async function listVideos(slug: string): Promise<VideoPlan[]> {
  const ids = await subdirs(path.join(channelDir(slug), "videos"));
  const all = await Promise.all(ids.map((id) => getVideo(slug, id)));
  return all
    .filter((v): v is VideoPlan => v !== null)
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate) || a.id.localeCompare(b.id));
}

export async function deleteVideo(slug: string, id: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  await rm(videoDir(slug, id), { recursive: true, force: true });
}

export const getStoryboard = (slug: string, id: string) => read(path.join(videoDir(slug, id), "storyboard.json"), StoryboardSchema);
/** Raw write; use `saveStoryboard` from lib/checkin.ts, which also enforces approval rules. */
export const writeStoryboard = (slug: string, sb: Storyboard) => write(path.join(videoDir(slug, sb.videoId), "storyboard.json"), StoryboardSchema, sb);
export const getProduction = (slug: string, id: string) => read(path.join(videoDir(slug, id), "production.json"), ProductionSchema);
export const saveProduction = (slug: string, p: Production) => write(path.join(videoDir(slug, p.videoId), "production.json"), ProductionSchema, p);
export const getPublish = (slug: string, id: string) => read(path.join(videoDir(slug, id), "publish.json"), PublishSchema);
export const savePublish = (slug: string, p: Publish) => write(path.join(videoDir(slug, p.videoId), "publish.json"), PublishSchema, p);
export const getStats = (slug: string, id: string) => read(path.join(videoDir(slug, id), "stats.json"), StatsSchema);
export const saveStats = (slug: string, s: Stats) => write(path.join(videoDir(slug, s.videoId), "stats.json"), StatsSchema, s);

export async function listStats(slug: string): Promise<Stats[]> {
  const ids = await subdirs(path.join(channelDir(slug), "videos"));
  const all = await Promise.all(ids.map((id) => getStats(slug, id)));
  return all.filter((s): s is Stats => s !== null);
}
