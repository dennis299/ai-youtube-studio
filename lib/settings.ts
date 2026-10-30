import path from "node:path";
import { dataDir, readJson, writeJson } from "./fsjson";
import { SettingsSchema, type Settings } from "./schemas";

const settingsFile = () => path.join(dataDir(), "settings.json");

export async function loadSettings(): Promise<Settings> {
  return SettingsSchema.parse((await readJson(settingsFile())) ?? {});
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = SettingsSchema.parse({
    ...current,
    ...patch,
    google: { ...current.google, ...(patch.google ?? {}) },
  });
  await writeJson(settingsFile(), next);
  return next;
}
