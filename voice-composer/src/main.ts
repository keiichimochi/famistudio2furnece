import "./styles.css";

type ChannelId = "sq1" | "sq2" | "wave" | "noise";
type ChannelKind = "square" | "wave" | "noise";

type Channel = {
  id: ChannelId;
  name: string;
  shortName: string;
  color: string;
  kind: ChannelKind;
  duty: number;
  octaveShift: number;
};

type NoteEvent = {
  id: string;
  channel: ChannelId;
  start: number;
  duration: number;
  midi: number;
  velocity: number;
};

type ProjectState = {
  bpm: number;
  quantize: number;
  lengthBeats: number;
  activeChannel: ChannelId;
  notes: NoteEvent[];
};

type RecordingState = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  startedAt: number;
  samples: Float32Array<ArrayBuffer>;
  events: NoteEvent[];
  lastMidi?: number;
  lastStart?: number;
  lastVelocity?: number;
  lastNoiseBeat: number;
  raf: number;
};

const channels: Channel[] = [
  { id: "sq1", name: "GB Square 1", shortName: "Sq1", color: "#75d86b", kind: "square", duty: 0.5, octaveShift: 0 },
  { id: "sq2", name: "GB Square 2", shortName: "Sq2", color: "#65b7ff", kind: "square", duty: 0.25, octaveShift: 0 },
  { id: "wave", name: "GB Wave", shortName: "Wave", color: "#ffb85f", kind: "wave", duty: 0.5, octaveShift: -12 },
  { id: "noise", name: "GB Noise", shortName: "Noise", color: "#d789ff", kind: "noise", duty: 0.5, octaveShift: 0 }
];

const state: ProjectState = {
  bpm: 120,
  quantize: 0.25,
  lengthBeats: 16,
  activeChannel: "sq1",
  notes: []
};

let audioContext: AudioContext | undefined;
let recording: RecordingState | undefined;
let isPlaying = false;
let playbackStartedAt = 0;
let playheadTimer = 0;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app root.");

app.innerHTML = `
  <main class="app">
    <header class="topbar">
      <div class="brand">
        <h1>GB Voice Composer</h1>
        <span>iPhone microphone to Game Boy style note data</span>
      </div>
      <div class="status" id="status">Ready</div>
    </header>

    <section class="transport">
      <button id="play">Play</button>
      <button id="stop" class="secondary">Stop</button>
      <button id="export" class="secondary">Export JSON</button>
      <button id="clear" class="danger">Clear All</button>
      <div class="field">
        <label for="bpm">BPM</label>
        <input id="bpm" type="number" min="40" max="240" value="${state.bpm}" />
      </div>
      <div class="field">
        <label for="quantize">Grid</label>
        <select id="quantize">
          <option value="0.125">32分</option>
          <option value="0.25" selected>16分</option>
          <option value="0.5">8分</option>
          <option value="1">4分</option>
        </select>
      </div>
      <div class="field">
        <label for="length">Beats</label>
        <input id="length" type="number" min="4" max="128" value="${state.lengthBeats}" />
      </div>
    </section>

    <section class="layout">
      <aside class="channels" id="channels"></aside>
      <section class="workspace">
        <div class="record-panel">
          <div class="record-title">
            <strong id="active-title">GB Square 1</strong>
            <span class="muted" id="record-hint">Record replaces only the selected channel. Other channels play as guide.</span>
          </div>
          <div class="record-actions">
            <button id="record">Record Channel</button>
            <button id="erase" class="secondary">Erase Channel</button>
          </div>
        </div>
        <div class="meters" id="meters"></div>
        <div class="piano-roll" id="roll"><div class="roll-inner" id="roll-inner"><div class="playhead" id="playhead" style="--time: 0"></div></div></div>
        <textarea class="export-area" id="json" spellcheck="false" placeholder="Export JSON appears here"></textarea>
      </section>
    </section>
  </main>
`;

const statusEl = mustGet<HTMLElement>("status");
const channelsEl = mustGet<HTMLElement>("channels");
const metersEl = mustGet<HTMLElement>("meters");
const rollInnerEl = mustGet<HTMLElement>("roll-inner");
let playheadEl = mustGet<HTMLElement>("playhead");
const jsonEl = mustGet<HTMLTextAreaElement>("json");
const activeTitleEl = mustGet<HTMLElement>("active-title");
const playButton = mustGet<HTMLButtonElement>("play");
const stopButton = mustGet<HTMLButtonElement>("stop");
const recordButton = mustGet<HTMLButtonElement>("record");
const eraseButton = mustGet<HTMLButtonElement>("erase");
const exportButton = mustGet<HTMLButtonElement>("export");
const clearButton = mustGet<HTMLButtonElement>("clear");
const bpmInput = mustGet<HTMLInputElement>("bpm");
const quantizeInput = mustGet<HTMLSelectElement>("quantize");
const lengthInput = mustGet<HTMLInputElement>("length");

playButton.addEventListener("click", () => {
  void playProject();
});
stopButton.addEventListener("click", () => stopPlayback());
recordButton.addEventListener("click", () => {
  void toggleRecording();
});
eraseButton.addEventListener("click", () => eraseActiveChannel());
exportButton.addEventListener("click", exportJson);
clearButton.addEventListener("click", clearAll);
bpmInput.addEventListener("change", () => {
  state.bpm = clamp(Number.parseInt(bpmInput.value, 10), 40, 240);
  render();
});
quantizeInput.addEventListener("change", () => {
  state.quantize = Number.parseFloat(quantizeInput.value);
  render();
});
lengthInput.addEventListener("change", () => {
  state.lengthBeats = clamp(Number.parseInt(lengthInput.value, 10), 4, 128);
  render();
});

render();

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}

async function ensureAudio(): Promise<AudioContext> {
  audioContext ??= new AudioContext();
  if (audioContext.state !== "running") await audioContext.resume();
  return audioContext;
}

async function toggleRecording(): Promise<void> {
  if (recording) {
    stopRecording(true);
    return;
  }

  const context = await ensureAudio();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false
    }
  });
  eraseActiveChannel(false);
  await playProject();

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  recording = {
    stream,
    source,
    analyser,
    startedAt: context.currentTime,
    samples: new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>,
    events: [],
    lastNoiseBeat: -999,
    raf: 0
  };
  recordButton.textContent = "Stop Recording";
  recordButton.classList.add("danger");
  setStatus(`Recording ${activeChannel().name}`);
  recording.raf = requestAnimationFrame(recordLoop);
}

function stopRecording(commit: boolean): void {
  if (!recording) return;
  const current = recording;
  cancelAnimationFrame(current.raf);
  finalizeOpenNote(current, beatNow(current.startedAt));
  current.source.disconnect();
  for (const track of current.stream.getTracks()) track.stop();
  if (commit) {
    state.notes.push(...mergeAdjacent(current.events).filter((event) => event.duration > 0));
    setStatus(`Recorded ${current.events.length} event(s) to ${activeChannel().shortName}`);
  }
  recording = undefined;
  recordButton.textContent = "Record Channel";
  recordButton.classList.remove("danger");
  stopPlayback();
  render();
}

function recordLoop(): void {
  if (!recording || !audioContext) return;
  recording.analyser.getFloatTimeDomainData(recording.samples);
  const beat = beatNow(recording.startedAt);
  const channel = activeChannel();
  const rms = rootMeanSquare(recording.samples);
  updateLiveMeter(channel.id, rms);

  if (channel.kind === "noise") {
    detectNoiseHit(recording, beat, rms);
  } else {
    detectPitchedNote(recording, channel, beat, rms);
  }

  if (beat >= state.lengthBeats) {
    stopRecording(true);
    return;
  }
  recording.raf = requestAnimationFrame(recordLoop);
}

function detectPitchedNote(current: RecordingState, channel: Channel, beat: number, rms: number): void {
  const frequency = rms > 0.018 ? detectPitch(current.samples, audioContext?.sampleRate ?? 44100) : undefined;
  const midi = frequency ? clamp(Math.round(69 + 12 * Math.log2(frequency / 440)) + channel.octaveShift, 36, 84) : undefined;
  const quantizedBeat = quantizeBeat(beat);

  if (midi === undefined) {
    finalizeOpenNote(current, quantizedBeat);
    return;
  }

  if (current.lastMidi === undefined) {
    current.lastMidi = midi;
    current.lastStart = quantizedBeat;
    current.lastVelocity = clamp(rms * 12, 0.2, 1);
    return;
  }

  if (Math.abs(midi - current.lastMidi) >= 1 && current.lastStart !== undefined) {
    finalizeOpenNote(current, quantizedBeat);
    current.lastMidi = midi;
    current.lastStart = quantizedBeat;
    current.lastVelocity = clamp(rms * 12, 0.2, 1);
  }
}

function detectNoiseHit(current: RecordingState, beat: number, rms: number): void {
  const quantizedBeat = quantizeBeat(beat);
  if (rms < 0.08 || quantizedBeat - current.lastNoiseBeat < state.quantize) return;
  current.events.push({
    id: crypto.randomUUID(),
    channel: "noise",
    start: quantizedBeat,
    duration: state.quantize,
    midi: 42,
    velocity: clamp(rms * 8, 0.25, 1)
  });
  current.lastNoiseBeat = quantizedBeat;
  render();
}

function finalizeOpenNote(current: RecordingState, endBeat: number): void {
  if (current.lastMidi === undefined || current.lastStart === undefined) return;
  const end = Math.max(current.lastStart + state.quantize, quantizeBeat(endBeat));
  current.events.push({
    id: crypto.randomUUID(),
    channel: state.activeChannel,
    start: current.lastStart,
    duration: Math.min(end - current.lastStart, state.lengthBeats - current.lastStart),
    midi: current.lastMidi,
    velocity: current.lastVelocity ?? 0.7
  });
  current.lastMidi = undefined;
  current.lastStart = undefined;
  current.lastVelocity = undefined;
  render();
}

async function playProject(): Promise<void> {
  const context = await ensureAudio();
  stopPlayback(false);
  isPlaying = true;
  playbackStartedAt = context.currentTime;
  schedulePlayback(context, playbackStartedAt, state.notes);
  animatePlayhead();
  setStatus("Playing");
}

function stopPlayback(updateStatus = true): void {
  isPlaying = false;
  window.clearTimeout(playheadTimer);
  playheadEl.style.setProperty("--time", "0");
  if (updateStatus) setStatus("Stopped");
}

function schedulePlayback(context: AudioContext, startTime: number, notes: NoteEvent[]): void {
  const secondsPerBeat = 60 / state.bpm;
  for (const note of notes) {
    const channel = channels.find((item) => item.id === note.channel);
    if (!channel) continue;
    const startsAt = startTime + note.start * secondsPerBeat;
    const duration = Math.max(0.04, note.duration * secondsPerBeat);
    if (channel.kind === "noise") scheduleNoise(context, startsAt, duration, note.velocity);
    else scheduleTone(context, channel, startsAt, duration, midiToFrequency(note.midi), note.velocity);
  }
}

function scheduleTone(context: AudioContext, channel: Channel, startsAt: number, duration: number, frequency: number, velocity: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = channel.kind === "wave" ? "sine" : "square";
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0, startsAt);
  gain.gain.linearRampToValueAtTime(0.12 * velocity, startsAt + 0.012);
  gain.gain.setValueAtTime(0.12 * velocity, Math.max(startsAt + 0.012, startsAt + duration - 0.025));
  gain.gain.linearRampToValueAtTime(0, startsAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.03);
}

function scheduleNoise(context: AudioContext, startsAt: number, duration: number, velocity: number): void {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(0.18 * velocity, startsAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startsAt + duration);
  source.connect(gain);
  gain.connect(context.destination);
  source.start(startsAt);
}

function animatePlayhead(): void {
  if (!audioContext || !isPlaying) return;
  const beat = (audioContext.currentTime - playbackStartedAt) / (60 / state.bpm);
  playheadEl.style.setProperty("--time", String(Math.min(beat, state.lengthBeats)));
  if (beat >= state.lengthBeats) {
    stopPlayback(false);
    setStatus("Playback ended");
    return;
  }
  playheadTimer = window.setTimeout(animatePlayhead, 33);
}

function eraseActiveChannel(renderAfter = true): void {
  state.notes = state.notes.filter((note) => note.channel !== state.activeChannel);
  if (renderAfter) {
    setStatus(`Erased ${activeChannel().shortName}`);
    render();
  }
}

function clearAll(): void {
  stopPlayback();
  if (recording) stopRecording(false);
  state.notes = [];
  jsonEl.value = "";
  setStatus("Cleared");
  render();
}

function exportJson(): void {
  const payload = {
    format: "gb-voice-composer",
    version: 1,
    bpm: state.bpm,
    quantize: state.quantize,
    lengthBeats: state.lengthBeats,
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      kind: channel.kind,
      duty: channel.duty
    })),
    notes: state.notes
      .slice()
      .sort((a, b) => a.start - b.start || a.channel.localeCompare(b.channel))
      .map((note) => ({
        channel: note.channel,
        start: note.start,
        duration: note.duration,
        midi: note.midi,
        name: midiName(note.midi),
        velocity: Number(note.velocity.toFixed(3))
      }))
  };
  jsonEl.value = JSON.stringify(payload, null, 2);
  setStatus("JSON exported");
}

function render(): void {
  activeTitleEl.textContent = activeChannel().name;
  channelsEl.innerHTML = channels
    .map((channel) => {
      const count = state.notes.filter((note) => note.channel === channel.id).length;
      return `
        <div class="channel ${channel.id === state.activeChannel ? "active" : ""}" style="--channel-color: ${channel.color}">
          <div>
            <h2>${channel.name}</h2>
            <div class="channel-meta">${count} event(s)</div>
          </div>
          <div class="channel-actions">
            <button class="secondary" data-channel="${channel.id}">Select</button>
          </div>
        </div>
      `;
    })
    .join("");
  for (const button of channelsEl.querySelectorAll<HTMLButtonElement>("[data-channel]")) {
    button.addEventListener("click", () => {
      state.activeChannel = button.dataset.channel as ChannelId;
      render();
    });
  }

  metersEl.innerHTML = channels
    .map(
      (channel) => `
        <div class="meter" style="--channel-color: ${channel.color}">
          <div class="meter-label"><span>${channel.shortName}</span><span>${state.notes.filter((note) => note.channel === channel.id).length}</span></div>
          <div class="bar"><span id="level-${channel.id}" style="--level: 0%"></span></div>
        </div>
      `
    )
    .join("");

  rollInnerEl.style.width = `${Math.max(960, state.lengthBeats * 48)}px`;
  rollInnerEl.innerHTML = `<div class="playhead" id="playhead" style="--time: 0"></div>${state.notes.map(renderNote).join("")}`;
  const updatedPlayhead = document.getElementById("playhead");
  if (updatedPlayhead) {
    playheadEl.replaceWith(updatedPlayhead);
    playheadEl = updatedPlayhead;
  }
}

function renderNote(note: NoteEvent): string {
  const channel = channels.find((item) => item.id === note.channel) ?? channels[0];
  return `<div class="note ${channel.kind === "noise" ? "noise-hit" : ""}" title="${channel.shortName} ${midiName(note.midi)}" style="--channel-color: ${channel.color}; --start: ${note.start}; --duration: ${note.duration}; --midi: ${note.midi}"></div>`;
}

function activeChannel(): Channel {
  return channels.find((channel) => channel.id === state.activeChannel) ?? channels[0];
}

function beatNow(startedAt: number): number {
  if (!audioContext) return 0;
  return (audioContext.currentTime - startedAt) / (60 / state.bpm);
}

function quantizeBeat(beat: number): number {
  return clamp(Math.round(beat / state.quantize) * state.quantize, 0, state.lengthBeats);
}

function mergeAdjacent(events: NoteEvent[]): NoteEvent[] {
  const sorted = events.slice().sort((a, b) => a.start - b.start || a.midi - b.midi);
  const merged: NoteEvent[] = [];
  for (const event of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.channel === event.channel && previous.midi === event.midi && Math.abs(previous.start + previous.duration - event.start) < 0.001) {
      previous.duration += event.duration;
    } else {
      merged.push({ ...event });
    }
  }
  return merged;
}

function detectPitch(buffer: Float32Array, sampleRate: number): number | undefined {
  const rms = rootMeanSquare(buffer);
  if (rms < 0.018) return undefined;

  const minLag = Math.floor(sampleRate / 900);
  const maxLag = Math.min(Math.floor(sampleRate / 70), Math.floor(buffer.length / 2));
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    correlation /= buffer.length - lag;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorrelation < 0.002) return undefined;
  return sampleRate / bestLag;
}

function rootMeanSquare(buffer: Float32Array): number {
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  return Math.sqrt(sum / buffer.length);
}

function updateLiveMeter(channelId: ChannelId, rms: number): void {
  const level = document.getElementById(`level-${channelId}`);
  if (level) level.style.setProperty("--level", `${Math.round(clamp(rms * 600, 0, 100))}%`);
}

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function midiName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}
