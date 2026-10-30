import { createReadStream, existsSync } from "node:fs";
import { loadSettings } from "../settings";
import { localOffset, publishAt } from "../schedule";
import { getKit, getProduction, getStoryboard, getVideo, savePublish, saveVideo } from "../store";
import { renderDescription, uploadTags } from "../publish/kit";
import { withYouTube } from "./client";
import { YouTubeError } from "./errors";
import { callCharged } from "./quota";

/**
 * Upload through the API (audited Google projects only): private + publishAt,
 * so YouTube releases it on schedule. Sets the synthetic-media flag and thumbnail.
 */
export async function uploadVideo(slug: string, id: string): Promise<{ youtubeId: string; url: string }> {
  const settings = await loadSettings();
  if (!settings.google.audited) {
    throw new YouTubeError(
      "Your Google project is not marked as audited, so API uploads would be locked private. Use the Studio upload kit, or tick 'audited' in Settings once Google approves you.",
      "notAudited",
    );
  }
  const [video, sb, prod, kit] = await Promise.all([getVideo(slug, id), getStoryboard(slug, id), getProduction(slug, id), getKit(slug)]);
  if (!video || !sb) throw new Error("Video or storyboard missing.");
  if (!prod?.videoPath || !existsSync(prod.videoPath)) throw new Error("The rendered video file is missing.");

  const when = publishAt(video.publishDate, 15, localOffset());
  const scheduled = Date.parse(when) > Date.now() + 15 * 60_000;

  const youtubeId = await withYouTube(async ({ yt }) => {
    const res = await callCharged("insert", 1, () =>
      yt.videos.insert({
        part: ["snippet", "status"],
        notifySubscribers: true,
        requestBody: {
          snippet: {
            title: sb.chosenTitle.slice(0, 100),
            description: renderDescription(kit, sb, video).slice(0, 5000),
            tags: uploadTags(kit, video),
            categoryId: kit?.uploadDefaults.categoryId ?? "27",
            defaultLanguage: "en",
          },
          status: {
            privacyStatus: scheduled ? "private" : "public",
            publishAt: scheduled ? when : undefined,
            selfDeclaredMadeForKids: false,
            containsSyntheticMedia: sb.aiDisclosure,
          },
        },
        media: { body: createReadStream(prod.videoPath!) },
      }),
    );
    const vid = res.data.id;
    if (!vid) throw new Error("YouTube did not return a video id.");
    if (prod.thumbnailPath && existsSync(prod.thumbnailPath)) {
      await callCharged("thumbnailSet", 1, () =>
        yt.thumbnails.set({ videoId: vid, media: { body: createReadStream(prod.thumbnailPath!) } }),
      );
    }
    return vid;
  });

  const url = `https://youtu.be/${youtubeId}`;
  await savePublish(slug, { videoId: id, mode: "api", youtubeId, url, publishAt: when });
  await saveVideo(slug, { ...video, status: "published" });
  return { youtubeId, url };
}
