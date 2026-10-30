import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton, SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { retryJobAction, syncJobsAction } from "@/app/actions";
import { listJobs } from "@/lib/jobs";
import { syncJobs } from "@/lib/sync";
import { loadSettings } from "@/lib/settings";

const VARIANT = { pending: "secondary", in_progress: "default", done: "outline", failed: "destructive" } as const;

export default async function JobsPage(props: PageProps<"/jobs">) {
  await syncJobs();
  const [jobs, settings] = await Promise.all([listJobs(), loadSettings()]);
  const open = jobs.filter((j) => j.status === "pending" || j.status === "in_progress");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Agent jobs</h1>
        <p className="text-muted-foreground">
          In Agent mode the studio writes each AI task to <code>jobs/pending/</code>. Your coding agent (Claude Code, Codex,
          Cursor…) does the work and writes results to <code>jobs/done/</code>, and the studio validates and applies them.
          Video production always runs this way, because OpenMontage is agent-driven.
        </p>
      </header>
      <Flash searchParams={props.searchParams} />

      <Card>
        <CardHeader>
          <CardTitle>Run your agent</CardTitle>
          <CardDescription>
            Current AI mode: <strong>{settings.aiMode}</strong>. {open.length} job{open.length === 1 ? "" : "s"} waiting.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs">{settings.agentCommand}</code>
          <CopyButton text={settings.agentCommand} />
          <form action={syncJobsAction}>
            <input type="hidden" name="back" value="/jobs" />
            <SubmitButton size="sm">Check for results</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {jobs.length === 0 && <p className="text-muted-foreground">No jobs yet.</p>}
        {jobs.map((j) => (
          <Card key={j.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{j.title}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{j.id}</code> · {j.slug} · {j.createdAt && new Date(j.createdAt).toLocaleString()}
                </p>
                {(j.status === "pending" || j.status === "in_progress") && (
                  <p className="text-xs text-muted-foreground">Brief: <code>jobs/pending/{j.id}.md</code></p>
                )}
                {j.error && <p className="whitespace-pre-wrap text-xs text-destructive">{j.error.slice(0, 800)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={VARIANT[j.status]}>{j.status.replace("_", " ")}</Badge>
                {j.status === "failed" && j.slug !== "?" && (
                  <form action={retryJobAction}>
                    <input type="hidden" name="id" value={j.id} />
                    <SubmitButton size="sm" variant="secondary">Retry</SubmitButton>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
