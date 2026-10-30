import { enqueueJob } from "../jobs";
import { loadSettings } from "../settings";
import { getTask, type TaskType } from "../tasks";
import * as anthropic from "./anthropic";
import * as openai from "./openai";

export type RunResult = { mode: "done" } | { mode: "queued"; jobId: string };

/**
 * Run one AI task. Agent mode (and every `produce` task) writes a job file for
 * the user's coding agent; API mode calls OpenAI or Anthropic and applies the result now.
 */
export async function runTask(slug: string, type: TaskType, input: unknown): Promise<RunResult> {
  const settings = await loadSettings();
  if (settings.aiMode === "agent" || type === "produce") {
    const job = await enqueueJob(slug, type, input);
    return { mode: "queued", jobId: job.id };
  }

  const task = getTask(type);
  const prompt = task.buildPrompt(input);
  let raw: unknown;
  if (settings.aiMode === "openai") {
    if (!settings.openaiKey) throw new Error("Add your OpenAI API key in Settings, or switch to Agent mode.");
    raw = await openai.completeJSON(prompt, settings.openaiModel, settings.openaiKey);
  } else {
    if (!settings.anthropicKey) throw new Error("Add your Anthropic API key in Settings, or switch to Agent mode.");
    raw = await anthropic.completeJSON(prompt, settings.anthropicModel, settings.anthropicKey);
  }
  const output = task.outputSchema.parse(raw);
  await task.apply(slug, input, output);
  return { mode: "done" };
}
