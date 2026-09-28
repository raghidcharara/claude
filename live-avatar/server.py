#!/usr/bin/env python3
"""Live Avatar - a hands-free, voice-to-voice Claude assistant with a
lip-synced, realistic 3D face.

The browser does the listening (continuous speech recognition with automatic
end-of-turn detection) and the rendering (TalkingHead avatar). This server
keeps the API keys private and does two jobs:

  POST /api/chat  Streams Claude's reply as Server-Sent Events, text only,
                  so the browser can start speaking the first sentence
                  while the rest is still being generated.
  POST /api/tts   Turns one sentence into speech with ElevenLabs and returns
                  the audio plus per-word timings, which drive the avatar's
                  lip-sync (visemes), eye contact and head motion.
"""

import base64
import json
import os
from pathlib import Path

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
# Voice conversations are latency-sensitive: "low" keeps thinking short so the
# avatar starts talking quickly. Raise to "medium"/"high" for harder questions.
EFFORT = os.getenv("CLAUDE_EFFORT", "low")
MAX_TOKENS = int(os.getenv("CLAUDE_MAX_TOKENS", "16000"))
ENABLE_WEB_SEARCH = os.getenv("ENABLE_WEB_SEARCH", "true").lower() == "true"
MAX_PAUSE_CONTINUATIONS = 3

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")  # "George"
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")

AVATAR_CONFIG = {
    "url": os.getenv(
        "AVATAR_URL",
        "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/avatars/avatarsdk.glb",
    ),
    "body": os.getenv("AVATAR_BODY", "M"),
    "name": os.getenv("AVATAR_NAME", "Claude"),
}

SYSTEM_PROMPT = (BASE_DIR / "system_prompt.md").read_text()

WEB_SEARCH_TOOL = {"type": "web_search_20260209", "name": "web_search", "max_uses": 3}

client = anthropic.AsyncAnthropic()
http = httpx.AsyncClient(timeout=30.0)
app = FastAPI(title="Live Avatar")


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def clean_history(messages: list[ChatMessage]) -> list[dict]:
    """Drop empty turns and merge same-role neighbours so the history always
    alternates and ends on a user turn (barge-ins can leave gaps)."""
    history: list[dict] = []
    for m in messages:
        text = m.content.strip()
        if not text:
            continue
        if history and history[-1]["role"] == m.role:
            history[-1]["content"] += "\n" + text
        else:
            history.append({"role": m.role, "content": text})
    while history and history[0]["role"] != "user":
        history.pop(0)
    if not history or history[-1]["role"] != "user":
        raise HTTPException(400, "Conversation must end with a user message.")
    return history


async def stream_claude(history: list[dict]):
    messages = list(history)
    request = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "output_config": {"effort": EFFORT},
        "cache_control": {"type": "ephemeral"},
    }
    if ENABLE_WEB_SEARCH:
        request["tools"] = [WEB_SEARCH_TOOL]

    try:
        for _ in range(MAX_PAUSE_CONTINUATIONS + 1):
            async with client.messages.stream(messages=messages, **request) as stream:
                async for event in stream:
                    if event.type == "text":
                        yield sse("delta", {"text": event.text})
                    elif (
                        event.type == "content_block_start"
                        and event.content_block.type == "server_tool_use"
                    ):
                        yield sse("status", {"state": "searching"})
                final = await stream.get_final_message()

            if final.stop_reason == "pause_turn":
                # Long server-tool turn: hand the partial turn back to continue it.
                messages = history + [{"role": "assistant", "content": final.content}]
                continue
            if final.stop_reason == "refusal":
                yield sse("delta", {"text": "I'm sorry, but I can't help with that one."})
            break
        yield sse("done", {})
    except anthropic.RateLimitError:
        yield sse("error", {"message": "I'm getting a lot of requests right now. Please try again in a moment."})
    except anthropic.APIStatusError as e:
        yield sse("error", {"message": f"Claude API error ({e.status_code}): {e.message}"})
    except anthropic.APIConnectionError:
        yield sse("error", {"message": "I couldn't reach Claude. Please check the network connection."})


@app.post("/api/chat")
async def chat(req: ChatRequest):
    history = clean_history(req.messages)
    return StreamingResponse(
        stream_claude(history),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def alignment_to_words(alignment: dict) -> dict:
    """Convert ElevenLabs character timings into the word timings (ms) that
    TalkingHead uses to generate visemes."""
    words, wtimes, wdurations = [], [], []
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])
    current, start, end = "", 0.0, 0.0
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if current:
                words.append(current)
                wtimes.append(round(start * 1000))
                wdurations.append(max(1, round((end - start) * 1000)))
                current = ""
            continue
        if not current:
            start = s
        current += ch
        end = e
    if current:
        words.append(current)
        wtimes.append(round(start * 1000))
        wdurations.append(max(1, round((end - start) * 1000)))
    return {"words": words, "wtimes": wtimes, "wdurations": wdurations}


@app.post("/api/tts")
async def tts(req: TTSRequest):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(503, "ELEVENLABS_API_KEY is not set on the server.")
    resp = await http.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}/with-timestamps",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
        json={
            "text": req.text,
            "model_id": ELEVENLABS_MODEL_ID,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15},
        },
    )
    if resp.status_code != 200:
        raise HTTPException(502, f"ElevenLabs error {resp.status_code}: {resp.text[:300]}")
    body = resp.json()
    alignment = body.get("normalized_alignment") or body.get("alignment") or {}
    # Validate the payload decodes before handing it to the browser.
    base64.b64decode(body["audio_base64"], validate=True)
    return JSONResponse({"audio_base64": body["audio_base64"], **alignment_to_words(alignment)})


@app.get("/api/config")
async def config():
    return {
        "avatar": AVATAR_CONFIG,
        "tts_ready": bool(ELEVENLABS_API_KEY),
        "model": MODEL,
    }


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")))
