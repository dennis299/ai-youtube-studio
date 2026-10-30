import { describe, expect, it } from "vitest";
import { makeChannel } from "./helpers";
import { TASKS } from "@/lib/tasks";
import type { Storyboard, VideoPlan } from "@/lib/schemas";

const channel = makeChannel();
const video: VideoPlan = {
  id: "2026-11-w1-1", month: "2026-11", week: 1, publishDate: "2026-11-02", pillar: "The Fall",
  workingTitle: "How Nokia Lost Everything", angle: "a", whyItWorks: "b", status: "approved",
};
const storyboard: Storyboard = {
  videoId: video.id, titleOptions: ["t"], chosenTitle: "t", hook: "h", beats: [],
  scenes: [{ n: 1, narration: "n", visual: "v", source: "stock", seconds: 10 }],
  outro: "o", thumbnailConcepts: [], shortSegment: { startScene: 1, endScene: 1, hookLine: "h" },
  sources: [], aiDisclosure: false,
};

const inputs = {
  research: { channel, queries: ["nokia downfall"], topVideos: [] },
  channel_kit: { channel, research: null },
  monthly_plan: { channel, research: null, kit: null, month: "2026-11", insights: null },
  storyboard: { channel, kit: null, video },
  produce: { channel, video, storyboard, openMontagePath: "C:/OpenMontage", outputDir: "C:/out" },
  insights: { channel, stats: [], videos: [] },
} as const;

describe("task prompts", () => {
  for (const [type, input] of Object.entries(inputs)) {
    it(`${type} brief names the niche and the output shape`, () => {
      const prompt = TASKS[type as keyof typeof TASKS].buildPrompt(input as never);
      expect(prompt).toContain(channel.niche);
      expect(prompt).toContain("Output JSON schema");
    });
  }

  it("produce brief pins the approval policy and storyboard binding", () => {
    const prompt = TASKS.produce.buildPrompt(inputs.produce as never);
    expect(prompt).toContain("pre-approved-by-weekly-checkin");
    expect(prompt).toContain("script-and-scene-order-are-final");
    expect(prompt).toContain("documentary-montage");
    expect(prompt).toContain("remotion");
  });

  it("monthly plan brief forbids repeating story structures", () => {
    expect(TASKS.monthly_plan.buildPrompt(inputs.monthly_plan as never)).toMatch(/do not repeat/i);
  });
});
