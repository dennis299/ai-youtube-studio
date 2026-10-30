import { createHash } from "node:crypto";
import { getVideo, saveVideo, writeStoryboard } from "./store";
import type { Checklist, Storyboard } from "./schemas";

export const CHECKLIST: { key: keyof Checklist; label: string }[] = [
  { key: "original", label: "Original angle: this is a real story, not a generic or templated video" },
  { key: "visualsClean", label: "Visuals are stock, archive, AI-generated or motion graphics, with no film/TV/anime frames" },
  { key: "disclosureSet", label: "AI disclosure is set correctly (on if realistic synthetic people, places or events appear)" },
  { key: "factsChecked", label: "Facts checked against the listed sources" },
];

/** Stable key-sorted JSON so the hash does not depend on property order. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Fingerprint of everything that would be produced; excludes the approval block. */
export function storyboardHash(sb: Storyboard): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { approval, ...content } = sb;
  return createHash("sha256").update(stable(content)).digest("hex");
}

export function approve(sb: Storyboard, checklist: Checklist): Storyboard {
  const missing = CHECKLIST.filter((c) => !checklist[c.key]).map((c) => c.label);
  if (missing.length) throw new Error(`Tick every check-in item first. Missing: ${missing.join("; ")}`);
  return { ...sb, approval: { hash: storyboardHash(sb), at: new Date().toISOString(), checklist } };
}

export function isApproved(sb: Storyboard | null | undefined): boolean {
  return !!sb?.approval && sb.approval.hash === storyboardHash(sb);
}

/**
 * Save a storyboard. An approval that no longer matches the content is dropped
 * and the video goes back to "storyboarded"; a valid approval marks it "approved".
 */
export async function saveStoryboard(slug: string, sb: Storyboard): Promise<Storyboard> {
  const valid = isApproved(sb);
  const toSave = valid ? sb : { ...sb, approval: undefined };
  await writeStoryboard(slug, toSave);
  const v = await getVideo(slug, sb.videoId);
  if (v && ["planned", "storyboarded", "approved"].includes(v.status)) {
    const status = valid ? "approved" : "storyboarded";
    if (v.status !== status) await saveVideo(slug, { ...v, status });
  }
  return toSave;
}
