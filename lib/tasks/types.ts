import { z, type ZodType } from "zod";

export type TaskType = "research" | "channel_kit" | "monthly_plan" | "storyboard" | "produce" | "insights";

export interface TaskDef<I, O> {
  type: TaskType;
  title(input: I): string;
  outputSchema: ZodType<O>;
  /** Full markdown brief: what to do, the rules, and the exact output shape. */
  buildPrompt(input: I): string;
  /** Write a validated result into the store. */
  apply(slug: string, input: I, output: O): Promise<void>;
  /** Optional hook when the agent reports the job as failed. */
  onFail?(slug: string, input: I, error: string): Promise<void>;
}

export const RULES = `## House rules (apply to every task)
- Never publish or upload anything yourself. Publishing is the human's call after the weekly check-in.
- Never use copyrighted footage, film/anime screenshots, or music. Visuals are stock, public-domain archive, AI-generated, or motion graphics.
- Every video needs a real story or angle a template could not produce. YouTube demonetizes generic, repetitive, mass-produced content.
- No AI "expert" personas giving finance, health, legal, or political advice.
- Be factually careful. Prefer well-documented events and name your sources.`;

export function outputSection(schema: ZodType): string {
  return `## Output JSON schema
Respond with a single JSON object that validates against this schema. No prose, no markdown fences.

\`\`\`json
${JSON.stringify(z.toJSONSchema(schema), null, 2)}
\`\`\``;
}

export function channelSection(channel: { name: string; niche: string; style: string; audience: string; videoMinutes: [number, number] }): string {
  return `## Channel
- Name: ${channel.name}
- Niche: ${channel.niche}
- Style: ${channel.style}
- Audience: ${channel.audience}
- Long-form length: ${channel.videoMinutes[0]}–${channel.videoMinutes[1]} minutes`;
}

export const json = (v: unknown) => "```json\n" + JSON.stringify(v, null, 2) + "\n```";
