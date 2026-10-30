import { describe, expect, it } from "vitest";
import { monthSlots, publishAt } from "@/lib/schedule";

describe("monthSlots", () => {
  it("gives 20 weekday slots starting the first Monday on or after the 1st", () => {
    const slots = monthSlots("2026-11", [1, 2, 3, 4, 5], 5);
    expect(slots).toHaveLength(20);
    expect(slots[0]).toEqual({ week: 1, date: "2026-11-02" });
    expect(slots[19]).toEqual({ week: 4, date: "2026-11-27" });
    expect(new Set(slots.map((s) => s.date)).size).toBe(20);
    for (const s of slots) {
      const day = new Date(`${s.date}T12:00:00Z`).getUTCDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it("respects fewer posting days", () => {
    const slots = monthSlots("2026-11", [1, 3, 5], 3);
    expect(slots).toHaveLength(12);
    expect(slots.slice(0, 3).map((s) => s.date)).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
  });
});

describe("publishAt", () => {
  it("builds an ISO timestamp for the local hour in the given offset", () => {
    expect(publishAt("2026-11-02", 15, "-05:00")).toBe("2026-11-02T20:00:00.000Z");
  });
});
