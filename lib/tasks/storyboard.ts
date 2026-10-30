import { getVideo, saveVideo, writeStoryboard } from "../store";
import { StoryboardSchema, type Channel, type ChannelKit, type Storyboard, type VideoPlan } from "../schemas";
import { channelSection, outputSection, RULES, type TaskDef } from "./types";

export type StoryboardInput = { channel: Channel; kit: ChannelKit | null; video: VideoPlan };

const Output = StoryboardSchema.omit({ videoId: true, approval: true });
type Out = Omit<Storyboard, "videoId" | "approval">;

export const storyboard: TaskDef<StoryboardInput, Out> = {
  type: "storyboard",
  title: ({ video }) => `Storyboard: ${video.workingTitle}`,
  outputSchema: Output,
  buildPrompt: ({ channel, video }) => {
    const [min, max] = channel.videoMinutes;
    return `# Task: script and storyboard one video

${channelSection(channel)}

## The video
- Working title: ${video.workingTitle}
- Pillar: ${video.pillar}
- Angle: ${video.angle}
- Why it should work: ${video.whyItWorks}
- Publish date: ${video.publishDate}

## What to produce
- 3 title options (under 70 characters, curiosity without clickbait lies). chosenTitle is your pick.
- A hook: the first 15 seconds, spoken. It must open a question the video pays off.
- Beats: the story arc as headed sections (setup, rise, turning point, fall/climax, lesson).
- Scenes: the full narration split into scenes of 5–20 seconds each. Durations must add up to ${min}–${max} minutes (${min * 60}–${max * 60} seconds). Narration runs at about 150 words per minute, so size each scene's narration to its seconds.
  Each scene has a concrete visual description and a source, one of: "stock" (Pexels/Pixabay footage), "archive" (public-domain/Wikimedia/Internet Archive), "ai-image", "ai-video", or "motion-graphics" (maps, charts, timelines, kinetic text). Prefer stock, archive, and motion graphics. Never use film, TV, or anime frames.
- Outro: a 15–25 second payoff plus a call to action that names a related upcoming video.
- 3 thumbnail concepts: one image idea and at most 3 words of text each.
- shortSegment: the scene range (startScene..endScene, 30–60 seconds total) that works as a standalone vertical Short, with a hookLine overlay.
- sources: the URLs or publications the facts come from.
- aiDisclosure: true if any scene shows realistic AI-generated people, places, or events (YouTube's altered/synthetic content label).

${RULES}

${outputSection(Output)}
`;
  },
  async apply(slug, { video }, out) {
    const v = await getVideo(slug, video.id);
    if (!v) throw new Error(`Video ${video.id} no longer exists.`);
    if (v.workingTitle !== video.workingTitle) {
      throw new Error(`The topic changed since this storyboard was requested ("${video.workingTitle}" → "${v.workingTitle}"). Write the storyboard again.`);
    }
    await writeStoryboard(slug, { ...out, videoId: video.id });
    if (["planned", "storyboarded", "approved"].includes(v.status)) await saveVideo(slug, { ...v, status: "storyboarded" });
  },
};
