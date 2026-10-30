# OpenMontage install

[OpenMontage](https://github.com/calesthio/openmontage) turns a script and scene plan into a
finished video: narration, stock and archive footage, AI images or clips, motion graphics,
captions, music and a Remotion render. The studio hands it approved storyboards.

OpenMontage is **AGPL-3.0**, so it isn't bundled with this MIT repo. Install it next to the studio:

```bash
git clone --depth 1 https://github.com/calesthio/openmontage.git OpenMontage
cd OpenMontage
python -m venv .venv
# Windows
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m pip install piper-tts      # free local text-to-speech
# macOS / Linux
# .venv/bin/python -m pip install -r requirements.txt && .venv/bin/python -m pip install piper-tts
cd remotion-composer && npm install
```

(Or use OpenMontage's own `make setup` on macOS/Linux.)

Then set **Settings → Production tools → OpenMontage folder** to the `OpenMontage` folder. The
studio checks for its `AGENTS.md`.

## Free-first configuration

Copy `.env.example` to `.env` inside OpenMontage and add free keys:

| Key | What it unlocks | Cost |
|---|---|---|
| `PEXELS_API_KEY` | Stock footage and images | Free (<https://www.pexels.com/api/>) |
| `PIXABAY_API_KEY` | More stock footage and music | Free (<https://pixabay.com/api/docs/>) |
| `UNSPLASH_ACCESS_KEY` | Stock photos | Free |
| *(none)* | Piper local TTS narration | Free |

With only these, a documentary-style business video costs **$0** in provider fees.

## Optional paid upgrades

| Key | Upgrade |
|---|---|
| `ELEVENLABS_API_KEY` | More natural narration voices |
| `FAL_KEY` | AI images and video clips (Flux, Kling, …) |
| `GOOGLE_API_KEY` | Google TTS, Imagen, Veo |
| `OPENAI_API_KEY` | OpenAI TTS and images |

Each channel has a **budget per video** (default $5) on its Channel kit page. Production jobs tell
the agent to stop and report rather than exceed it.

## Pipeline

Channels use OpenMontage's `documentary-montage` pipeline by default, which suits narrated
stories over real footage. It's stored per channel (`pipeline` in `data/channels/<slug>/channel.json`),
so you can switch to `animated-explainer`, `animation` (good for the anime preset), or any other
OpenMontage pipeline.
