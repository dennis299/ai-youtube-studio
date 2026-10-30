# AGENTS.md: AI YouTube Studio

This file is for **coding agents** (Claude Code, Codex, Cursor, Copilot, Windsurf, …)
running in this repo. In **Agent mode** the studio app does no AI work itself: it
writes jobs to `jobs/pending/` and you process them.

## The job loop

When asked to "process pending jobs":

1. List `jobs/pending/*.json`. Each job has a sibling `<id>.md`, which is the full brief:
   the task, the channel context, the rules, and the **exact output JSON schema**.
2. Take jobs oldest-first. For each one:
   1. Set `"status": "in_progress"` in `jobs/pending/<id>.json` so the app shows it.
   2. Read `<id>.md` and do the work. `input` in the JSON has the raw data behind the brief.
   3. Write `jobs/done/<id>.json`. It is the same object with `"status": "done"` and your
      result under `"output"`. The output **must** validate against the schema in the brief.
   4. Delete `jobs/pending/<id>.json` and `jobs/pending/<id>.md`.
   5. If you cannot finish, write `jobs/done/<id>.json` with `"status": "failed"` and an
      `"error"` that says what the human needs to fix.
3. Tell the user to click **Check for results** in the app (or the app picks results up on
   the next page load). The app validates your output, and invalid output is shown as a
   failed job with the validation error, so they can ask you to redo it.

Never edit `data/` directly to "help": always go through job results, so validation runs.

## Per job type

| type | what you do | notes |
|---|---|---|
| `research` | Analyse the attached top-video data (or do web research if none) and write patterns, pillars, and a summary | Be honest about evidence quality. |
| `channel_kit` | Name options, handle, description, keywords, pillars, logo/banner briefs, upload defaults | The footer needs `{sources}` and `{topic_tag}` placeholders. |
| `monthly_plan` | Exactly `cadence.perWeek × 4` video ideas in publish order | Vary structures. Don't repeat formulas back to back. |
| `storyboard` | Full script split into timed scenes, titles, thumbnails, Short segment, sources | Scene seconds must sum into the channel's minute range (≈150 spoken words per minute). |
| `produce` | Render the video with **OpenMontage** | See below. |
| `insights` | Winners, losers, and guidance from published stats | Keep it light with under 5 videos. |

### `produce` jobs (OpenMontage)

- `cd` into `input.openMontagePath` and follow **that** repo's `AGENTS.md` / `AGENT_GUIDE.md`.
- The human already approved this storyboard at the weekly check-in. Record
  `approval_policy: "pre-approved-by-weekly-checkin"` at every OpenMontage checkpoint and keep going.
- The narration is final: use it word for word, in scene order. You choose only how to source
  each scene's visual within its stated `source` type.
- Composer: Remotion. Resolution: 1920×1080. Stay under `channel.budgetPerVideoUsd`, and prefer
  free stock/archive footage and free TTS.
- Put the MP4, a 1280×720 thumbnail, and an SRT in `input.outputDir`, then report absolute paths and cost.

## Hard rules

- **Never upload, publish, or post anything.** The human does that from the app after check-in.
- **No copyrighted footage, film/TV/anime screenshots, or commercial music.** Use stock,
  public-domain archive, AI-generated visuals, or motion graphics.
- No AI "expert" personas for finance, health, legal, or political advice.
- Never commit `data/settings.json`, `jobs/`, `output/`, or any API key or token.

## Working on the app itself

Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui. State is JSON under `data/`
(see `lib/store.ts`). AI steps live in `lib/tasks/*`. Run `npm test` (vitest) and `npm run build`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
