import { channelKit } from "./channelKit";
import { insights } from "./insights";
import { monthlyPlan } from "./monthlyPlan";
import { produce } from "./produce";
import { research } from "./research";
import { storyboard } from "./storyboard";
import type { TaskDef, TaskType } from "./types";

export type { TaskDef, TaskType } from "./types";

export const TASKS = {
  research,
  channel_kit: channelKit,
  monthly_plan: monthlyPlan,
  storyboard,
  produce,
  insights,
} satisfies Record<TaskType, TaskDef<never, unknown>>;

export function getTask(type: TaskType): TaskDef<unknown, unknown> {
  return TASKS[type] as unknown as TaskDef<unknown, unknown>;
}
