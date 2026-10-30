import { Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton, SubmitButton } from "@/components/client-bits";
import { syncJobsAction } from "@/app/actions";
import { loadSettings } from "@/lib/settings";
import type { Job } from "@/lib/jobs";

/** Shown while a step is queued for the user's coding agent. */
export async function WaitingForAgent({ jobs, back }: { jobs: Job[]; back: string }) {
  if (jobs.length === 0) return null;
  const { agentCommand } = await loadSettings();
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-3 py-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <Bot className="size-4 text-primary" />
          Waiting for your AI agent: {jobs.map((j) => j.title).join(", ")}
        </p>
        <p className="text-muted-foreground">
          Run this in a terminal in the studio folder (or ask your coding agent to &quot;process pending jobs&quot;):
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs">{agentCommand}</code>
          <CopyButton text={agentCommand} />
          <form action={syncJobsAction}>
            <input type="hidden" name="back" value={back} />
            <SubmitButton size="sm">Check for results</SubmitButton>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
