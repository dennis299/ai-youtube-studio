import { saveInsights } from "../store";
import { InsightsSchema, type Channel, type Insights, type Stats, type VideoPlan } from "../schemas";
import { channelSection, json, outputSection, RULES, type TaskDef } from "./types";

export type InsightsInput = { channel: Channel; stats: Stats[]; videos: VideoPlan[] };

export const insights: TaskDef<InsightsInput, Insights> = {
  type: "insights",
  title: ({ channel }) => `Learn from ${channel.name}'s stats`,
  outputSchema: InsightsSchema,
  buildPrompt: ({ channel, stats, videos }) => `# Task: learn from published videos

Compare how the published videos did and turn it into guidance for next month's plan.

${channelSection(channel)}

## Videos
${json(videos.map((v) => ({ id: v.id, title: v.workingTitle, pillar: v.pillar, angle: v.angle })))}

## Stats (views, likes, comments, average view duration in seconds)
${json(stats)}

## What to produce
- winners: 3–5 short notes on what the best performers had in common (topic, pillar, title style, angle).
- losers: 3–5 short notes on what underperformed and why you think so.
- guidance: one paragraph of concrete instructions for the next monthly plan.
With fewer than 5 published videos, say the signal is weak and keep the guidance light.

${RULES}

${outputSection(InsightsSchema)}
`,
  async apply(slug, _input, out) {
    await saveInsights(slug, out);
  },
};
