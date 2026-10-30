/** Parse a model reply as JSON, tolerating ```json fences and leading/trailing prose. */
export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI reply did not contain a JSON object.");
  return JSON.parse(body.slice(start, end + 1));
}
