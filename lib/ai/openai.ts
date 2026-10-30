import OpenAI from "openai";
import { parseModelJson } from "./json";

export async function completeJSON(prompt: string, model: string, apiKey: string): Promise<unknown> {
  const client = new OpenAI({ apiKey });
  const res = await client.responses.create({
    model,
    instructions: "You are the planning brain of AI YouTube Studio. Reply with a single JSON object only.",
    input: prompt,
    text: { format: { type: "json_object" } },
  });
  return parseModelJson(res.output_text);
}
