import { describe, expect, it } from "vitest";
import { segmentSeconds, shortArgs } from "@/lib/media/short";
import type { Scene } from "@/lib/schemas";

const scenes: Scene[] = Array.from({ length: 12 }, (_, i) => ({
  n: i + 1, narration: "x", visual: "v", source: "stock", seconds: i < 6 ? 20 : 11,
}));

describe("Short cut-down", () => {
  it("turns a scene range into start/end seconds", () => {
    // scenes 1-6 are 20s each (120s); scenes 7-11 are 11s each
    expect(segmentSeconds(scenes, 7, 11)).toEqual({ startSec: 120, endSec: 175 });
  });

  it("keeps paths with spaces as single arguments", () => {
    const input = "E:\\Projects\\MTS business\\a b.mp4";
    const args = shortArgs({ input, output: "E:\\out dir\\short.mp4", startSec: 120, endSec: 175 });
    expect(args.filter((a) => a === input)).toHaveLength(1);
    expect(args.at(-1)).toBe("E:\\out dir\\short.mp4");
  });

  it("seeks to the segment and renders vertical 1080x1920", () => {
    const args = shortArgs({ input: "in.mp4", output: "out.mp4", startSec: 120, endSec: 175 });
    expect(args.join(" ")).toContain("-ss 120");
    expect(args.join(" ")).toContain("-to 175");
    expect(args.join(" ")).toContain("1080:1920");
  });

  it("burns in captions when an SRT is given", () => {
    const args = shortArgs({ input: "in.mp4", output: "out.mp4", startSec: 0, endSec: 30, captionsSrt: "C:\\a b\\cap.srt" });
    expect(args.join(" ")).toContain("subtitles=");
  });
});
