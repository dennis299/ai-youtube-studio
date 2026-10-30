import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeChannel, useTempDirs } from "./helpers";
import { approve, isApproved, saveStoryboard, storyboardHash } from "@/lib/checkin";
import { getStoryboard, getVideo, saveChannel, saveVideo } from "@/lib/store";
import type { Checklist, Storyboard, VideoPlan } from "@/lib/schemas";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(async () => { dirs = useTempDirs(); await saveChannel(makeChannel()); });
afterEach(() => dirs.cleanup());

const allTicked: Checklist = { original: true, visualsClean: true, disclosureSet: true, factsChecked: true };

const sb: Storyboard = {
  videoId: "2026-11-w1-1", titleOptions: ["How Nokia Lost Everything"], chosenTitle: "How Nokia Lost Everything",
  hook: "In 2007 Nokia sold half the phones on Earth.", beats: [{ heading: "Setup", narration: "…" }],
  scenes: [
    { n: 1, narration: "In 2007 Nokia sold half the phones on Earth.", visual: "Archive Nokia ad", source: "archive", seconds: 8 },
    { n: 2, narration: "Six years later it was gone.", visual: "Stock: empty office", source: "stock", seconds: 6 },
  ],
  outro: "o", thumbnailConcepts: ["Nokia 3310 cracked"], shortSegment: { startScene: 1, endScene: 2, hookLine: "Half the world's phones" },
  sources: ["https://example.com"], aiDisclosure: false,
};

const video: VideoPlan = {
  id: sb.videoId, month: "2026-11", week: 1, publishDate: "2026-11-02", pillar: "The Fall",
  workingTitle: "Nokia", angle: "a", whyItWorks: "w", status: "storyboarded",
};

describe("check-in approval", () => {
  it("refuses approval when a checklist item is unticked", () => {
    expect(() => approve(sb, { ...allTicked, factsChecked: false })).toThrow(/facts/i);
  });

  it("approves when every item is ticked", () => {
    expect(isApproved(approve(sb, allTicked))).toBe(true);
  });

  it("an edit after approval invalidates it", () => {
    const approved = approve(sb, allTicked);
    const edited = { ...approved, scenes: [{ ...approved.scenes[0], narration: "Changed." }, approved.scenes[1]] };
    expect(isApproved(edited)).toBe(false);
  });

  it("the hash ignores the approval block itself", () => {
    expect(storyboardHash(approve(sb, allTicked))).toBe(storyboardHash(sb));
  });

  it("saving an edited approved storyboard drops the approval and resets the video", async () => {
    await saveVideo("built-and-broken", { ...video, status: "approved" });
    const approved = approve(sb, allTicked);
    await saveStoryboard("built-and-broken", approved);
    expect((await getVideo("built-and-broken", video.id))?.status).toBe("approved");

    await saveStoryboard("built-and-broken", { ...approved, hook: "A new hook." });
    expect((await getStoryboard("built-and-broken", video.id))?.approval).toBeUndefined();
    expect((await getVideo("built-and-broken", video.id))?.status).toBe("storyboarded");
  });
});
