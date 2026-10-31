import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeChannel, useTempDirs } from "./helpers";
import { buildUploadKit, parseYouTubeId, renderDescription } from "@/lib/publish/kit";
import { saveChannel, saveKit, saveProduction, saveVideo, writeStoryboard } from "@/lib/store";
import { approve, storyboardHash } from "@/lib/checkin";
import type { ChannelKit, Storyboard, VideoPlan } from "@/lib/schemas";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(() => { dirs = useTempDirs(); });
afterEach(() => dirs.cleanup());

const kit: ChannelKit = {
  nameOptions: [{ name: "Built & Broken", why: "w" }], chosenName: "Built & Broken", handle: "@BuiltAndBrokenTV",
  description: "d", keywords: ["business"], pillars: [], logoBrief: "l", bannerBrief: "b",
  uploadDefaults: { categoryId: "27", tags: ["business", "company history"], footer: "Sources:\n{sources}\n\n#business #{topic_tag}" },
};
const video: VideoPlan = {
  id: "2026-11-w1-1", month: "2026-11", week: 1, publishDate: "2026-11-02", pillar: "The Fall",
  workingTitle: "Nokia", angle: "a", whyItWorks: "w", status: "rendered",
};
const sb: Storyboard = {
  videoId: video.id, titleOptions: ["How Nokia Lost Everything"], chosenTitle: "How Nokia Lost Everything",
  hook: "In 2007 Nokia sold half the phones on Earth.", beats: [],
  scenes: [{ n: 1, narration: "n", visual: "v", source: "stock", seconds: 10 }],
  outro: "o", thumbnailConcepts: [], shortSegment: { startScene: 1, endScene: 1, hookLine: "h" },
  sources: ["https://a.example/1", "https://b.example/2"], aiDisclosure: true,
};

describe("description", () => {
  it("fills sources and topic tag and leaves no placeholders", () => {
    const d = renderDescription(kit, sb, video);
    expect(d).toContain("https://a.example/1\nhttps://b.example/2");
    expect(d).toContain("#thefall");
    expect(d).not.toMatch(/\{[a-z_]+\}/);
    expect(d.startsWith(sb.hook)).toBe(true);
  });
});

describe("upload kit", () => {
  it("writes upload.txt with title, disclosure and the files", async () => {
    await saveChannel(makeChannel());
    await saveKit("built-and-broken", kit);
    await saveVideo("built-and-broken", video);
    const approved = approve(sb, { original: true, visualsClean: true, disclosureSet: true, factsChecked: true });
    await writeStoryboard("built-and-broken", approved);
    const src = path.join(dirs.root, "render");
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, "final.mp4"), "video");
    await writeFile(path.join(src, "thumb.png"), "png");
    await saveProduction("built-and-broken", {
      videoId: video.id, jobId: "j", status: "rendered",
      videoPath: path.join(src, "final.mp4"), thumbnailPath: path.join(src, "thumb.png"),
      storyboardHash: storyboardHash(approved),
    });

    const dir = await buildUploadKit("built-and-broken", video.id);
    const txt = await readFile(path.join(dir, "upload.txt"), "utf8");
    expect(txt).toContain("How Nokia Lost Everything");
    expect(txt).toContain("Altered or synthetic content: Yes");
    expect(txt).toContain("Category: 27");
    expect(await readFile(path.join(dir, "video.mp4"), "utf8")).toBe("video");
  });

  it("puts the render's image credits in the description and copies the captions", async () => {
    await saveChannel(makeChannel());
    await saveKit("built-and-broken", kit);
    await saveVideo("built-and-broken", video);
    const approved = approve(sb, { original: true, visualsClean: true, disclosureSet: true, factsChecked: true });
    await writeStoryboard("built-and-broken", approved);
    const src = path.join(dirs.root, "render");
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, "video.mp4"), "video");
    await writeFile(path.join(src, "captions.srt"), "1\n00:00:00,000 --> 00:00:01,000\nHi\n");
    await writeFile(path.join(src, "credits.txt"), "Image credits:\n- Jane Doe, CC BY-SA 4.0, via wikimedia\n");
    await saveProduction("built-and-broken", {
      videoId: video.id, jobId: "j", status: "rendered", videoPath: path.join(src, "video.mp4"),
      captionsPath: path.join(src, "captions.srt"), storyboardHash: storyboardHash(approved),
    });

    const dir = await buildUploadKit("built-and-broken", video.id);
    const txt = await readFile(path.join(dir, "upload.txt"), "utf8");
    const description = txt.split("=== DESCRIPTION ===")[1].split("=== TAGS ===")[0];
    expect(description).toContain("- Jane Doe, CC BY-SA 4.0, via wikimedia");
    expect(await readFile(path.join(dir, "captions.srt"), "utf8")).toContain("Hi");
  });

  it("copies every delivered Short and lists each one's title and posting day", async () => {
    await saveChannel(makeChannel());
    await saveKit("built-and-broken", kit);
    await saveVideo("built-and-broken", video);
    const approved = approve(sb, { original: true, visualsClean: true, disclosureSet: true, factsChecked: true });
    await writeStoryboard("built-and-broken", approved);
    const src = path.join(dirs.root, "render");
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, "video.mp4"), "video");
    await writeFile(path.join(src, "short.mp4"), "s1");
    await writeFile(path.join(src, "short-2.mp4"), "s2");
    await writeFile(path.join(src, "shorts.json"), JSON.stringify([
      { file: "short.mp4", title: "Nokia had a touchscreen phone in 2004 #shorts", description: "Full story on the channel", postDate: "2026-11-02" },
      { file: "short-2.mp4", title: "Why Nokia couldn't answer the iPhone #shorts", description: "Full story on the channel", postDate: "2026-11-04" },
    ]));
    await saveProduction("built-and-broken", {
      videoId: video.id, jobId: "j", status: "rendered", videoPath: path.join(src, "video.mp4"),
      shortPath: path.join(src, "short.mp4"), storyboardHash: storyboardHash(approved),
    });

    const dir = await buildUploadKit("built-and-broken", video.id);
    const txt = await readFile(path.join(dir, "upload.txt"), "utf8");
    expect(await readFile(path.join(dir, "short-2.mp4"), "utf8")).toBe("s2");
    expect(txt).toContain("=== SHORTS (2) ===");
    expect(txt).toContain("short-2.mp4 · post 2026-11-04");
    expect(txt).toContain("Title: Why Nokia couldn't answer the iPhone #shorts");
  });
});

describe("parseYouTubeId", () => {
  it("handles the common URL shapes", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://studio.youtube.com/video/dQw4w9WgXcQ/edit")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("not a url")).toBeNull();
  });
});
