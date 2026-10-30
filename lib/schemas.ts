import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const month = z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM");

export const ChannelSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  niche: z.string().min(1),
  style: z.string(),
  audience: z.string(),
  language: z.string().default("en"),
  cadence: z.object({
    perWeek: z.number().int().min(1).max(7),
    days: z.array(z.number().int().min(0).max(6)),
  }),
  videoMinutes: z.tuple([z.number(), z.number()]),
  budgetPerVideoUsd: z.number().nonnegative(),
  pipeline: z.string(),
  publishMode: z.enum(["studio-kit", "api"]),
  stage: z.enum(["research", "kit", "plan", "storyboards", "producing"]),
  createdAt: z.string(),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const TopVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  channel: z.string(),
  views: z.number(),
  subs: z.number(),
  ratio: z.number(),
  durationSec: z.number(),
  publishedAt: z.string(),
});
export type TopVideo = z.infer<typeof TopVideoSchema>;

export const PillarSchema = z.object({ name: z.string(), why: z.string() });

export const ResearchSchema = z.object({
  queries: z.array(z.string()),
  topVideos: z.array(TopVideoSchema),
  patterns: z.array(z.string()),
  pillars: z.array(PillarSchema),
  summary: z.string(),
});
export type Research = z.infer<typeof ResearchSchema>;

export const ChannelKitSchema = z.object({
  nameOptions: z.array(z.object({ name: z.string(), why: z.string() })),
  chosenName: z.string().optional(),
  handle: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  pillars: z.array(PillarSchema),
  logoBrief: z.string(),
  bannerBrief: z.string(),
  uploadDefaults: z.object({
    categoryId: z.string(),
    tags: z.array(z.string()),
    footer: z.string(),
  }),
});
export type ChannelKit = z.infer<typeof ChannelKitSchema>;

export const VideoStatus = z.enum([
  "planned", "storyboarded", "approved", "producing", "rendered", "published", "failed",
]);

export const VideoPlanSchema = z.object({
  id: z.string(),
  month,
  week: z.number().int().min(1).max(4),
  publishDate: isoDate,
  pillar: z.string(),
  workingTitle: z.string(),
  angle: z.string(),
  whyItWorks: z.string(),
  status: VideoStatus,
});
export type VideoPlan = z.infer<typeof VideoPlanSchema>;

export const ChecklistSchema = z.object({
  original: z.boolean(),
  visualsClean: z.boolean(),
  disclosureSet: z.boolean(),
  factsChecked: z.boolean(),
});
export type Checklist = z.infer<typeof ChecklistSchema>;

export const SceneSchema = z.object({
  n: z.number().int(),
  narration: z.string(),
  visual: z.string(),
  source: z.enum(["stock", "archive", "ai-image", "ai-video", "motion-graphics", "user-image"]),
  seconds: z.number().positive(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const StoryboardSchema = z.object({
  videoId: z.string(),
  titleOptions: z.array(z.string()).min(1),
  chosenTitle: z.string(),
  hook: z.string(),
  beats: z.array(z.object({ heading: z.string(), narration: z.string() })),
  scenes: z.array(SceneSchema).min(1),
  outro: z.string(),
  thumbnailConcepts: z.array(z.string()),
  shortSegment: z.object({
    startScene: z.number().int(),
    endScene: z.number().int(),
    hookLine: z.string(),
  }),
  sources: z.array(z.string()),
  aiDisclosure: z.boolean(),
  approval: z
    .object({ hash: z.string(), at: z.string(), checklist: ChecklistSchema })
    .optional(),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const ProductionSchema = z.object({
  videoId: z.string(),
  jobId: z.string(),
  status: z.enum(["queued", "rendering", "rendered", "failed"]),
  videoPath: z.string().optional(),
  shortPath: z.string().optional(),
  thumbnailPath: z.string().optional(),
  captionsPath: z.string().optional(),
  storyboardHash: z.string().optional(),
  costUsd: z.number().optional(),
  error: z.string().optional(),
});
export type Production = z.infer<typeof ProductionSchema>;

export const PublishSchema = z.object({
  videoId: z.string(),
  mode: z.enum(["studio-kit", "api"]),
  youtubeId: z.string().optional(),
  url: z.string().optional(),
  publishAt: z.string(),
  kitPath: z.string().optional(),
});
export type Publish = z.infer<typeof PublishSchema>;

export const StatsSchema = z.object({
  videoId: z.string(),
  youtubeId: z.string(),
  fetchedAt: z.string(),
  views: z.number(),
  likes: z.number(),
  comments: z.number(),
  avgViewDurationSec: z.number().optional(),
});
export type Stats = z.infer<typeof StatsSchema>;

/** Channel-wide numbers for the Stats page and the YouTube Partner Program tracker. */
export const ChannelOverviewSchema = z.object({
  fetchedAt: z.string(),
  subscribers: z.number(),
  totalViews: z.number(),
  videoCount: z.number(),
  longFormHours12m: z.number().describe("Long-form + live watch hours, last 365 days (Shorts excluded, as YPP counts them)"),
  shortsViews90d: z.number().describe("Shorts views, last 90 days"),
});
export type ChannelOverview = z.infer<typeof ChannelOverviewSchema>;

export const InsightsSchema = z.object({
  winners: z.array(z.string()),
  losers: z.array(z.string()),
  guidance: z.string(),
});
export type Insights = z.infer<typeof InsightsSchema>;

export const SettingsSchema = z.object({
  aiMode: z.enum(["agent", "openai", "anthropic"]).default("agent"),
  openaiKey: z.string().optional(),
  anthropicKey: z.string().optional(),
  openaiModel: z.string().default("gpt-5.5"),
  anthropicModel: z.string().default("claude-sonnet-5-5"),
  google: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      tokens: z.record(z.string(), z.unknown()).optional(),
      channelId: z.string().optional(),
      channelTitle: z.string().optional(),
      audited: z.boolean().default(false),
    })
    .default({ audited: false }),
  openMontagePath: z.string().optional(),
  ffmpegPath: z.string().default("ffmpeg"),
  agentCommand: z
    .string()
    .default('claude -p "Process all pending jobs in jobs/pending following AGENTS.md"'),
  quota: z
    .object({ date: z.string(), used: z.number() })
    .default({ date: "", used: 0 }),
});
export type Settings = z.infer<typeof SettingsSchema>;
