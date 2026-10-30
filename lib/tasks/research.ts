import { z } from "zod";
import { getChannel, saveChannel, saveResearch } from "../store";
import { PillarSchema, type Channel, type TopVideo } from "../schemas";
import { channelSection, json, outputSection, RULES, type TaskDef } from "./types";

export type ResearchInput = { channel: Channel; queries: string[]; topVideos: TopVideo[] };

const Output = z.object({
  patterns: z.array(z.string()).min(3).describe("What the top performers have in common: hooks, title formulas, length, topics, pacing"),
  pillars: z.array(PillarSchema).min(3).max(6).describe("Content pillars this channel should stick to"),
  summary: z.string().describe("A short research report in plain English for the creator"),
});

export const research: TaskDef<ResearchInput, z.infer<typeof Output>> = {
  type: "research",
  title: ({ channel }) => `Research the "${channel.niche}" niche`,
  outputSchema: Output,
  buildPrompt: ({ channel, queries, topVideos }) => `# Task: niche research

Study what is already working on YouTube in this niche and turn it into a plan the channel can stick to.

${channelSection(channel)}

## Data
Search queries used: ${queries.join(", ")}

${topVideos.length > 0
  ? `Top-performing videos from the YouTube Data API (views, subscriber count, views÷subs ratio; a high ratio means the video beat the channel's normal reach):\n\n${json(topVideos)}`
  : `No YouTube API data is attached (the channel is not connected yet). Use web research on this niche instead and say so in the summary.`}

## What to produce
1. 5–10 patterns the winners share (title formulas, hooks, topics, length, thumbnail style, pacing).
2. 3–6 content pillars for this channel. Each must be repeatable for months and have proven demand.
3. A plain-English summary (150–250 words): what works, what is saturated, where the gap is.

${RULES}

${outputSection(Output)}
`,
  async apply(slug, { queries, topVideos }, out) {
    await saveResearch(slug, { queries, topVideos, ...out });
    const c = await getChannel(slug);
    if (c && c.stage === "research") await saveChannel({ ...c, stage: "kit" });
  },
};
