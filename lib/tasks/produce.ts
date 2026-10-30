import { z } from "zod";
import { getProduction, getVideo, saveProduction, saveVideo } from "../store";
import type { Channel, Storyboard, VideoPlan } from "../schemas";
import { channelSection, json, outputSection, RULES, type TaskDef } from "./types";

export type ProduceInput = {
  channel: Channel;
  video: VideoPlan;
  storyboard: Storyboard;
  openMontagePath: string;
  outputDir: string;
};

const Output = z.object({
  videoPath: z.string().describe("Absolute path to the final 16:9 MP4"),
  thumbnailPath: z.string().describe("Absolute path to the 1280x720 thumbnail (PNG or JPG)"),
  captionsPath: z.string().optional().describe("Absolute path to an SRT of the narration, if produced"),
  costUsd: z.number().describe("Total provider spend for this video"),
});

export const PRODUCTION_FIELDS = (channel: Channel) => ({
  approval_policy: "pre-approved-by-weekly-checkin",
  pipeline: channel.pipeline,
  composer: "remotion",
  storyboard_binding: "script-and-scene-order-are-final",
  budget_usd_max: channel.budgetPerVideoUsd,
  aspect_ratio: "16:9",
  resolution: "1920x1080",
});

export const produce: TaskDef<ProduceInput, z.infer<typeof Output>> = {
  type: "produce",
  title: ({ storyboard }) => `Produce: ${storyboard.chosenTitle}`,
  outputSchema: Output,
  buildPrompt: ({ channel, storyboard: sb, openMontagePath, outputDir }) => `# Task: produce this video with OpenMontage

The human approved this storyboard at the weekly check-in. Produce it without stopping for more approvals.

${channelSection(channel)}

## Production settings (fixed, do not ask)
${json(PRODUCTION_FIELDS(channel))}

- **approval_policy = pre-approved-by-weekly-checkin.** Record this as the approval decision at every OpenMontage checkpoint (idea, scene_plan, assets, edit) and continue.
- **storyboard_binding = script-and-scene-order-are-final.** Use the narration below word for word and keep the scene order. You may only choose how to source or generate each scene's visual, within its stated source type.
- Composer: Remotion. Do not ask the user to choose.
- Budget: stop and report failure rather than exceed $${channel.budgetPerVideoUsd}. Prefer free sources (stock/archive footage, free or local TTS) before paid providers.

## Steps
1. \`cd "${openMontagePath}"\` and follow that repo's AGENTS.md for the \`${channel.pipeline}\` pipeline.
2. Narrate the script, build the scenes, add captions and music (royalty-free only), and render the 1920×1080 MP4.
3. Make a 1280×720 thumbnail from the first thumbnail concept: bold, at most 3 words, high contrast.
4. Copy the final MP4, the thumbnail, and an SRT of the narration into \`${outputDir}\`.
5. Report the absolute paths and the total cost.

## Storyboard
${json({ title: sb.chosenTitle, hook: sb.hook, scenes: sb.scenes, outro: sb.outro, thumbnailConcept: sb.thumbnailConcepts[0], sources: sb.sources })}

${RULES}

${outputSection(Output)}
`,
  async apply(slug, { video }, out) {
    const prev = await getProduction(slug, video.id);
    await saveProduction(slug, {
      videoId: video.id,
      jobId: prev?.jobId ?? "",
      status: "rendered",
      videoPath: out.videoPath,
      thumbnailPath: out.thumbnailPath,
      captionsPath: out.captionsPath,
      shortPath: prev?.shortPath,
      storyboardHash: prev?.storyboardHash,
      costUsd: out.costUsd,
    });
    const v = await getVideo(slug, video.id);
    if (v) await saveVideo(slug, { ...v, status: "rendered" });
  },
  async onFail(slug, { video }, error) {
    const prev = await getProduction(slug, video.id);
    await saveProduction(slug, { videoId: video.id, jobId: prev?.jobId ?? "", status: "failed", error });
    const v = await getVideo(slug, video.id);
    if (v) await saveVideo(slug, { ...v, status: "failed" });
  },
};
