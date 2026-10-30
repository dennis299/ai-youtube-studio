import { z } from "zod";
import { deleteVideo, getChannel, listVideos, saveChannel, saveVideo } from "../store";
import { monthSlots } from "../schedule";
import type { Channel, ChannelKit, Insights, Research } from "../schemas";
import { channelSection, json, outputSection, RULES, type TaskDef } from "./types";

export type MonthlyPlanInput = {
  channel: Channel;
  research: Research | null;
  kit: ChannelKit | null;
  month: string;
  insights: Insights | null;
};

const Idea = z.object({
  pillar: z.string(),
  workingTitle: z.string().describe("Clickable working title, under 70 characters"),
  angle: z.string().describe("The specific story angle: the twist, question, or tension that carries the video"),
  whyItWorks: z.string().describe("Why this should perform, tied to the research"),
});

const Output = z.object({ videos: z.array(Idea) });

export const monthlyPlan: TaskDef<MonthlyPlanInput, z.infer<typeof Output>> = {
  type: "monthly_plan",
  title: ({ channel, month }) => `Plan ${month} for ${channel.name}`,
  outputSchema: Output,
  buildPrompt: ({ channel, research, kit, month, insights }) => {
    const count = channel.cadence.perWeek * 4;
    return `# Task: monthly content plan for ${month}

Plan exactly ${count} long-form videos (${channel.cadence.perWeek} per week for 4 weeks), in the order they should be published.

${channelSection(channel)}

${research ? `## Research\n${research.summary}\n\nWinning patterns:\n${research.patterns.map((p) => `- ${p}`).join("\n")}` : ""}

## Pillars
${json((kit?.pillars ?? research?.pillars) ?? [])}

${insights ? `## What the stats taught us last month\nWinners: ${insights.winners.join("; ")}\nLosers: ${insights.losers.join("; ")}\nGuidance: ${insights.guidance}` : ""}

## Rules for the plan
- Spread pillars evenly. Each week should mix pillars.
- Do not repeat story structures or title formulas back to back. Every video needs its own angle.
- Topics must be well documented, so facts can be checked and sources cited.
- Order matters: put the strongest, most searchable topics in week 1.
- Return exactly ${count} items in the "videos" array.

${RULES}

${outputSection(Output)}
`;
  },
  async apply(slug, { channel, month }, { videos }) {
    const slots = monthSlots(month, channel.cadence.days, channel.cadence.perWeek);
    if (videos.length < slots.length) {
      throw new Error(`Expected ${slots.length} videos, got ${videos.length}`);
    }
    // Replace this month's untouched ideas; keep anything storyboarded, further along,
    // or with an agent job still in flight (its result would land on the wrong topic).
    const { pendingJobs } = await import("../pending");
    const busy = new Set((await pendingJobs(slug)).map((j) => (j.input as { video?: { id: string } }).video?.id).filter(Boolean));
    for (const v of await listVideos(slug)) {
      if (v.month === month && v.status === "planned" && !busy.has(v.id)) await deleteVideo(slug, v.id);
    }
    const existing = await listVideos(slug);
    const kept = new Set(existing.filter((v) => v.month === month).map((v) => v.publishDate));
    const takenIds = new Set(existing.map((v) => v.id));
    let n = 0;
    for (const [i, slot] of slots.entries()) {
      if (kept.has(slot.date)) continue;
      const idea = videos[i];
      const idx = slots.slice(0, i + 1).filter((s) => s.week === slot.week).length;
      let id = `${month}-w${slot.week}-${idx}`;
      for (let k = 2; takenIds.has(id); k++) id = `${month}-w${slot.week}-${idx}-${k}`;
      takenIds.add(id);
      await saveVideo(slug, {
        id,
        month,
        week: slot.week,
        publishDate: slot.date,
        ...idea,
        status: "planned",
      });
      n++;
    }
    const c = await getChannel(slug);
    if (c && n > 0 && ["research", "kit", "plan"].includes(c.stage)) await saveChannel({ ...c, stage: "storyboards" });
  },
};
