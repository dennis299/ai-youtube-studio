# Agent mode

In Agent mode the studio does **no AI calls itself**. It writes each task to a file, and a coding
agent you already use does the work: Claude Code, OpenAI Codex, Cursor, GitHub Copilot, Windsurf,
or anything else that can read and write files. You don't need an API key.

## The loop

```
studio ──writes──▶ jobs/pending/<id>.md     (the brief: task, context, rules, JSON schema)
                   jobs/pending/<id>.json   (the raw input)
agent  ──reads brief, does the work──▶ jobs/done/<id>.json   (same job + "status": "done" + "output")
studio ──validates with zod, applies, archives──▶ jobs/archive/<id>.json
```

1. Click a button that needs AI (Research, Generate channel kit, Plan month, Write storyboards,
   Produce, Learn from these stats). The page shows **Waiting for your AI agent**.
2. In a terminal in the studio folder, run your agent. With Claude Code:

   ```bash
   claude -p "Process all pending jobs in jobs/pending following AGENTS.md"
   ```

   Or open the folder in your agent's chat and say *"process pending jobs"*.
3. Click **Check for results**. The studio validates each result against the schema. A bad
   result shows up as a failed job on the **Agent jobs** page with the exact validation error,
   and you can **Retry** it.

You can change the command shown on the waiting cards in **Settings → Agent command**.

## Helper for agents

Agents don't need to hand-edit job JSON:

```bash
npm run job:complete -- <jobId> path/to/output.json
npm run job:complete -- <jobId> --fail "OpenMontage needs a PEXELS_API_KEY"
```

## What the agent is told

[`AGENTS.md`](../AGENTS.md) at the repo root covers the loop, per-job-type notes, and hard rules:
never publish anything, never use copyrighted clips or screenshots, and no fake AI experts.
`CLAUDE.md` just imports it, so Claude Code picks it up automatically.

## Production jobs

`produce` jobs always go through an agent, even in API mode, because OpenMontage is an agentic
toolkit. The brief tells the agent to:

- `cd` into your OpenMontage folder and follow its own `AGENTS.md`
- record `approval_policy: pre-approved-by-weekly-checkin` at every OpenMontage checkpoint,
  because you already approved the storyboard
- use the narration **word for word and in scene order**, and choose only how to source each scene's visuals
- stay under the channel's budget and prefer free sources
- write the MP4, thumbnail and SRT into `output/<channel>/<video>/` and report the paths

Rendering takes a while. Leave your agent running and check back.
