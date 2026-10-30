import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getProduction } from "@/lib/store";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Serves a rendered file for preview. Only paths recorded in the video's production.json are served. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("slug") ?? "";
  const id = sp.get("id") ?? "";
  const kind = sp.get("kind");
  const prod = await getProduction(slug, id).catch(() => null);
  const file = kind === "video" ? prod?.videoPath : kind === "short" ? prod?.shortPath : kind === "thumb" ? prod?.thumbnailPath : undefined;
  if (!file || !existsSync(file)) return new Response("Not found", { status: 404 });

  const size = statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = Number(range[1] || 0);
    const end = range[2] ? Number(range[2]) : size - 1;
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" } });
}
