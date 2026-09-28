import { TalkingHead } from "talkinghead";

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
const ENDPOINT_AFTER_FINAL_MS = 900;    // silence after a final phrase = user is done
const ENDPOINT_AFTER_INTERIM_MS = 1800; // fallback when no final result arrives
const BARGE_IN_MIN_WORDS = 2;           // words needed to interrupt the avatar
const ECHO_OVERLAP = 0.6;               // share of words heard that the avatar just said
const TTS_CONCURRENCY = 3;

// Framing/rig presets for the realistic example avatars shipped with TalkingHead.
const AVATAR_PRESETS = {
  "avatarsdk.glb": {
    retarget: {
      Neck: { z: -0.01, rx: -0.15 }, Neck1: { z: -0.01, rx: -0.15 }, Neck2: { z: -0.01, rx: -0.15 },
      LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 },
      scaleToEyesLevel: 1.0, origin: { y: -0.1 },
    },
    baseline: { headRotateX: -0.04, eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 },
  },
  "avaturn.glb": {
    retarget: {
      Hips: { y: 0.03 }, Spine: { y: 0.02 }, Spine1: { y: 0.02, z: 0.01 },
      Spine2: { y: 0.02, z: 0.01 }, Neck: { z: 0.02, y: 0.01 }, Head: { z: 0.02 },
      LeftShoulder: { rx: -0.5 }, RightShoulder: { rx: -0.5 },
      scaleToHipsLevel: 1.0,
    },
    baseline: { headRotateX: -0.05, eyeBlinkLeft: 0.15, eyeBlinkRight: 0.15 },
  },
};

const MOODS = new Set(["neutral", "happy", "sad", "love"]);

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  avatar: $("avatar"), loading: $("loading"), loadingText: $("loading-text"),
  start: $("start"), btnStart: $("btn-start"), startError: $("start-error"),
  status: $("status"), statusText: $("status-text"), micRing: $("mic-ring"),
  captionUser: $("caption-user"), captionAssistant: $("caption-assistant"),
  btnMute: $("btn-mute"), btnStop: $("btn-stop"), name: $("avatar-name"),
};

const PHASE_LABEL = { idle: "Ready", listening: "Listening", thinking: "Thinking", speaking: "Speaking", muted: "Muted" };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let head;
let recognition;
let phase = "idle";
let muted = false;
let running = false;

const history = [];       // [{role, content}] plain text, as spoken
let turn = null;          // the assistant turn currently in flight
let turnSeq = 0;

let heardFinal = "";      // finalized words of the user's current utterance
let heardInterim = "";
let endpointTimer = null;
let recentSpeech = { text: "", until: 0 }; // avatar's last words, for echo filtering
const ECHO_TAIL_MS = 2500;

function setPhase(p) {
  phase = muted && p === "listening" ? "muted" : p;
  ui.status.dataset.phase = phase;
  ui.statusText.textContent = PHASE_LABEL[phase];
  ui.btnStop.hidden = !(phase === "thinking" || phase === "speaking");
}

function showError(msg) {
  ui.startError.textContent = msg;
  ui.startError.hidden = false;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
async function loadAvatar(cfg) {
  head = new TalkingHead(ui.avatar, {
    ttsEndpoint: null,
    lipsyncModules: ["en"],
    lipsyncLang: "en",
    cameraView: "upper",
    cameraRotateEnable: false,
    modelFPS: 60,
    modelPixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    avatarIdleEyeContact: 0.4,
    avatarIdleHeadMove: 0.4,
    avatarSpeakingEyeContact: 0.75,
    avatarSpeakingHeadMove: 0.55,
    mixerGainSpeech: 3,
    lightAmbientIntensity: 2,
    lightDirectIntensity: 25,
  });

  const file = cfg.url.split("/").pop().split("?")[0];
  const preset = AVATAR_PRESETS[file] || {};
  await head.showAvatar(
    {
      url: cfg.url,
      body: cfg.body,
      avatarMood: "neutral",
      lipsyncLang: "en",
      avatarListeningEyeContact: 0.85,
      ...preset,
    },
    (ev) => {
      if (ev.lengthComputable) {
        ui.loadingText.textContent = `Loading avatar… ${Math.round((ev.loaded / ev.total) * 100)}%`;
      }
    },
  );
}

// "Thinking" look: glance up and to the side, as people do while recalling.
function thinkingGlance() {
  head?.lookAt(window.innerWidth * 0.62, window.innerHeight * 0.18, 1200);
}

// ---------------------------------------------------------------------------
// Speech output: Claude text -> sentences -> ElevenLabs -> lip-synced audio
// ---------------------------------------------------------------------------
function cleanForSpeech(text) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`~>|]/g, "")
    .replace(/\[(?:[^\]]*)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Split streamed text into speakable chunks. The first chunk is kept short so
// the avatar starts talking as soon as possible.
function takeChunks(t, force) {
  const chunks = [];
  const sentenceEnd = /[.!?…]+["')\]]?\s+/g;
  let m;
  let from = 0;
  while ((m = sentenceEnd.exec(t.buffer)) !== null) {
    const end = m.index + m[0].length;
    if (end - from < 12 && !t.spokeAny) continue; // avoid one-word fragments like "Sure."
    chunks.push(t.buffer.slice(from, end));
    from = end;
    t.spokeAny = true;
  }
  t.buffer = t.buffer.slice(from);

  if (!t.spokeAny && t.buffer.length > 90) {
    const clause = t.buffer.slice(0, 160).search(/[,;:—–]\s(?=[^,;:—–]*$)/);
    if (clause > 30) {
      chunks.push(t.buffer.slice(0, clause + 1));
      t.buffer = t.buffer.slice(clause + 2);
      t.spokeAny = true;
    }
  }
  if (t.buffer.length > 260) {
    const space = t.buffer.lastIndexOf(" ", 240);
    const cut = space > 0 ? space : 240;
    chunks.push(t.buffer.slice(0, cut));
    t.buffer = t.buffer.slice(cut + 1);
  }
  if (force && t.buffer.trim()) {
    chunks.push(t.buffer);
    t.buffer = "";
  }
  return chunks.map(cleanForSpeech).filter(Boolean);
}

let ttsActive = 0;
const ttsWaiters = [];
async function withTtsSlot(fn) {
  if (ttsActive >= TTS_CONCURRENCY) await new Promise((r) => ttsWaiters.push(r));
  ttsActive++;
  try { return await fn(); } finally {
    ttsActive--;
    ttsWaiters.shift()?.();
  }
}

async function synthesize(text, signal) {
  return withTtsSlot(async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) throw new Error(`TTS failed: ${await res.text()}`);
    const data = await res.json();
    const bytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
    const audio = await head.audioCtx.decodeAudioData(bytes.buffer);
    return { audio, words: data.words, wtimes: data.wtimes, wdurations: data.wdurations };
  });
}

// Queue a chunk: synthesis starts immediately (in parallel), playback stays in order.
function speak(t, text) {
  t.queued.push(text);
  const pending = synthesize(text, t.abort.signal);
  pending.catch(() => {}); // surfaced below, in order
  t.chain = t.chain.then(async () => {
    if (t.cancelled) return;
    let clip;
    try { clip = await pending; } catch (err) {
      if (!t.cancelled) console.error(err);
      return;
    }
    if (t.cancelled) return;
    head.speakMarker(() => {
      if (t.cancelled) return;
      t.spoken.push(text);
      if (phase !== "speaking") setPhase("speaking");
      ui.captionAssistant.textContent = "";
    });
    head.speakAudio(clip, { lipsyncLang: "en" }, (word) => {
      if (!t.cancelled) ui.captionAssistant.textContent += word;
    });
  });
}

function finishSpeaking(t) {
  t.chain = t.chain.then(() => {
    if (t.cancelled) return;
    head.speakMarker(() => {
      if (t.cancelled) return;
      history.push({ role: "assistant", content: t.fullText.trim() });
      recentSpeech = { text: t.queued.join(" "), until: Date.now() + ECHO_TAIL_MS };
      turn = null;
      setPhase("listening");
      head.makeEyeContact(2000);
    });
  });
}

// ---------------------------------------------------------------------------
// Conversation turn: stream Claude over SSE
// ---------------------------------------------------------------------------
async function runAssistantTurn() {
  const t = {
    id: ++turnSeq, abort: new AbortController(), chain: Promise.resolve(),
    buffer: "", fullText: "", moodParsed: false, spokeAny: false,
    queued: [], spoken: [], cancelled: false,
  };
  turn = t;
  setPhase("thinking");
  thinkingGlance();
  ui.captionAssistant.textContent = "";

  const handleText = (delta) => {
    t.buffer += delta;
    if (t.moodParsed) {
      t.fullText += delta;
    } else {
      const m = t.buffer.match(/^\s*\[(\w+)\]\s*/);
      if (m) {
        if (MOODS.has(m[1])) head.setMood(m[1]);
        t.buffer = t.buffer.slice(m[0].length);
      } else if (/^\s*\[?\w*$/.test(t.buffer)) {
        return; // still waiting to see if a tag is coming
      }
      t.moodParsed = true; // tag handled, or no tag at all
      t.fullText += t.buffer;
    }
    for (const chunk of takeChunks(t, false)) speak(t, chunk);
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: t.abort.signal,
    });
    if (!res.ok) throw new Error(await res.text());

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let sseBuf = "";
    let saidSearching = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      sseBuf += value;
      let idx;
      while ((idx = sseBuf.indexOf("\n\n")) >= 0) {
        const raw = sseBuf.slice(0, idx);
        sseBuf = sseBuf.slice(idx + 2);
        const event = raw.match(/^event: (.*)$/m)?.[1];
        const data = JSON.parse(raw.match(/^data: (.*)$/m)?.[1] || "{}");
        if (t.cancelled) return;
        if (event === "delta") handleText(data.text);
        else if (event === "status" && data.state === "searching" && !saidSearching) {
          saidSearching = true;
          ui.statusText.textContent = "Searching";
          if (!t.spokeAny) { speak(t, "One moment, let me look that up."); t.spokeAny = true; }
        } else if (event === "error") {
          handleText(" " + data.message);
        }
      }
    }
    if (t.cancelled) return;
    if (!t.moodParsed) { t.moodParsed = true; t.fullText += t.buffer; }
    for (const chunk of takeChunks(t, true)) speak(t, chunk);
    finishSpeaking(t);
  } catch (err) {
    if (t.cancelled || err.name === "AbortError") return;
    console.error(err);
    speak(t, "Sorry, something went wrong on my side. Could you say that again?");
    finishSpeaking(t);
  }
}

// Stop the avatar mid-turn (user barged in or pressed stop).
function interrupt() {
  const t = turn;
  if (!t) return;
  t.cancelled = true;
  t.abort.abort();
  head.stopSpeaking();
  const said = t.spoken.join(" ").trim();
  if (said) history.push({ role: "assistant", content: said + " …" });
  recentSpeech = { text: t.queued.join(" "), until: Date.now() + ECHO_TAIL_MS };
  turn = null;
  head.setMood("neutral");
  setPhase("listening");
}

// ---------------------------------------------------------------------------
// Speech input: continuous recognition with automatic end-of-turn detection
// ---------------------------------------------------------------------------
const words = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);

// True when what the mic picked up is mostly the avatar's own voice.
function isEcho(text) {
  const reference = turn ? turn.queued.join(" ") : Date.now() < recentSpeech.until ? recentSpeech.text : "";
  if (!reference) return false;
  const heard = words(text);
  if (!heard.length) return true;
  const said = new Set(words(reference));
  const overlap = heard.filter((w) => said.has(w)).length / heard.length;
  return overlap >= ECHO_OVERLAP;
}

function commitUserTurn() {
  clearTimeout(endpointTimer);
  const text = (heardFinal + " " + heardInterim).replace(/\s+/g, " ").trim();
  heardFinal = heardInterim = "";
  if (!text || muted || isEcho(text)) return;
  if (turn) interrupt();
  history.push({ role: "user", content: text });
  ui.captionUser.textContent = text;
  runAssistantTurn();
}

function onRecognitionResult(e) {
  if (muted) return;
  let interim = "";
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    if (r.isFinal) heardFinal += " " + r[0].transcript;
    else interim += r[0].transcript;
  }
  heardInterim = interim;
  const current = (heardFinal + " " + heardInterim).trim();
  if (!current) return;

  // Ignore the avatar's own voice leaking into the mic; interrupt on real speech.
  if (isEcho(current)) {
    heardFinal = heardInterim = "";
    return;
  }
  if (turn) {
    if (words(current).length < BARGE_IN_MIN_WORDS && !heardFinal.trim()) return;
    interrupt();
  }

  ui.captionUser.textContent = current;
  head.makeEyeContact(1500);
  clearTimeout(endpointTimer);
  endpointTimer = setTimeout(
    commitUserTurn,
    heardInterim ? ENDPOINT_AFTER_INTERIM_MS : ENDPOINT_AFTER_FINAL_MS,
  );
}

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = onRecognitionResult;
  recognition.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      running = false;
      alert("Microphone access was blocked. Allow it in the browser and reload.");
    }
  };
  // Browsers end recognition sessions periodically; restart for hands-free use.
  recognition.onend = () => {
    if (running) setTimeout(() => { try { recognition.start(); } catch {} }, 150);
  };
  recognition.start();
}

// Mic level meter (also opens the mic with echo cancellation enabled).
async function startMicMeter() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = head.audioCtx;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const tick = () => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += (v - 128) ** 2;
    const level = muted ? 0 : Math.min(1, Math.sqrt(sum / buf.length) / 30);
    ui.micRing.style.setProperty("--level", level.toFixed(2));
    requestAnimationFrame(tick);
  };
  tick();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function start() {
  ui.btnStart.disabled = true;
  try {
    await head.audioCtx.resume();
    await startMicMeter();
  } catch {
    showError("Microphone access is required. Please allow it and try again.");
    ui.btnStart.disabled = false;
    return;
  }
  running = true;
  startRecognition();
  ui.start.hidden = true;
  ui.btnMute.hidden = false;
  setPhase("listening");

  history.push({ role: "user", content: "(The user just started the voice conversation. Greet them briefly and ask how you can help.)" });
  runAssistantTurn();
}

async function init() {
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    ui.loading.hidden = true;
    showError("This browser doesn't support live speech recognition. Please use Chrome or Edge.");
    return;
  }
  const cfg = await (await fetch("/api/config")).json();
  ui.name.textContent = cfg.avatar.name;
  if (!cfg.tts_ready) showError("Server is missing ELEVENLABS_API_KEY, so the avatar can't speak yet.");
  try {
    await loadAvatar(cfg.avatar);
  } catch (err) {
    console.error(err);
    ui.loadingText.textContent = "Couldn't load the avatar model.";
    return;
  }
  ui.loading.hidden = true;
  ui.btnStart.disabled = !cfg.tts_ready;
}

ui.btnStart.addEventListener("click", start);
ui.btnStop.addEventListener("click", interrupt);
ui.btnMute.addEventListener("click", () => {
  muted = !muted;
  ui.btnMute.setAttribute("aria-pressed", String(muted));
  heardFinal = heardInterim = "";
  clearTimeout(endpointTimer);
  if (!turn) setPhase("listening");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") interrupt();
  if (e.key.toLowerCase() === "m" && running) ui.btnMute.click();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) head?.stop(); else head?.start();
});

init();
