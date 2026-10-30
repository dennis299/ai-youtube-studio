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

/** Write JSON atomically (temp file + rename) so a crash never leaves half a file. */
export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(tmp, file);
}
