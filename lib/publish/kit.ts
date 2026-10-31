import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { assertRenderMatchesApproval } from "../checkin";
import { outputDir } from "../fsjson";
import { localOffset, publishAt } from "../schedule";
import { getKit, getProduction, getStoryboard, getVideo, savePublish } from "../store";
import { z } from "zod";
import type { ChannelKit, Storyboard, VideoPlan } from "../schemas";

const DEFAULT_FOOTER = "Sources:\n{sources}\n\n#{topic_tag}";

/** shorts.json, optionally left next to the video by the render job: several Shorts cut from one video. */
const ShortsManifest = z.array(z.object({
  file: z.string().regex(/^[\w.-]+\.mp4$/),
  title: z.string(),
  description: z.string(),
  postDate: z.string(),
}));
type ShortItem = z.infer<typeof ShortsManifest>[number];

async function readShorts(videoPath: string): Promise<ShortItem[]> {
  const file = path.join(path.dirname(videoPath), "shorts.json");
  if (!existsSync(file)) return [];
  const parsed = ShortsManifest.safeParse(JSON.parse(await readFile(file, "utf8")));
  return parsed.success ? parsed.data.filter((s) => existsSync(path.join(path.dirname(videoPath), s.file))) : [];
}

/**
 * The YouTube description: hook, then the channel footer with sources and topic tag filled in,
 * then the render's image credits (CC BY / BY-SA licenses require them) when there are any.
 */
export function renderDescription(kit: ChannelKit | null, sb: Storyboard, video: VideoPlan, credits?: string): string {
  const footer = kit?.uploadDefaults.footer ?? DEFAULT_FOOTER;
  const topicTag = video.pillar.toLowerCase().replace(/[^a-z0-9]/g, "");
  const filled = footer
    .replace(/\{sources\}/g, sb.sources.join("\n"))
    .replace(/\{topic_tag\}/g, topicTag)
    .replace(/\{[a-z_]+\}/g, "");
  return [sb.hook, filled, credits?.trim()].filter(Boolean).join("\n\n").trim();
}

/** The render job may leave a credits.txt next to the video for licensed images. */
export async function readCredits(videoPath: string): Promise<string | undefined> {
  const file = path.join(path.dirname(videoPath), "credits.txt");
  return existsSync(file) ? readFile(file, "utf8") : undefined;
}

export function uploadTags(kit: ChannelKit | null, video: VideoPlan): string[] {
  return [...new Set([...(kit?.uploadDefaults.tags ?? []), video.pillar.toLowerCase()])].slice(0, 15);
}

export function parseYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/video\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Folder with everything needed to upload by hand in YouTube Studio:
 * video, Short, thumbnail and upload.txt (copy-paste metadata and steps).
 */
export async function buildUploadKit(slug: string, id: string): Promise<string> {
  const [video, sb, prod, kit] = await Promise.all([getVideo(slug, id), getStoryboard(slug, id), getProduction(slug, id), getKit(slug)]);
  if (!video || !sb) throw new Error("Video or storyboard missing.");
  if (!prod?.videoPath || !existsSync(prod.videoPath)) throw new Error("The rendered video file is missing. Produce the video first.");
  await assertRenderMatchesApproval(slug, id);

  const dir = path.join(outputDir(), slug, id, "kit");
  await mkdir(dir, { recursive: true });
  await copyFile(prod.videoPath, path.join(dir, "video.mp4"));
  if (prod.thumbnailPath && existsSync(prod.thumbnailPath)) {
    await copyFile(prod.thumbnailPath, path.join(dir, `thumbnail${path.extname(prod.thumbnailPath) || ".png"}`));
  }
  if (prod.shortPath && existsSync(prod.shortPath)) await copyFile(prod.shortPath, path.join(dir, "short.mp4"));
  if (prod.captionsPath && existsSync(prod.captionsPath)) await copyFile(prod.captionsPath, path.join(dir, "captions.srt"));
  const shorts = await readShorts(prod.videoPath);
  for (const s of shorts) await copyFile(path.join(path.dirname(prod.videoPath), s.file), path.join(dir, s.file));
  const shortsSection = shorts.length
    ? `=== SHORTS (${shorts.length}) ===
Upload each file as its own Short on its day. In each one: Show more → Related video → the full video.
${shorts.map((s, i) => `${i + 1}. ${s.file} · post ${s.postDate}\n   Title: ${s.title}\n   Description: ${s.description}`).join("\n")}`
    : `=== SHORT ===
Upload short.mp4 as a Short the same day.
Title: ${sb.shortSegment.hookLine} #shorts
Description: Full story on the channel: ${sb.chosenTitle}`;
  const when = publishAt(video.publishDate, 15, localOffset());
  const description = renderDescription(kit, sb, video, await readCredits(prod.videoPath));
  const tags = uploadTags(kit, video);
  const txt = `UPLOAD KIT: ${sb.chosenTitle}
Scheduled for: ${video.publishDate} 15:00 (your local time)

=== TITLE ===
${sb.chosenTitle}

=== DESCRIPTION ===
${description}

=== TAGS ===
${tags.join(", ")}

=== SETTINGS ===
Category: ${kit?.uploadDefaults.categoryId ?? "27"}
Altered or synthetic content: ${sb.aiDisclosure ? "Yes" : "No"}
Made for kids: No
Visibility: Schedule → ${video.publishDate} 15:00

${shortsSection}

=== STEPS (YouTube Studio) ===
1. studio.youtube.com → Create → Upload videos → video.mp4
2. Paste the title and description, then upload the thumbnail file.
   If captions.srt is here: Subtitles → Add language → English → Upload file → With timing.
3. Audience: "No, it's not made for kids". Show more → paste tags, set category,
   and answer "Altered or synthetic content" as above.
4. Visibility → Schedule → the date above.
5. Copy the video link and paste it into AI YouTube Studio → this video → "Link published video",
   so stats tracking works.
`;
  await writeFile(path.join(dir, "upload.txt"), txt, "utf8");
  await savePublish(slug, { videoId: id, mode: "studio-kit", publishAt: when, kitPath: dir });
  return dir;
}
