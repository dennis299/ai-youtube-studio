"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NichePreset } from "@/lib/presets";

/** Preset picker that pre-fills the niche fields; everything stays editable. */
export function NicheForm({ presets }: { presets: NichePreset[] }) {
  const [presetId, setPresetId] = useState(presets[0].id);
  const p = presets.find((x) => x.id === presetId);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((x) => (
          <button
            type="button"
            key={x.id}
            onClick={() => setPresetId(x.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${presetId === x.id ? "border-primary bg-primary/10" : "hover:border-primary/40"}`}
          >
            <p className="font-medium">{x.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">RPM {x.rpm}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPresetId("custom")}
          className={`rounded-xl border p-4 text-left ${presetId === "custom" ? "border-primary bg-primary/10" : "hover:border-primary/40"}`}
        >
          <p className="font-medium">Something else</p>
          <p className="mt-1 text-xs text-muted-foreground">Describe your own niche</p>
        </button>
      </div>

      {p?.note && <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">{p.note}</p>}

      <Card key={presetId}>
        <CardHeader>
          <CardTitle>Your niche</CardTitle>
          <CardDescription>Be specific. &quot;Anime&quot; is too broad. &quot;Anime what-if match-ups&quot; is a channel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="hidden" name="preset" value={presetId} />
          <div className="space-y-1.5">
            <Label htmlFor="name">Channel name (working)</Label>
            <Input id="name" name="name" defaultValue={p?.label ?? ""} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="niche">Niche</Label>
            <Textarea id="niche" name="niche" defaultValue={p?.niche ?? ""} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="style">Storytelling style</Label>
              <Input id="style" name="style" defaultValue={p?.style ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audience">Audience</Label>
              <Input id="audience" name="audience" defaultValue={p?.audience ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="queries">Research searches (comma separated)</Label>
            <Input id="queries" name="queries" defaultValue={p?.exampleQueries.join(", ") ?? ""} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
