import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const dataDir = () => path.resolve(process.env.STUDIO_DATA_DIR ?? "data");
export const jobsDir = () => path.resolve(process.env.STUDIO_JOBS_DIR ?? "jobs");
export const outputDir = () => path.resolve(process.env.STUDIO_OUTPUT_DIR ?? "output");

/** Read and parse a JSON file; null when it does not exist. */
export async function readJson<T = unknown>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

const fileLocks = new Map<string, Promise<unknown>>();

/**
 * Write JSON atomically (temp file + rename) so a crash never leaves half a file.
 * Writes to the same path are serialised: Windows refuses concurrent renames onto one file.
 */
export function writeJson(file: string, value: unknown): Promise<void> {
  const key = path.resolve(file);
  const run = (fileLocks.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmp, file);
        return;
      } catch (err) {
        // Antivirus or indexers can briefly lock the target on Windows.
        if ((err as NodeJS.ErrnoException).code !== "EPERM" || attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
      }
    }
  });
  fileLocks.set(key, run);
  run.finally(() => { if (fileLocks.get(key) === run) fileLocks.delete(key); }).catch(() => undefined);
  return run;
}
