import Anthropic from "@anthropic-ai/sdk";
import { parseModelJson } from "./json";

export async function completeJSON(prompt: string, model: string, apiKey: string): Promise<unknown> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: 16000,
    system: "You are the planning brain of AI YouTube Studio. Reply with a single JSON object only: no prose, no markdown fences.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return parseModelJson(text);
}
