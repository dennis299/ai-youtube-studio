import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Settings } from "@/lib/schemas";

/** Lists what is still missing in Settings. Renders nothing when setup is complete. */
export function SetupNotice({ settings, need = ["ai", "google", "openmontage"] }: {
  settings: Settings;
  need?: ("ai" | "google" | "openmontage")[];
}) {
  const missing: string[] = [];
  if (need.includes("ai")) {
    if (settings.aiMode === "openai" && !settings.openaiKey) missing.push("an OpenAI API key (or switch to Agent mode)");
    if (settings.aiMode === "anthropic" && !settings.anthropicKey) missing.push("an Anthropic API key (or switch to Agent mode)");
  }
  if (need.includes("google") && !settings.google.tokens) missing.push("a connected YouTube channel (Google OAuth)");
  if (need.includes("openmontage") && !settings.openMontagePath) missing.push("the path to your OpenMontage install");
  if (missing.length === 0) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex gap-3 py-4 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div>
          <p>Finish setup to unlock every step. Still needed: {missing.join(", ")}.</p>
          <Link href="/settings" className="text-primary underline underline-offset-4">Open settings</Link>
        </div>
      </CardContent>
    </Card>
  );
}
