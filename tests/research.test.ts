import { describe, expect, it } from "vitest";
import { durationToSeconds } from "@/lib/youtube/research";

describe("durationToSeconds", () => {
  it("parses YouTube ISO 8601 durations", () => {
    expect(durationToSeconds("PT12M30S")).toBe(750);
    expect(durationToSeconds("PT1H2M3S")).toBe(3723);
    expect(durationToSeconds("PT45S")).toBe(45);
    expect(durationToSeconds("garbage")).toBe(0);
  });
});
