import { existsSync } from "node:fs";
import { syncJobs } from "@/lib/sync";
import path from "node:path";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChannelNav } from "@/components/channel-nav";
import { CopyButton, SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { LinkButton } from "@/components/link-button";
import { WaitingForAgent } from "@/components/waiting-for-agent";
import { chooseNameAction, startKitAction, updateChannelAction } from "@/app/actions";
import { pendingJobs } from "@/lib/pending";
import { getChannel, getKit } from "@/lib/store";

export default async function KitPage(props: PageProps<"/channels/[slug]/kit">) {
  await syncJobs();
  const { slug } = await props.params;
  const [channel, kit, jobs] = await Promise.all([getChannel(slug), getKit(slug), pendingJobs(slug, ["channel_kit"])]);
  if (!channel) return null;
  const hasLogo = existsSync(path.join(process.cwd(), "public", "channels", slug, "logo.png"));
  const hasBanner = existsSync(path.join(process.cwd(), "public", "channels", slug, "banner.png"));

  return (
    <>
      <ChannelNav channel={channel} active="Channel kit" />
      <Flash searchParams={props.searchParams} />
      <WaitingForAgent jobs={jobs} back={`/channels/${slug}/kit`} />

      {kit ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Name</CardTitle>
              <CardDescription>Pick one. Then rename the channel in YouTube Studio → Customization → Basic info.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {kit.nameOptions.map((o) => (
                <form key={o.name} action={chooseNameAction} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="name" value={o.name} />
                  <div className="text-sm">
                    <p className="font-medium">{o.name} {kit.chosenName === o.name && <Badge className="ml-1">chosen</Badge>}</p>
                    <p className="text-muted-foreground">{o.why}</p>
                  </div>
                  {kit.chosenName !== o.name && <SubmitButton size="sm" variant="secondary">Use</SubmitButton>}
                </form>
              ))}
              <p className="pt-2 text-sm text-muted-foreground">Handle: <code>{kit.handle}</code></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Description</CardTitle>
                <CopyButton text={kit.description} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed">{kit.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Keywords</CardTitle>
                <CopyButton text={kit.keywords.join(", ")} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {kit.keywords.map((k) => <Badge key={k} variant="secondary">{k}</Badge>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pillars</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {kit.pillars.map((p) => <p key={p.name}><span className="font-medium">{p.name}:</span> <span className="text-muted-foreground">{p.why}</span></p>)}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Logo and banner</CardTitle>
              <CardDescription>
                Make them in Canva (or any tool) from these briefs, then drop <code>logo.png</code> and <code>banner.png</code> into{" "}
                <code>public/channels/{slug}/</code> to preview them here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[160px_1fr]">
              <div className="flex flex-col items-center gap-2">
                {hasLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/channels/${slug}/logo.png`} alt="Channel logo" className="size-32 rounded-full border object-cover" />
                  : <div className="flex size-32 items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground">logo.png</div>}
              </div>
              <div className="space-y-3 text-sm">
                {hasBanner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/channels/${slug}/banner.png`} alt="Channel banner" className="w-full rounded-lg border" />
                )}
                <p><span className="font-medium">Logo brief:</span> {kit.logoBrief}</p>
                <p><span className="font-medium">Banner brief:</span> {kit.bannerBrief}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Upload defaults</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Category ID: <code>{kit.uploadDefaults.categoryId}</code> · Tags: {kit.uploadDefaults.tags.join(", ")}</p>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{kit.uploadDefaults.footer}</pre>
            </CardContent>
          </Card>
        </div>
      ) : (
        jobs.length === 0 && <p className="text-muted-foreground">No channel kit yet.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <form action={startKitAction}>
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton variant={kit ? "secondary" : "default"} disabled={jobs.length > 0}>
            {kit ? "Regenerate kit" : "Generate channel kit"}
          </SubmitButton>
        </form>
        {kit && <LinkButton href={`/channels/${slug}/plan`}>Next: monthly plan <ArrowRight /></LinkButton>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel production settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateChannelAction} className="grid gap-4 sm:grid-cols-5 sm:items-end">
            <input type="hidden" name="slug" value={slug} />
            <div className="space-y-1.5"><Label>Min minutes</Label><Input name="minMinutes" type="number" defaultValue={channel.videoMinutes[0]} /></div>
            <div className="space-y-1.5"><Label>Max minutes</Label><Input name="maxMinutes" type="number" defaultValue={channel.videoMinutes[1]} /></div>
            <div className="space-y-1.5"><Label>Budget/video ($)</Label><Input name="budget" type="number" step="0.5" defaultValue={channel.budgetPerVideoUsd} /></div>
            <div className="space-y-1.5">
              <Label>Publishing</Label>
              <select name="publishMode" defaultValue={channel.publishMode} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                <option value="studio-kit">Studio upload kit</option>
                <option value="api">API upload (audited project)</option>
              </select>
            </div>
            <SubmitButton variant="secondary">Save</SubmitButton>
            <input type="hidden" name="pipeline" value={channel.pipeline} />
          </form>
        </CardContent>
      </Card>
    </>
  );
}
