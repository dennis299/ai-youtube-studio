import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Channel } from "@/lib/schemas";

/** Point the store and job queue at fresh temp dirs for one test. */
export function useTempDirs() {
  const root = mkdtempSync(path.join(tmpdir(), "studio test "));
  process.env.STUDIO_DATA_DIR = path.join(root, "data");
  process.env.STUDIO_JOBS_DIR = path.join(root, "jobs");
  process.env.STUDIO_OUTPUT_DIR = path.join(root, "output");
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function makeChannel(over: Partial<Channel> = {}): Channel {
  return {
    slug: "built-and-broken",
    name: "Built & Broken",
    niche: "Business stories: how companies were built and how they broke",
    style: "Cinematic documentary narration",
    audience: "Curious adults 18-45 who like business and history",
    language: "en",
    cadence: { perWeek: 5, days: [1, 2, 3, 4, 5] },
    videoMinutes: [8, 10],
    budgetPerVideoUsd: 5,
    pipeline: "documentary-montage",
    publishMode: "studio-kit",
    stage: "research",
    createdAt: "2026-10-30T10:00:00.000Z",
    ...over,
  };
}
