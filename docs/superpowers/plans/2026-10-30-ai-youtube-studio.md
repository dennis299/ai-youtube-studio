# AI YouTube Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js app that takes a YouTube channel from niche to
published videos: research, channel kit, monthly plan, storyboards, weekly
check-in, OpenMontage production, publishing, and a stats loop. It runs with
either a coding agent or an OpenAI/Anthropic key as the brain.

**Architecture:** All state lives as plain JSON files under `data/`. A coding
agent can read and write them as easily as the app can, and the example
channel can be committed. Every AI step is a typed *task* (`research`,
`channel_kit`, `monthly_plan`, `storyboard`, `produce`, `insights`). In API
mode the app runs the task itself. In Agent mode it writes a job file to
`jobs/pending/`, and the agent writes the result to `jobs/done/`, which the
app ingests. YouTube access uses the user's own OAuth client through
`googleapis`. Production is always an OpenMontage job run by an agent.

**Tech Stack:** Next.js 16 (App Router, server actions, TypeScript), React 19,
Tailwind 4 + shadcn/ui, zod 4, googleapis, openai, @anthropic-ai/sdk, vitest,
and ffmpeg (system binary).

**Spec:** `docs/superpowers/specs/2026-10-30-ai-youtube-studio-design.md`

**Deviation from spec (Claude's call):** the spec named SQLite. JSON files
replace it so agents can read and write state directly, there is no native
module to build on Windows, and the example channel can live in git.

## Global Constraints

- Runs on localhost only (`npm run dev`, port 3000). No auth and no hosting.
- Repo is MIT. OpenMontage (AGPL-3.0) is never copied in; its path is a setting.
- Never commit secrets: `data/settings.json`, `.env*` (except `.env.example`), and `jobs/` are gitignored. Only `examples/` and `data/channels/built-and-broken/` are committed.
- Cadence: 5 videos/week, default Mon–Fri, 4 weeks = 20 per monthly plan.
- Long video target is 8–10 min. Budget is at most $5/video by default (editable per channel).
- Weekly check-in is the only human gate. Nothing can be produced or published unless its check-in is approved and all 4 checklist items are ticked.
- Approval is bound to content: editing an approved storyboard resets it to `draft`.
- OpenMontage production jobs always carry `approval_policy: "pre-approved-by-weekly-checkin"`, `pipeline: "documentary-montage"` (overridable per channel), `composer: "remotion"`, and `storyboard_binding: "script-and-scene-order-are-final"`.
- YouTube quota: 10,000 units/day. Costs are search.list=100, videos.list=1, channels.list=1, videos.insert=1600, thumbnails.set=50, videos.update=50.
- Unaudited Google projects default to `publishMode: "studio-kit"`, and the API upload path is opt-in (`publishMode: "api"`).
- Every external process (ffmpeg, agent CLI) is spawned with an args array, never a shell string, because paths may contain spaces (the dev path does).
- Works on Windows, macOS, and Linux.

## Review Focus

1. **The agent writes a malformed or schema-invalid result to `jobs/done/`.** The app marks the job `failed` with the zod error, keeps the file, and never crashes a page. *Test in Task 3.*
2. **No settings yet**, i.e. no Google client, no AI key, or no OpenMontage path. Every page renders and shows a "set this up" card linking to `/settings`. *Test in Task 2:* `loadSettings()` on a missing file returns defaults.
3. **An approved storyboard is edited.** The approval resets and the video drops out of production readiness. *Test in Task 6.*
4. **A YouTube API error happens** (403 quotaExceeded, 401 expired token). The user sees a readable message, the token refreshes once on a 401, and the quota counter is not charged for failed calls. *Test in Task 4.*
5. **Paths contain spaces** (`E:\Projects\MTS business\...`). ffmpeg and agent commands still work. *Test in Task 7:* the Short args builder keeps the path as a single array element.

---

## File Map

```
ai-youtube-studio/
  app/                          # Next.js routes (thin; call lib/)
    layout.tsx, page.tsx        # shell + dashboard (channels list, job inbox count)
    settings/page.tsx           # AI mode, keys, Google client, OpenMontage path, ffmpeg path
    jobs/page.tsx               # agent job inbox: pending/done/failed + "copy agent command"
    channels/new/page.tsx       # Niche Finder (presets + free text)
    channels/[slug]/page.tsx            # overview: stage progress, research report
    channels/[slug]/kit/page.tsx        # Channel Kit
    channels/[slug]/plan/page.tsx       # 4-week calendar
    channels/[slug]/videos/[id]/page.tsx# storyboard editor + produce/publish panel
    channels/[slug]/checkin/page.tsx    # weekly check-in
    channels/[slug]/stats/page.tsx      # stats dashboard
    api/google/auth/route.ts, api/google/callback/route.ts
  components/                   # shadcn ui + small app components
  lib/
    schemas.ts                  # zod: Channel, Research, ChannelKit, MonthlyPlan, VideoPlan, Storyboard, Production, Publish, Stats, Settings, Job
    store.ts                    # JSON file store (data/)
    settings.ts                 # load/save settings, defaults
    jobs.ts                     # agent job queue (jobs/)
    tasks/                      # one file per task type: prompt builder + output schema + apply()
      research.ts, channelKit.ts, monthlyPlan.ts, storyboard.ts, produce.ts, insights.ts, index.ts
    ai/                         # runTask(): API mode providers
      openai.ts, anthropic.ts, index.ts
    youtube/
      oauth.ts, client.ts, research.ts, upload.ts, stats.ts, quota.ts
    schedule.ts                 # weekday slots, week grouping, publishAt
    checkin.ts                  # approval rules + content hash
    media/short.ts              # ffmpeg Short args + runner
    publish/kit.ts              # studio upload kit builder + description templating
    presets.ts                  # niche presets
  tests/                        # vitest, mirrors lib/
  AGENTS.md, CLAUDE.md          # how an agent processes jobs (CLAUDE.md = "@AGENTS.md")
  README.md, LICENSE, .env.example
  docs/  (setup-google.md, agent-mode.md, openmontage.md, architecture.md, images/)
  examples/built-and-broken/    # channel kit, logo, banner
  data/channels/built-and-broken/ # committed example channel state
```

---

### Task 1: Scaffold

**Files:** project root (create-next-app output), `vitest.config.ts`, `.gitignore`, `LICENSE`, `.env.example`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:** Produces the app shell (sidebar with Dashboard, Jobs, Settings, and a channel list), the `@/` path alias, and `npm test`.

- [ ] **Step 1:** In `ai-youtube-studio/` (which already holds `docs/` and `examples/`), run `npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes`. Keep existing files.
- [ ] **Step 2:** `npx shadcn@latest init -d`, then add `button card input textarea label select tabs badge checkbox dialog table sonner separator`.
- [ ] **Step 3:** `npm i zod googleapis openai @anthropic-ai/sdk` and `npm i -D vitest`. Add the script `"test": "vitest run"` and a `vitest.config.ts` with the `@` alias.
- [ ] **Step 4:** Add to `.gitignore`: `data/*` and `!data/channels/`, `data/channels/*` and `!data/channels/built-and-broken/`, `jobs/`, `output/`, `.env*`, `!.env.example`. Write an MIT `LICENSE` (2026, Dennis). Write `.env.example` with `PORT=3000` and comments saying settings live in the UI.
- [ ] **Step 5:** Build the shell layout: dark theme with brand-neutral tokens and a sidebar. The dashboard shows "No channels yet → Find a niche".
- [ ] **Step 6:** Run `npm run build`. Expected: success. Then `git init`, and commit with the message `chore: scaffold app`.

### Task 2: Schemas, store, settings

**Files:** `lib/schemas.ts`, `lib/store.ts`, `lib/settings.ts`, `tests/store.test.ts`, `tests/settings.test.ts`

**Interfaces (Produces):**
- `Settings = { aiMode: "agent"|"openai"|"anthropic"; openaiKey?; anthropicKey?; openaiModel: string; anthropicModel: string; google: { clientId?; clientSecret?; tokens?; channelId?; channelTitle?; audited: boolean }; openMontagePath?; ffmpegPath: string; agentCommand: string; quota: { date: string; used: number } }`
- `loadSettings(): Promise<Settings>` and `saveSettings(patch: Partial<Settings>): Promise<Settings>`. Path is `data/settings.json`. Defaults: `aiMode "agent"`, `ffmpegPath "ffmpeg"`, and `agentCommand 'claude -p "Process all pending jobs in jobs/pending following AGENTS.md"'`.
- `Channel = { slug; name; niche; style; audience; language: "en"; cadence: { perWeek: 5; days: number[] /*1..5*/ }; videoMinutes: [8,10]; budgetPerVideoUsd: 5; pipeline: "documentary-montage"; publishMode: "studio-kit"|"api"; stage: "research"|"kit"|"plan"|"storyboards"|"producing"; createdAt }`
- `Research = { queries: string[]; topVideos: {id,title,channel,views,subs,ratio,durationSec,publishedAt}[]; patterns: string[]; pillars: {name,why}[]; summary: string }`
- `ChannelKit = { nameOptions: {name, why}[]; chosenName?: string; handle; description; keywords: string[]; pillars; logoBrief; bannerBrief; uploadDefaults: { categoryId: string; tags: string[]; footer: string } }`
- `VideoPlan = { id; month: "YYYY-MM"; week: 1..4; publishDate: "YYYY-MM-DD"; pillar; workingTitle; angle; whyItWorks; status: "planned"|"storyboarded"|"approved"|"producing"|"rendered"|"published"|"failed" }`
- `Storyboard = { videoId; titleOptions: string[3]; chosenTitle; hook; beats: {heading, narration}[]; scenes: {n, narration, visual, source: "stock"|"archive"|"ai-image"|"ai-video"|"motion-graphics"|"user-image", seconds}[]; outro; thumbnailConcepts: string[]; shortSegment: { startScene: number; endScene: number; hookLine: string }; sources: string[]; aiDisclosure: boolean; approval?: { hash: string; at: string; checklist: { original: boolean; visualsClean: boolean; disclosureSet: boolean; factsChecked: boolean } } }`
- `Production = { videoId; jobId; status: "queued"|"rendering"|"rendered"|"failed"; videoPath?; shortPath?; thumbnailPath?; costUsd?; error? }`, `Publish = { videoId; mode; youtubeId?; url?; publishAt; kitPath? }`, `Stats = { videoId; youtubeId; fetchedAt; views; likes; comments; avgViewDurationSec? }`
- Store (all async, `data/channels/<slug>/…`): `listChannels()`, `getChannel(slug)`, `saveChannel(c)`, `getResearch/saveResearch`, `getKit/saveKit`, `listVideos(slug)`, `getVideo(slug,id)`, `saveVideo(slug, v)`, `getStoryboard/saveStoryboard`, `getProduction/saveProduction`, `getPublish/savePublish`, `listStats/saveStats`. Missing file → `null`/`[]`. Writes are atomic (write to `.tmp`, then rename). The data root comes from `process.env.STUDIO_DATA_DIR ?? "data"` so tests can use a tmp dir.

- [ ] **Step 1: Failing tests:** `store.test.ts` checks that `saveChannel` then `getChannel` round-trips, that `getChannel("nope")` returns `null`, that `listChannels()` is sorted by `createdAt`, and that `saveVideo` with an invalid status throws a ZodError. `settings.test.ts` checks that a missing file returns the defaults above, and that `saveSettings({aiMode:"openai"})` keeps the other fields.
- [ ] **Step 2:** `npm test` should FAIL because the modules are missing.
- [ ] **Step 3:** Implement the schemas, store, and settings.
- [ ] **Step 4:** `npm test` should PASS.
- [ ] **Step 5:** Commit with the message `feat: json store, schemas, settings`.

### Task 3: Tasks, agent job queue, API-mode providers

**Files:** `lib/tasks/*.ts`, `lib/jobs.ts`, `lib/ai/*.ts`, `tests/jobs.test.ts`, `tests/tasks.test.ts`, `AGENTS.md`, `CLAUDE.md`

**Interfaces (Produces):**
- `TaskType = "research"|"channel_kit"|"monthly_plan"|"storyboard"|"produce"|"insights"`
- Each task module exports `TaskDef<I,O> = { type; title(input): string; outputSchema: ZodType<O>; buildPrompt(input: I): string /* full markdown brief incl. output JSON shape */; apply(slug: string, input: I, output: O): Promise<void> /* writes into store */ }`. `lib/tasks/index.ts` exports `TASKS: Record<TaskType, TaskDef>`.
  - `research` input: `{ channel, ytData: Research["topVideos"] }`. The app gathers YouTube data first (Task 4). The agent or LLM writes `patterns`, `pillars`, and `summary`. In Agent mode with no Google connection, the agent may use web research and must say so in `summary`.
  - `monthly_plan` input: `{ channel, research, kit, month, pastStats? }`. Output is 20 `VideoPlan` items without ids. `apply` assigns ids (`<month>-w<week>-<n>`) and dates via `schedule.ts`. The prompt requires no repeated story structure within the month.
  - `storyboard` input: `{ channel, kit, video }`. Output is a `Storyboard` without approval. Scene count must fit `videoMinutes`, and the default visual sources are stock, archive, ai-image, or motion-graphics.
  - `produce` input: `{ channel, video, storyboard, openMontagePath, outputDir }`. Output is `{ videoPath, thumbnailPath, costUsd }`. The brief embeds the Global Constraints production fields verbatim.
  - `insights` input: `{ channel, stats, videos }`. Output is `{ winners: string[]; losers: string[]; guidance: string }`, saved as `insights.json` and fed into the next `monthly_plan`.
- `runTask(slug, type, input): Promise<{ mode: "done" } | { mode: "queued"; jobId: string }>` in `lib/ai/index.ts`. Agent mode calls `enqueueJob`. API mode calls the provider with `buildPrompt`, parses JSON, validates against `outputSchema`, then runs `apply`. The `produce` task is always queued, whatever the mode.
- `lib/ai/openai.ts` exports `completeJSON(prompt, model): Promise<unknown>` using a JSON response format. `lib/ai/anthropic.ts` exports the same signature, using the Messages API and asking for JSON only. Read the `claude-api` skill for the current SDK 1.x call shape and default model id.
- `lib/jobs.ts` exports:
  - `Job = { id; type; slug; title; createdAt; status: "pending"|"in_progress"|"done"|"failed"; input; brief: string; output?; error? }`
  - `enqueueJob(slug, type, input): Promise<Job>`, which writes `jobs/pending/<id>.json` and `<id>.md` (the brief).
  - `listJobs(): Promise<Job[]>`
  - `ingestDoneJobs(): Promise<{ applied: string[]; failed: {id, error}[] }>`, which reads `jobs/done/*.json`, validates `output` with the task schema, calls `apply`, and moves the file to `jobs/archive/`. On failure it rewrites the file with `status: "failed"` and the `error`, and leaves it in `jobs/done/`.
  - Jobs root is `process.env.STUDIO_JOBS_DIR ?? "jobs"`.
- `AGENTS.md` covers the job loop: read `jobs/pending/*.md`, do the work, write the same JSON with `status:"done"` and `output` to `jobs/done/<id>.json`, and delete the pending files. It has a per-type how-to. For `produce` it says: cd to `openMontagePath`, follow its AGENTS.md, use the documentary-montage pipeline, record `approval_policy` as pre-approved, never alter script or scene order, and render to `outputDir`. Rules: never post anything; never use copyrighted clips or screenshots.

- [ ] **Step 1: Failing tests:** `jobs.test.ts` uses tmp dirs. It checks that `enqueueJob` writes both `.json` and `.md`; that a valid done file is ingested and applied (a `monthly_plan` produces 20 videos dated Mon–Fri); that a done file with `{output:{bad:1}}` comes back as `failed` with the file still present and nothing thrown (Review Focus 1); and that a done file containing non-JSON text is reported failed, not thrown. `tasks.test.ts` checks that each `buildPrompt` contains the output JSON shape and the channel niche, and that the `produce` brief contains `pre-approved-by-weekly-checkin` and `script-and-scene-order-are-final`.
- [ ] **Step 2:** `npm test` should FAIL.
- [ ] **Step 3:** Implement the task modules, jobs, and providers. Write AGENTS.md, plus a CLAUDE.md containing `@AGENTS.md`.
- [ ] **Step 4:** `npm test` should PASS.
- [ ] **Step 5:** Commit with the message `feat: task system, agent job queue, api providers`.

### Task 4: YouTube (OAuth, research data, quota)

**Files:** `lib/youtube/{oauth,client,research,quota}.ts`, `app/api/google/{auth,callback}/route.ts`, `tests/quota.test.ts`

**Interfaces (Produces):**
- `QUOTA_COST = { search: 100, videosList: 1, channelsList: 1, insert: 1600, thumbnailSet: 50, videosUpdate: 50 }` and `DAILY_QUOTA = 10000`
- `chargeQuota(op, count=1): Promise<void>`, which resets when the Pacific-time date changes. `remainingQuota(): Promise<number>`. `assertQuota(op, count): Promise<void>` throws `QuotaError` if there isn't enough left.
- `getAuthUrl(): string` uses scopes `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`, `access_type=offline`, `prompt=consent`, and redirect `http://localhost:3000/api/google/callback`. `handleCallback(code)` saves tokens and the channel id and title.
- `withYouTube<T>(fn: (yt, analytics) => Promise<T>): Promise<T>` refreshes once on a 401 and converts Google errors to `YouTubeError(message, reason)`, mapping `quotaExceeded`, `forbidden`, and `uploadLimitExceeded` to plain-English messages.
- `researchNiche(queries: string[], perQuery=10): Promise<Research["topVideos"]>` uses search.list (`type=video`, `order=viewCount`, `publishedAfter` = 12 months ago, `videoDuration=medium|long`), then videos.list, then channels.list for subscriber counts. Results are cached in `data/cache/research-<hash>.json` for 7 days. It charges quota only after a successful call.

- [ ] **Step 1: Failing tests:** `quota.test.ts` checks that charging 3 searches and 1 insert gives `remainingQuota()===7100`; that the counter resets on a new Pacific date (inject a clock); that `assertQuota("insert", 7)` with 10000 remaining throws `QuotaError`; and that a failed call is not charged, by checking that `withYouTube` charging happens after success (unit-test via a fake fn that throws). That last check is Review Focus 4.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5:** Commit with the message `feat: youtube oauth, research, quota`.

### Task 5: Niche Finder, research, Channel Kit screens

**Files:** `lib/presets.ts`, `app/channels/new/page.tsx`, `app/channels/[slug]/page.tsx`, `app/channels/[slug]/kit/page.tsx`, `app/jobs/page.tsx`, `app/settings/page.tsx`, `app/channels/actions.ts`, `components/*`

**Interfaces:**
- `PRESETS: { id; label; niche; style; audience; exampleQueries: string[]; note?: string }[]` with the entries `business-stories`, `history-docs`, `tech-explainers`, `anime-what-if` (note: "Low RPM (~$2–4) and copyright-sensitive: AI-generated visuals only"), and `true-story-motivation`.
- Server actions:
  - `createChannel(form)`
  - `startResearch(slug)`, which calls `researchNiche` if Google is connected and otherwise passes empty data, then `runTask("research")`
  - `startChannelKit(slug)`
  - `chooseName(slug, name)`
  - `syncJobs()`, which runs `ingestDoneJobs` and revalidates
  - `saveSettingsAction(form)`
- When a task is queued, the UI shows a "Waiting for your agent" card with the `agentCommand` and a copy button, plus a "Check for results" button (`syncJobs`).
- Settings page sections: AI brain (agent/openai/anthropic with key and model fields), Google (client id/secret, Connect button, connected channel, an "audited" toggle explaining private-lock), OpenMontage path (validated by checking that `AGENTS.md` exists there), ffmpeg path, and agent command. Keys are shown masked.

- [ ] **Step 1:** Build the pages. Every page reads settings and shows a setup card when a dependency is missing (Review Focus 2).
- [ ] **Step 2:** Verify by running `npm run dev`. Create a channel from the business-stories preset → Research → the job file appears in `jobs/pending/`. Settings save and reload.
- [ ] **Step 3:** Commit with the message `feat: niche finder, research, channel kit, settings, jobs inbox`.

### Task 6: Monthly plan, storyboard, weekly check-in

**Files:** `lib/schedule.ts`, `lib/checkin.ts`, `app/channels/[slug]/plan/page.tsx`, `app/channels/[slug]/videos/[id]/page.tsx`, `app/channels/[slug]/checkin/page.tsx`, `tests/schedule.test.ts`, `tests/checkin.test.ts`

**Interfaces (Produces):**
- `monthSlots(month: "YYYY-MM", days: number[], perWeek: number): { week: 1|2|3|4; date: string }[]` returns 20 slots for the first 4 full Mon-start weeks of the month, beginning on or after the 1st. `weekOf(date)`, and `publishAt(date, hourLocal=15, tz)` returns an ISO string.
- `storyboardHash(sb: Storyboard): string` is sha256 over the stable JSON of everything except `approval`.
- `approve(sb, checklist): Storyboard` throws if any checklist item is false.
- `isApproved(sb): boolean` is true only if `approval` exists and `approval.hash === storyboardHash(sb)`.
- `saveStoryboard` (store) clears `approval` and sets the video status back to `storyboarded` when the hash changes (Review Focus 3).
- Plan page: a 4-week × 5-day grid of cards showing working title, pillar, and status. It has a "Plan month" button (`runTask monthly_plan`, with insights included if present), plus swap/regenerate on each card.
- Storyboard page: editable title options, beats, and scene table. It has a "Generate storyboard" button and shows a Short segment picker.
- Check-in page: picks the next week with unapproved videos and shows 5 cards with the chosen title, hook, scene count, estimated minutes, and the 4-item checklist. Buttons are Approve, Edit, Regenerate, and Swap topic. An "Approve week" button only enables when all 5 are approved.

- [ ] **Step 1: Failing tests:** `schedule.test.ts` checks that `monthSlots("2026-11",[1,2,3,4,5],5)` returns 20 slots, the first being `2026-11-02`, with all of them on weekdays and none duplicated. `checkin.test.ts` checks that `approve` with a false checklist item throws; that an approved storyboard has `isApproved===true`; that changing `scenes[0].narration` makes `isApproved===false`; and that `saveStoryboard` on an edited approved storyboard sets the video status to `storyboarded`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5:** Verify in the browser: plan → storyboard → check-in flow on a fixture channel.
- [ ] **Step 6:** Commit with the message `feat: monthly plan, storyboards, weekly check-in`.

### Task 7: Produce, Shorts, publish, stats

**Files:** `lib/media/short.ts`, `lib/publish/kit.ts`, `lib/youtube/{upload,stats}.ts`, `app/channels/[slug]/stats/page.tsx`, video page produce/publish panel, `tests/short.test.ts`, `tests/kit.test.ts`

**Interfaces (Produces):**
- `produceVideo(slug, id)` requires `isApproved`. It sets `Production{status:"queued"}` and runs `runTask("produce")` with `outputDir = output/<slug>/<id>/`. The production status mirrors the job status, and on ingest the status becomes `rendered`.
- `shortArgs({ input, output, startSec, endSec, captionsSrt? }): string[]` builds ffmpeg args for a 1080×1920 output: a blurred, scaled background with the original fitted on top, `-ss/-to`, and libx264/aac. Captions are burned in when an SRT is given. `makeShort(slug, id)` computes start and end from the storyboard scene durations and spawns `settings.ffmpegPath` with those args.
- `renderDescription(kit, sb, video): string` fills the footer `{sources}`, `{topic_tag}`.
- `buildUploadKit(slug, id): Promise<string>` writes `output/<slug>/<id>/kit/` containing the video, short, thumbnail, and `upload.txt` (title, description, tags, category, publish date, AI-disclosure yes/no, and Studio steps). It returns the folder path.
- `uploadVideo(slug, id)` is API mode only. It runs `assertQuota("insert")`, then videos.insert with status `private` and `publishAt` (if audited), sets `containsSyntheticMedia` from `aiDisclosure`, then calls thumbnails.set.
- `linkPublished(slug, id, url)` parses a youtu.be or watch URL to get the id.
- `fetchStats(slug)` runs videos.list statistics for published videos, plus Analytics `averageViewDuration` when available, and saves Stats. `runInsights(slug)` runs `runTask("insights")`.
- Stats page: a table of views, likes, and average view duration per video, plus an insights card.

- [ ] **Step 1: Failing tests:** `short.test.ts` checks that the input path `E:\Projects\MTS business\a b.mp4` appears as exactly one array element (Review Focus 5), that the args contain `-ss 120` and `-to 175` for scenes summing to those values, and that the output resolution string contains `1080:1920`. `kit.test.ts` checks that `renderDescription` replaces `{sources}` with a newline-joined list and leaves no `{` placeholders, and that `buildUploadKit` writes `upload.txt` containing the chosen title and "Altered or synthetic content: Yes" when `aiDisclosure`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS.
- [ ] **Step 5:** Commit with the message `feat: production jobs, shorts, upload kit, api upload, stats loop`.

### Task 8: README and docs

**Files:** `README.md`, `docs/setup-google.md`, `docs/agent-mode.md`, `docs/openmontage.md`, `docs/architecture.md`, `docs/images/*.png`

- [ ] **Step 1:** README sections: hero (name, one-liner, demo channel link, screenshot), "What it does" (the 8 stages), how it works (a mermaid diagram), quick start, choosing your AI brain (agent vs API), Google setup (link to the doc), OpenMontage setup, the weekly workflow, costs per video, YouTube limits (private lock until audit, quota math), copyright and monetization guidance (inauthentic content policy, no anime screenshots by default, AI disclosure), niche presets with RPM ranges (with sources), FAQ, roadmap, and license note (MIT; OpenMontage is AGPL, installed separately).
- [ ] **Step 2:** Docs pages with exact click paths for Google Cloud: create project → enable YouTube Data API v3 + YouTube Analytics API → OAuth consent screen (External, add self as test user) → OAuth client (Web, redirect URI) → paste into Settings. Also cover how to apply for the audit.
- [ ] **Step 3:** Screenshots of each stage from the running app, using the Built & Broken data, saved to `docs/images/`.
- [ ] **Step 4:** Commit with the message `docs: readme and setup guides`.

### Task 9: Built & Broken run-through

- [ ] **Step 1:** Create the channel from the business-stories preset with `slug: built-and-broken` and import the channel kit from `examples/built-and-broken/channel-kit.md`.
- [ ] **Step 2:** Agent mode: research → monthly plan for 2026-11 (20 videos) → storyboards for week 1 (5). Process the jobs per AGENTS.md and ingest them in the app.
- [ ] **Step 3:** Human check-in of week 1. Dennis approves.
- [ ] **Step 4:** Install OpenMontage to a sibling folder and produce video 1 (free sources). Make the Short and build the upload kit.
- [ ] **Step 5:** Commit `data/channels/built-and-broken/` with the message `example: built & broken first month`. Render outputs stay ignored.

### Task 10: Publish the repo

- [ ] **Step 1:** Run `npm test` and `npm run build`. Both must pass.
- [ ] **Step 2:** Run a secret scan: `git grep -nE "sk-|AIza|ya29\.|client_secret"` must return nothing.
- [ ] **Step 3:** After confirming with Dennis, run `gh repo create dennis299/ai-youtube-studio --public --source . --push`, then add topics and a description.
