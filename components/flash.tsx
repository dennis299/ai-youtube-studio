import { CircleCheck, OctagonX } from "lucide-react";

/** Shows ?ok= / ?error= messages left by server actions. */
export async function Flash({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  if (!ok && !error) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        error ? "border-destructive/40 bg-destructive/10" : "border-emerald-500/40 bg-emerald-500/10"
      }`}
    >
      {error ? <OctagonX className="mt-0.5 size-4 shrink-0 text-destructive" /> : <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />}
      <p>{error ?? ok}</p>
    </div>
  );
}
