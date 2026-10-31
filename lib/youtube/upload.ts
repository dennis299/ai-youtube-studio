import { createReadStream, existsSync } from "node:fs";
import { loadSettings } from "../settings";
import { localOffset, publishAt } from "../schedule";
import { assertRenderMatchesApproval } from "../checkin";
import { getKit, getProduction, getPublish, getStoryboard, getVideo, savePublish, saveVideo } from "../store";
import { readCredits, renderDescription, uploadTags } from "../publish/kit";
import { withYouTube } from "./client";
import { YouTubeError } from "./errors";
import { callCharged } from "./quota";

/**
 * Upload through the API (audited Google projects only): private + publishAt,
 * so YouTube releases it on schedule. Sets the synthetic-media flag and thumbnail.
 */
type Runner = typeof withYouTube;

export async function uploadVideo(
  slug: string,
  id: string,
  run: Runner = withYouTube,
): Promise<{ youtubeId: string; url: string; warning?: string }> {
  const settings = await loadSettings();
  if (!settings.google.audited) {
    throw new YouTubeError(
      "Your Google project is not marked as audited, so API uploads would be locked private. Use the Studio upload kit, or tick 'audited' in Settings once Google approves you.",
      "notAudited",
    );
  }
  const [video, sb, prod, kit, prev] = await Promise.all([
    getVideo(slug, id), getStoryboard(slug, id), getProduction(slug, id), getKit(slug), getPublish(slug, id),
  ]);
  if (!video || !sb) throw new Error("Video or storyboard missing.");
  if (prev?.youtubeId) throw new Error(`Already uploaded: https://youtu.be/${prev.youtubeId}`);
  if (!prod?.videoPath || !existsSync(prod.videoPath)) throw new Error("The rendered video file is missing.");
  await assertRenderMatchesApproval(slug, id);

  const when = publishAt(video.publishDate, 15, localOffset());
  const scheduled = Date.parse(when) > Date.now() + 15 * 60_000;
  const credits = await readCredits(prod.videoPath);

  // The insert runs alone so a later failure (e.g. thumbnail) can never trigger a second upload.
  const youtubeId = await run(async ({ yt }) => {
    const res = await callCharged("insert", 1, () =>
      yt.videos.insert({
        part: ["snippet", "status"],
        notifySubscribers: true,
        requestBody: {
          snippet: {
            title: sb.chosenTitle.slice(0, 100),
            description: renderDescription(kit, sb, video, credits).slice(0, 5000),
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
    return vid;
  });

  const url = `https://youtu.be/${youtubeId}`;
  await savePublish(slug, { videoId: id, mode: "api", youtubeId, url, publishAt: when });
  await saveVideo(slug, { ...video, status: "published" });

  let warning: string | undefined;
  if (prod.thumbnailPath && existsSync(prod.thumbnailPath)) {
    try {
      await run(({ yt }) =>
        callCharged("thumbnailSet", 1, () =>
          yt.thumbnails.set({ videoId: youtubeId, media: { body: createReadStream(prod.thumbnailPath!) } }),
        ),
      );
    } catch (err) {
      warning = `Video uploaded, but the thumbnail failed (${(err as Error).message}). Custom thumbnails need a phone-verified channel; set it in YouTube Studio.`;
    }
  }
  return { youtubeId, url, warning };
}
