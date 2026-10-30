import { existsSync } from "node:fs";
import path from "node:path";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { LinkButton } from "@/components/link-button";
import { disconnectGoogleAction, saveSettingsAction } from "@/app/actions";
import { loadSettings } from "@/lib/settings";
import { DAILY_QUOTA, remainingQuota } from "@/lib/youtube/quota";
import { redirectUri } from "@/lib/youtube/client";

const mask = (s?: string) => (s ? `••••${s.slice(-4)}` : "");

export default async function SettingsPage(props: PageProps<"/settings">) {
  const sp = await props.searchParams;
  const s = await loadSettings();
  const remaining = await remainingQuota();
  const omOk = s.openMontagePath ? existsSync(path.join(s.openMontagePath, "AGENTS.md")) : false;
  const connected = typeof sp.connected === "string" ? sp.connected : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Everything here is stored locally in <code>data/settings.json</code>, which is gitignored.</p>
      </header>
      <Flash searchParams={props.searchParams} />
      {connected && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">Connected to “{connected}”.</p>}

      <form action={saveSettingsAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI brain</CardTitle>
            <CardDescription>
              <strong>Agent mode</strong>: your coding agent (Claude Code, Codex, Cursor…) does the work from job files, so no API key is needed.
              <br /><strong>API mode</strong>: the studio calls OpenAI or Anthropic directly for research, planning and storyboards.
              Video production always goes through an agent running OpenMontage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {(["agent", "openai", "anthropic"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="radio" name="aiMode" value={m} defaultChecked={s.aiMode === m} />
                  {m === "agent" ? "Agent mode" : m === "openai" ? "OpenAI API" : "Anthropic API"}
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>OpenAI API key</Label>
                <Input name="openaiKey" type="password" placeholder={mask(s.openaiKey) || "sk-…"} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>OpenAI model</Label>
                <Input name="openaiModel" defaultValue={s.openaiModel} />
              </div>
              <div className="space-y-1.5">
                <Label>Anthropic API key</Label>
                <Input name="anthropicKey" type="password" placeholder={mask(s.anthropicKey) || "sk-ant-…"} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>Anthropic model</Label>
                <Input name="anthropicModel" defaultValue={s.anthropicModel} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Agent command (shown on every “waiting for your agent” card)</Label>
              <Input name="agentCommand" defaultValue={s.agentCommand} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>YouTube (your own Google Cloud project)</CardTitle>
            <CardDescription>
              Create an OAuth client (type “Web application”) with redirect URI <code>{redirectUri()}</code>.
              The step-by-step guide is in <code>docs/setup-google.md</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>OAuth client ID</Label>
                <Input name="clientId" placeholder={s.google.clientId ? `…${s.google.clientId.slice(-24)}` : "xxxx.apps.googleusercontent.com"} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>OAuth client secret</Label>
                <Input name="clientSecret" type="password" placeholder={mask(s.google.clientSecret) || "GOCSPX-…"} autoComplete="off" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="audited" defaultChecked={s.google.audited} className="mt-1" />
              <span>
                My Google Cloud project passed YouTube&apos;s API audit. Leave this off until Google approves you: uploads from
                unaudited projects are locked to private, so the studio gives you a Studio upload kit instead.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {s.google.tokens
                ? <Badge>Connected: {s.google.channelTitle ?? "channel"}</Badge>
                : <Badge variant="secondary">Not connected</Badge>}
              <span className="text-muted-foreground">API quota left today: {remaining.toLocaleString()} / {DAILY_QUOTA.toLocaleString()} units</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production tools</CardTitle>
            <CardDescription>OpenMontage is installed separately (it is AGPL-licensed). See <code>docs/openmontage.md</code>.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>OpenMontage folder</Label>
              <Input name="openMontagePath" defaultValue={s.openMontagePath ?? ""} placeholder="C:\\tools\\OpenMontage" />
              {s.openMontagePath && (
                <p className={`text-xs ${omOk ? "text-emerald-400" : "text-destructive"}`}>
                  {omOk ? "Found OpenMontage." : "No AGENTS.md there. Is this the OpenMontage repo root?"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>ffmpeg command or path</Label>
              <Input name="ffmpegPath" defaultValue={s.ffmpegPath} />
            </div>
          </CardContent>
        </Card>

        <SubmitButton size="lg">Save settings</SubmitButton>
      </form>

      <div className="flex flex-wrap gap-3">
        <LinkButton href="/api/google/auth" variant="secondary" prefetch={false}>
          {s.google.tokens ? "Reconnect YouTube channel" : "Connect YouTube channel"}
        </LinkButton>
        {s.google.tokens && (
          <form action={disconnectGoogleAction}><SubmitButton variant="ghost">Disconnect</SubmitButton></form>
        )}
      </div>
    </div>
  );
}
