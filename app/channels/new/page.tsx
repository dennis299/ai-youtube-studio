import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/client-bits";
import { Flash } from "@/components/flash";
import { createChannelAction } from "@/app/actions";
import { PRESETS } from "@/lib/presets";
import { NicheForm } from "./niche-form";

export default async function NewChannel(props: PageProps<"/channels/new">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find your niche</h1>
        <p className="text-muted-foreground">
          Pick a starting point or describe your own. The AI researches the top-performing videos in the niche,
          then builds your channel kit and a month of videos from what is already working.
        </p>
      </header>
      <Flash searchParams={props.searchParams} />
      <form action={createChannelAction} className="space-y-6">
        <NicheForm presets={PRESETS} />
        <Card>
          <CardHeader>
            <CardTitle>Production</CardTitle>
            <CardDescription>You can change these later on the Channel kit page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <Field label="Videos per week"><Input name="perWeek" type="number" min={1} max={7} defaultValue={5} /></Field>
            <Field label="Min minutes"><Input name="minMinutes" type="number" min={1} defaultValue={8} /></Field>
            <Field label="Max minutes"><Input name="maxMinutes" type="number" min={1} defaultValue={10} /></Field>
            <Field label="Budget per video ($)"><Input name="budget" type="number" min={0} step="0.5" defaultValue={5} /></Field>
          </CardContent>
        </Card>
        <SubmitButton size="lg">Create channel and start research</SubmitButton>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

