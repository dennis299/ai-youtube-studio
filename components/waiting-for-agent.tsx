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
        <div className="flex items-start gap-3">
          <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Bot className="size-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="font-medium">
              Waiting for your AI agent · {jobs.length} job{jobs.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {jobs.map((j) => (
                <li key={j.id} className="truncate">{j.title}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-muted-foreground">
          Run this in a terminal in the studio folder (or ask your coding agent to &quot;process pending jobs&quot;):
        </p>
        <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs whitespace-pre">{agentCommand}</code>
        <div className="flex flex-wrap items-center gap-2">
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
