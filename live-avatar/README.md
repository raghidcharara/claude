# Live Avatar — talk to Claude, face to face

A hands-free voice conversation with Claude (Opus 5.5), presented as a realistic
human avatar whose lips, eyes, facial expression and head move in sync with
what it says.

- **No push-to-talk, no send button.** The mic listens continuously. When you
  stop talking, the app detects the end of your turn and sends it.
- **Natural English voice** (ElevenLabs), streamed sentence by sentence, so
  the avatar starts answering while Claude is still writing the rest.
- **Lip-sync from word timings.** Each sentence comes back from the TTS with
  per-word timestamps. [TalkingHead](https://github.com/met4citizen/TalkingHead)
  converts them to visemes (mouth shapes) that line up with the audio, and
  adds eye contact, blinking, micro head movement and breathing.
- **Facial expression follows the reply.** Claude tags each reply
  (`[happy]`, `[sad]`, `[love]`, `[neutral]`) and the face shifts to match.
  While it's thinking, the avatar glances away the way people do when recalling something.
- **Interrupt at any time.** Start talking while it's speaking and it stops
  and listens. Its own voice picked up by the mic is filtered out.
- **Current information:** Claude can run a web search when a question needs it.

## Setup

```bash
cd live-avatar
pip install -r requirements.txt
cp .env.example .env      # then fill in the keys
python server.py          # http://127.0.0.1:8000
```

You need:

| Key | Where |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com (or run `ant auth login` instead) |
| `ELEVENLABS_API_KEY` | elevenlabs.io → Profile → API keys |

Open http://127.0.0.1:8000 in **Chrome or Edge**. Click **Start conversation**
once. Browsers require one click before a page can use the mic and play
audio. From then on it's fully hands-free.

**Use headphones** for the smoothest conversation. The app filters echo on
speakers too, but headphones stop the avatar from hearing itself.

Controls (optional): **M** mutes the mic, **Esc** stops the avatar mid-sentence.

## How it works

```
 mic ─► Web Speech API (continuous, interim results)
          │ silence ≈ 0.9 s → end of turn
          ▼
 browser ── POST /api/chat ──► server.py ──► Claude Opus 5.5 (streaming)
          ◄── SSE text deltas ──┘
          │ split into sentences as they arrive
          ▼
 browser ── POST /api/tts (per sentence, in parallel) ──► ElevenLabs /with-timestamps
          ◄── MP3 + word timings ──┘
          ▼
 TalkingHead.speakAudio(audio, words, times) → visemes + eyes + head + mood
```

The API keys stay on the server. The browser keeps the conversation history
and sends it with each turn.

## Customising

All settings are in `.env`:

- **Voice:** `ELEVENLABS_VOICE_ID` takes any voice from your ElevenLabs library.
  Pick one that matches the avatar's gender and age.
- **Speed vs. depth:** `CLAUDE_EFFORT=low` (default) gives the fastest replies.
  `medium` or `high` think longer before speaking.
- **Personality / behaviour:** edit `system_prompt.md`.
- **Your own avatar face:** set `AVATAR_URL` to any GLB model with ARKit and
  Oculus-viseme blend shapes, and `AVATAR_BODY` to `M` or `F`. For a realistic
  person:
  - [Avaturn](https://avaturn.me): builds a realistic 3D avatar from a selfie.
    Export as a Type-2 GLB.
  - [Avatar SDK / MetaPerson](https://avatarsdk.com): photo-based, commercial.
  - The default `avatarsdk.glb` (male) and the alternative
    `https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars/avaturn.glb`
    (female, set `AVATAR_BODY=F`) are TalkingHead's example models, licensed for
    **non-commercial use only**. Use your own model for anything commercial.

## Limitations

- Needs Chrome, Edge or another browser with the Web Speech API. Firefox
  doesn't support it. Chrome sends the audio to Google's recognizer.
- The avatar is a high-quality real-time 3D human, not generated video.
  For photoreal video-style avatars, the renderer can be replaced with a
  streaming video-avatar service such as Simli, HeyGen or Tavus, which take the
  same TTS audio as input.
