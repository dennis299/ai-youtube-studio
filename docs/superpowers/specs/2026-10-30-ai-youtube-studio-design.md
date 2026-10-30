# AI YouTube Studio — Design

Date: 2026-10-30 · Owner: Dennis (GitHub `dennis299`) · Status: draft for approval

## Intent

A local web app that runs a faceless YouTube channel from start to finish:
pick a niche → research what performs → brand the channel → plan a month of
videos → storyboard each one → weekly human check-in → produce the video with
OpenMontage → publish to YouTube → learn from the stats.

Why it exists:
1. **Dennis's weekly GitHub project** (week of 2026-10-30). It must be finished
   in one day and look impressive as a public repo.
2. **A real channel runs on it.** Dennis's existing channel (currently "Velof
   Voices", never posted on) is rebranded to a business-stories channel and is
   the live example linked from the README.
3. **Anyone can clone it** and plug in their own AI and their own Google
   project.

Target output: 5 long-form videos per week (20 per month), plus a Short cut
from each.

## Goals

- End-to-end flow in one app, with a clear screen for each stage:
  1. **Niche Finder**: user names a niche and style (e.g. "business rise and
     fall stories", "anime what-if stories"). The AI researches top-performing
     videos in that niche via the YouTube Data API: titles, views, view/sub
     ratio, length, upload cadence, recurring angles. Output is a short research
     report plus suggested content pillars.
  2. **Channel Kit**: channel name options, description, keywords, a logo
     prompt or brief, a banner brief, and an upload defaults template (tags,
     category, description footer). Saved per channel.
  3. **Monthly Plan**: 20 video topics laid out on a 4-week calendar (5 per
     week, default Mon–Fri), each with a working title, angle, and why it should
     perform (tied to the research).
  4. **Storyboard**: per video, a full script (hook, beats, outro/CTA), a
     scene-by-scene storyboard (narration line, visual description, visual
     source type, duration), 3 title options, 2–3 thumbnail concepts, and a
     Short cut-down plan (which 30–60s segment, vertical).
  5. **Weekly Check-in**: one screen showing next week's 5 videos. The user
     approves, edits, regenerates, or swaps each. A short checklist must be
     ticked per video before it can be produced (original angle/not generic;
     visuals are AI-generated, stock, or licensed; AI disclosure set if
     realistic synthetic media; facts checked).
  6. **Produce**: approved storyboards become OpenMontage production briefs.
     The app tracks status (queued → rendering → rendered → failed) and the
     output file paths for the long video, the Short, and the thumbnail.
  7. **Publish**: upload to YouTube with title, description, tags, thumbnail,
     and scheduled publish time (`status.publishAt`) so YouTube itself
     releases it. No need for the app to stay running.
  8. **Stats loop**: pull views, CTR, and average view duration for published
     videos, show them on a dashboard, and feed the winners and losers into the
     next month's planning prompt.
- **Two AI modes**, chosen in Settings:
  - **Agent mode** (how Dennis runs it): the app writes job files (JSON +
    markdown brief) into `jobs/pending/`. A coding agent (Claude Code, Codex,
    Cursor, …) working in the repo picks them up, does the work, and writes
    results to `jobs/done/`. The app reads results back in. The repo ships an
    `AGENTS.md`/`CLAUDE.md` that tells any agent exactly how to process each job
    type. No AI API key needed.
  - **API mode**: the user pastes an OpenAI or Anthropic key. Text steps
    (research analysis, channel kit, plan, storyboard) run directly from the
    app. Rendering still needs OpenMontage, which is agent-driven, so the
    Produce step in API mode writes the same production job file and tells the
    user to run their agent on it.
- **Bring-your-own Google**: each user creates their own Google Cloud project,
  enables YouTube Data API v3 (and YouTube Analytics API), creates an OAuth
  client, and pastes the client ID/secret into Settings, then clicks "Connect
  channel". Tokens are stored locally only.
- **README is a first-class deliverable**: what it is, demo channel link,
  screenshots, architecture diagram, step-by-step setup (Node, OpenMontage
  install, Google Cloud setup with exact clicks, AI mode setup), costs per
  video, YouTube limits, copyright guidance, FAQ, roadmap, license.

## Non-goals

- Hosting or multi-user accounts. It runs on localhost for one person.
- Building our own renderer or editor. OpenMontage does production.
- Platforms other than YouTube (TikTok/Reels are roadmap only).
- Payments, teams, or a SaaS wrapper.

## Anti-goals (failure even if it "works")

- Posting anything that skipped the weekly check-in.
- Using copyrighted footage or screenshots by default. Default visuals are
  AI-generated, stock, or open-archive. User-supplied images are allowed only
  with a visible copyright warning.
- Templated, samey videos that trip YouTube's "inauthentic content"
  demonetization rules (July 2025, tightened July 2026). Every video needs a
  real story or angle; the planner must avoid repeating structures across a
  month.
- AI "expert" personas giving finance, health, or legal advice.
- Committing secrets: API keys, OAuth tokens, `.env`, or the local database.

## Constraints

- One-day build. Scope must favour a working end-to-end path over polish on
  every screen.
- Windows 11 dev machine; Node 24, Python 3.13, ffmpeg, and `gh` are available.
  Must also work on macOS/Linux.
- **OpenMontage is AGPL-3.0.** It is not copied or vendored into this repo.
  Users install it separately and set its path in Settings. This repo is
  **MIT**.
- **YouTube API limits** (must be in the README):
  - Unverified Google Cloud projects can only upload **private** videos until
    the project passes Google's API audit. The Publish step therefore supports
    "upload private, then I'll make it public" with a one-click "Make public"
    action, and documents how to apply for the audit.
  - Default quota is 10,000 units/day; an upload is about 1,600 units and a
    search is 100. Research must cache results and stay under budget, and the
    app shows estimated quota use.
- Channel creation, Google sign-in, and Google Cloud console steps are done by
  the human. The app never handles Google passwords.

## Decided

- **Stack** (Claude's call, Dennis didn't object): Next.js (App Router,
  TypeScript), Tailwind + shadcn/ui, SQLite via a light ORM, `googleapis` for
  YouTube, and the official OpenAI/Anthropic SDKs for API mode. Runs with
  `npm run dev` on localhost.
- **Example channel niche: business stories** (company rise-and-fall, founder
  bets, brand origin stories). This was chosen from research (education and
  business sit around $6–15 RPM; anime is about $2–4 and carries copyright
  risk). Anime "what-if" stories ship as a niche preset, not the example.
- **Example channel is Dennis's existing channel** ("Velof Voices"), renamed
  to **Built & Broken** (Dennis's pick) and rebranded.
  Name, logo (made in Canva), banner, and description are produced in the
  Channel Kit step and committed under `examples/<channel-slug>/`.
- **Extras Dennis approved**: a Short from every video, title and thumbnail
  options, and the stats feedback loop.
- **Weekly check-in** is the single human gate.
- Repo is public on GitHub under `dennis299`, named `ai-youtube-studio`
  (Claude's call).

## Claude's calls (from the builder check)

- **OpenMontage runs without stopping for approval.** OpenMontage's documentary pipeline normally stops for human
  approval at idea, scene plan, assets, and edit. The weekly check-in is our
  one gate, so each production job records a pre-approved `approval_policy`.
  The approved storyboard is **binding**: OpenMontage must use its script and
  scene order as written. It may only choose how to source or generate each
  scene's visuals. The job also fixes the composition engine (Remotion), so the
  agent never has to ask. Status is tracked by reading OpenMontage's project
  checkpoint files.
- **Agent-mode jobs** are processed in this repo. The agent instructions
  file tells the agent to `cd` into the configured OpenMontage folder for
  production jobs and follow its rules there. The user starts the agent by
  hand for each batch, and the app shows the exact command to copy (e.g.
  `claude -p "process pending jobs"`). A one-click "Run agent" button is a
  stretch goal.
- **Publishing has two paths**, because API uploads from an unaudited Google
  project are locked private and can't be made public:
  - **Studio upload kit** (default until the project passes Google's audit):
    the app packages the video, Short, thumbnail, and copy-paste title,
    description, and tags. It opens YouTube Studio, the user uploads and
    schedules there, then pastes the video URL back so stats tracking works.
  - **API upload** with `publishAt` scheduling, for audited projects.

  The README walks through applying for the audit.
- **Shorts** are cut by the app with ffmpeg from the long render, using the
  storyboard's chosen segment, reframed to 9:16 (blurred background fill, with
  captions burned in).
- **Thumbnails** are generated as part of the production job using
  OpenMontage's image tools, from the chosen thumbnail concept. Canva stays a
  manual option. The README notes that custom thumbnails need a
  phone-verified channel.

- **Video length and budget** (default, Dennis can override): long videos run 8–10 minutes, because
  mid-roll ads start at 8 minutes. The budget is at most $5 per video, and the
  app shows an estimate before production. The first video uses free sources
  only: OpenMontage's `documentary-montage` pipeline with free stock or archive
  footage, plus free/local TTS. Paid providers such as ElevenLabs or fal.ai are
  optional upgrades set in OpenMontage's `.env`.

## Done for this week

1. App runs locally and every stage (1–8) works at least in Agent mode.
2. The example channel is rebranded (name, logo, banner, description live on
   YouTube).
3. The example channel's first month (20 topics) is planned in the app, and
   the first week's storyboards have passed check-in.
4. At least one video has been produced with OpenMontage and published to the
   example channel, through the Studio upload kit or the API.
5. The public GitHub repo has the README, screenshots, MIT license, `.env.example`,
   and agent instructions.

## Left to the builder

- Exact screen layouts and component choices.
- Database schema and job-file schema details.
- Prompt wording for each AI step.
- How the stats loop weights past performance.
- Test strategy (keep it light: job-file parsing, quota math, scheduling).
