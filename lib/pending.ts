import { listJobs, type Job } from "./jobs";
import type { TaskType } from "./tasks";

/** Jobs for this channel that the agent has not finished yet. */
export async function pendingJobs(slug: string, types?: TaskType[], match?: (j: Job) => boolean): Promise<Job[]> {
  return (await listJobs()).filter(
    (j) =>
      j.slug === slug &&
      (j.status === "pending" || j.status === "in_progress") &&
      (!types || types.includes(j.type)) &&
      (!match || match(j)),
  );
}
