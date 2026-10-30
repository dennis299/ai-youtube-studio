import { cache } from "react";
import { ingestDoneJobs } from "./jobs";

/**
 * Apply finished agent jobs once per request. Layouts and pages render in
 * parallel, so every page awaits this before reading state.
 */
export const syncJobs = cache(() => ingestDoneJobs());
