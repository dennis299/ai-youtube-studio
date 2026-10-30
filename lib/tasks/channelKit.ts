import { getChannel, getKit, saveChannel, saveKit } from "../store";
import { ChannelKitSchema, type Channel, type ChannelKit, type Research } from "../schemas";
import { channelSection, json, outputSection, RULES, type TaskDef } from "./types";

export type ChannelKitInput = { channel: Channel; research: Research | null };

const Output = ChannelKitSchema.omit({ chosenName: true });

export const channelKit: TaskDef<ChannelKitInput, Omit<ChannelKit, "chosenName">> = {
  type: "channel_kit",
  title: ({ channel }) => `Channel kit for ${channel.name}`,
  outputSchema: Output,
  buildPrompt: ({ channel, research }) => `# Task: channel kit

Brand this YouTube channel so a stranger knows in two seconds what they will get.

${channelSection(channel)}

${research ? `## Research\n${research.summary}\n\nPillars:\n${json(research.pillars)}` : "## Research\nNone yet. Infer from the niche."}

## What to produce
- 5 name options (short, memorable, says the promise, available-sounding) with a one-line why each.
- A handle suggestion (@Name style).
- A channel description (120–200 words). Its first line is the promise. It mentions the upload cadence (${channel.cadence.perWeek} per week) and includes an honest note that videos are made with AI tools and reviewed by a human.
- 8–12 keywords.
- 3–6 content pillars.
- A logo brief: a simple mark that reads at 48px inside a circle crop, plus colours.
- A banner brief (2560×1440, with text inside the 1546×423 safe area).
- Upload defaults: a YouTube categoryId (27 Education, 24 Entertainment, 22 People & Blogs, 28 Science & Tech), default tags, and a description footer. The footer must contain the placeholders {sources} and {topic_tag}.

${RULES}

${outputSection(Output)}
`,
  async apply(slug, _input, out) {
    const existing = await getKit(slug);
    await saveKit(slug, { ...out, chosenName: existing?.chosenName });
    const c = await getChannel(slug);
    if (c && (c.stage === "research" || c.stage === "kit")) await saveChannel({ ...c, stage: "plan" });
  },
};
