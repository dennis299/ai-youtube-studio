import { loadSettings, saveSettings } from "../settings";

export const DAILY_QUOTA = 10_000;
export const QUOTA_COST = {
  search: 100,
  videosList: 1,
  channelsList: 1,
  insert: 1600,
  thumbnailSet: 50,
  videosUpdate: 50,
} as const;
export type QuotaOp = keyof typeof QUOTA_COST;

export class QuotaError extends Error {
  constructor(public needed: number, public remaining: number) {
    super(`This needs ${needed} YouTube API units but only ${remaining} are left today. The quota resets at midnight Pacific time.`);
  }
}

/** YouTube's quota day runs on Pacific time. */
export function pacificDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}

export async function remainingQuota(now = new Date()): Promise<number> {
  const { quota } = await loadSettings();
  return DAILY_QUOTA - (quota.date === pacificDate(now) ? quota.used : 0);
}

export async function chargeQuota(op: QuotaOp, count = 1, now = new Date()): Promise<void> {
  const { quota } = await loadSettings();
  const date = pacificDate(now);
  const used = (quota.date === date ? quota.used : 0) + QUOTA_COST[op] * count;
  await saveSettings({ quota: { date, used } });
}

export async function assertQuota(op: QuotaOp, count = 1, now = new Date()): Promise<void> {
  const needed = QUOTA_COST[op] * count;
  const remaining = await remainingQuota(now);
  if (needed > remaining) throw new QuotaError(needed, remaining);
}

/** Check quota, run the call, and charge only if it succeeded. */
export async function callCharged<T>(op: QuotaOp, count: number, fn: () => Promise<T>, now = new Date()): Promise<T> {
  await assertQuota(op, count, now);
  const result = await fn();
  await chargeQuota(op, count, now);
  return result;
}
