export type Slot = { week: 1 | 2 | 3 | 4; date: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Posting slots for one monthly plan: the first 4 Monday-start weeks beginning on
 * or after the 1st, using the channel's posting days (0=Sun … 6=Sat), `perWeek` per week.
 */
export function monthSlots(month: string, days: number[], perWeek: number): Slot[] {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);

  // Order days Monday-first so a Mon–Fri cadence fills in calendar order.
  const ordered = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).slice(0, perWeek);
  const slots: Slot[] = [];
  for (let w = 0; w < 4; w++) {
    for (const day of ordered) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + w * 7 + ((day + 6) % 7));
      slots.push({ week: (w + 1) as Slot["week"], date: iso(d) });
    }
  }
  return slots;
}

/** The Monday-start ISO date of the week containing `date`. */
export function weekOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
}

/** ISO timestamp for `hourLocal` on `date` in a fixed UTC offset like "-05:00". */
export function publishAt(date: string, hourLocal = 15, utcOffset = "+00:00"): string {
  return new Date(`${date}T${pad(hourLocal)}:00:00${utcOffset}`).toISOString();
}

/** Current machine UTC offset formatted as "+HH:MM". */
export function localOffset(): string {
  const mins = -new Date().getTimezoneOffset();
  const sign = mins >= 0 ? "+" : "-";
  return `${sign}${pad(Math.floor(Math.abs(mins) / 60))}:${pad(Math.abs(mins) % 60)}`;
}
