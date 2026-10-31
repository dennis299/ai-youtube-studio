import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { assertRenderMatchesApproval } from "../checkin";
import { outputDir } from "../fsjson";
import { loadSettings } from "../settings";
import { getProduction, getStoryboard, saveProduction } from "../store";
import type { Scene } from "../schemas";

/** Start/end time (seconds) of a scene range, from the storyboard's scene durations. */
export function segmentSeconds(scenes: Scene[], startScene: number, endScene: number): { startSec: number; endSec: number } {
  let t = 0;
  let startSec = 0;
  let endSec = 0;
  for (const s of [...scenes].sort((a, b) => a.n - b.n)) {
    if (s.n === startScene) startSec = t;
    t += s.seconds;
    if (s.n === endScene) endSec = t;
  }
  return { startSec, endSec: Math.max(endSec, startSec + 1) };
}

/** ffmpeg's filter syntax needs forward slashes and escaped colons in file paths. */
const filterPath = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

/**
 * ffmpeg args for a 1080x1920 Short: the 16:9 video fitted on top of a blurred,
 * zoomed copy of itself, optionally with burned-in captions.
 */
export function shortArgs(o: { input: string; output: string; startSec: number; endSec: number; captionsSrt?: string }): string[] {
  const subs = o.captionsSrt
    ? `,subtitles='${filterPath(o.captionsSrt)}':force_style='Fontsize=18,Outline=2,MarginV=180,Alignment=2'`
    : "";
  const graph =
    "[0:v]split=2[a][b];" +
    "[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bg];" +
    "[b]scale=1080:-2[fg];" +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2${subs}[v]`;
  return [
    "-y", "-i", o.input,
    "-ss", String(o.startSec), "-to", String(o.endSec),
    "-filter_complex", graph,
    "-map", "[v]", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    o.output,
  ];
}

export function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let err = "";
    proc.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    proc.on("error", (e) => reject(new Error(`Could not start ffmpeg (${bin}): ${e.message}. Set the ffmpeg path in Settings.`)));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}:\n${err}`))));
  });
}

/**
 * Cut the storyboard's Short segment out of the rendered video. If the render job already
 * delivered a vertical short.mp4 next to the video (with real timings and a hook), use that.
 */
export async function makeShort(slug: string, id: string): Promise<string> {
  const [prod, sb, settings] = await Promise.all([getProduction(slug, id), getStoryboard(slug, id), loadSettings()]);
  if (!prod?.videoPath) throw new Error("Render the video first.");
  if (!sb) throw new Error("No storyboard.");
  await assertRenderMatchesApproval(slug, id);
  const delivered = path.join(path.dirname(prod.videoPath), "short.mp4");
  if (!prod.shortPath && existsSync(delivered)) {
    await saveProduction(slug, { ...prod, shortPath: delivered });
    return delivered;
  }
  const { startSec, endSec } = segmentSeconds(sb.scenes, sb.shortSegment.startScene, sb.shortSegment.endScene);
  const dir = path.join(outputDir(), slug, id);
  await mkdir(dir, { recursive: true });
  const output = path.join(dir, "short.mp4");
  await runFfmpeg(settings.ffmpegPath, shortArgs({ input: prod.videoPath, output, startSec, endSec, captionsSrt: prod.captionsPath }));
  await saveProduction(slug, { ...prod, shortPath: output });
  return output;
}
