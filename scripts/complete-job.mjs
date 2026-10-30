#!/usr/bin/env node
// Finish an agent job: node scripts/complete-job.mjs <jobId> <output.json>
// or report failure:   node scripts/complete-job.mjs <jobId> --fail "what went wrong"
// Moves jobs/pending/<id>.json to jobs/done/<id>.json with status + output, and removes the pending brief.
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const [id, arg, msg] = process.argv.slice(2);
if (!id || !arg) {
  console.error('usage: node scripts/complete-job.mjs <jobId> <output.json> | --fail "reason"');
  process.exit(1);
}
const jobs = path.resolve(process.env.STUDIO_JOBS_DIR ?? "jobs");
const pending = path.join(jobs, "pending", `${id}.json`);
if (!existsSync(pending)) {
  console.error(`No pending job ${pending}`);
  process.exit(1);
}
const job = JSON.parse(readFileSync(pending, "utf8"));
if (arg === "--fail") {
  Object.assign(job, { status: "failed", error: msg ?? "Agent reported failure" });
} else {
  Object.assign(job, { status: "done", output: JSON.parse(readFileSync(arg, "utf8")) });
}
mkdirSync(path.join(jobs, "done"), { recursive: true });
writeFileSync(path.join(jobs, "done", `${id}.json`), JSON.stringify(job, null, 2) + "\n");
unlinkSync(pending);
if (existsSync(pending.replace(/\.json$/, ".md"))) unlinkSync(pending.replace(/\.json$/, ".md"));
console.log(`${id} → jobs/done (${job.status})`);
