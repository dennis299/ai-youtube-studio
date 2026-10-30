import { Badge } from "@/components/ui/badge";
import type { VideoPlan } from "@/lib/schemas";

const STYLE: Record<VideoPlan["status"], string> = {
  planned: "bg-muted text-muted-foreground",
  storyboarded: "bg-sky-500/15 text-sky-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  producing: "bg-amber-500/15 text-amber-300",
  rendered: "bg-violet-500/15 text-violet-300",
  published: "bg-primary text-primary-foreground",
  failed: "bg-destructive/20 text-destructive",
};

export function StatusBadge({ status }: { status: VideoPlan["status"] }) {
  return <Badge className={STYLE[status]}>{status}</Badge>;
}
