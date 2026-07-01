import "./styles.css";

type WaveShape = number[];

type SfxPreset = {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMs: number;
  repeatCount: number;
  repeatIntervalMs: number;
  startNote: number;
  endNote: number;
  volumeStart: number;
  volumeEnd: number;
  bend: "linear" | "expo" | "dip" | "rise-fall";
  vibratoDepth: number;
  vibratoRate: number;
  retriggerHz: number;
  noiseMix: number;
  wave: WaveShape;
};

const storageKey = "gb-sfx-maker-custom-presets-v1";
const sampleRate = 44100;

const waves = {
  blade: [8, 11, 14, 15, 13, 9, 4, 1, 0, 1, 3, 5, 7, 8, 9, 10, 9, 8, 7, 5, 3, 1, 0, 1, 4, 7, 10, 13, 15, 14, 11, 8],
  bite: [8, 15, 2, 13, 1, 10, 3, 9, 4, 8, 5, 7, 6, 6, 7, 5, 8, 4, 9, 3, 10, 1, 13, 2, 15, 8, 5, 2, 0, 2, 5, 8],
  fire: [8, 9, 11, 14, 15, 12, 6, 2, 0, 2, 6, 12, 15, 14, 11, 9, 8, 7, 5, 2, 0, 3, 9, 13, 15, 13, 9, 3, 0, 2, 5, 7],
  bell: [8, 10, 12, 13, 14, 15, 14, 13, 12, 10, 8, 6, 4, 3, 2, 1, 2, 3, 4, 6, 8, 10, 12, 13, 14, 13, 12, 10, 8, 6, 4, 2],
  thud: [8, 15, 15, 14, 10, 4, 1, 0, 0, 2, 5, 8, 11, 13, 12, 9, 6, 3, 1, 0, 0, 1, 4, 8, 12, 15, 14, 9, 4, 1, 0, 4],
};

const starterPresets: SfxPreset[] = [
  {
    id: "slash-fast",
    name: "Sword Slash",
    category: "Attack",
    description: "Short rising scrape for a fast sword cut.",
    durationMs: 180,
    repeatCount: 1,
    repeatIntervalMs: 48,
    startNote: 72,
    endNote: 92,
    volumeStart: 0.9,
    volumeEnd: 0.05,
    bend: "expo",
    vibratoDepth: 0,
    vibratoRate: 0,
    retriggerHz: 26,
    noiseMix: 0.18,
    wave: waves.blade,
  },
  {
    id: "slash-23-hit",
    name: "23 Hit Sword Rush",
    category: "Attack",
    description: "Rapid repeated blade hits for a FF-style multi-hit attack.",
    durationMs: 78,
    repeatCount: 23,
    repeatIntervalMs: 42,
    startNote: 70,
    endNote: 91,
    volumeStart: 0.95,
    volumeEnd: 0,
    bend: "expo",
    vibratoDepth: 0.2,
    vibratoRate: 21,
    retriggerHz: 33,
    noiseMix: 0.2,
    wave: waves.blade,
  },
  {
    id: "slash-heavy",
    name: "Heavy Slash",
    category: "Attack",
    description: "Lower double-edged blade hit.",
    durationMs: 260,
    repeatCount: 1,
    repeatIntervalMs: 64,
    startNote: 58,
    endNote: 82,
    volumeStart: 1,
    volumeEnd: 0,
    bend: "rise-fall",
    vibratoDepth: 0.25,
    vibratoRate: 18,
    retriggerHz: 18,
    noiseMix: 0.22,
    wave: waves.blade,
  },
  {
    id: "damage-small",
    name: "Damage Tick",
    category: "Damage",
    description: "Quick pain chirp for light damage.",
    durationMs: 150,
    repeatCount: 1,
    repeatIntervalMs: 48,
    startNote: 83,
    endNote: 67,
    volumeStart: 0.95,
    volumeEnd: 0.05,
    bend: "linear",
    vibratoDepth: 0.5,
    vibratoRate: 24,
    retriggerHz: 0,
    noiseMix: 0.08,
    wave: waves.bite,
  },
  {
    id: "damage-heavy",
    name: "Damage Heavy",
    category: "Damage",
    description: "Dropping impact for a strong hit.",
    durationMs: 320,
    repeatCount: 1,
    repeatIntervalMs: 70,
    startNote: 74,
    endNote: 38,
    volumeStart: 1,
    volumeEnd: 0,
    bend: "expo",
    vibratoDepth: 0.35,
    vibratoRate: 16,
    retriggerHz: 12,
    noiseMix: 0.16,
    wave: waves.thud,
  },
  {
    id: "monster-collapse",
    name: "Monster Down",
    category: "Enemy",
    description: "Long falling growl when an enemy disappears.",
    durationMs: 720,
    repeatCount: 1,
    repeatIntervalMs: 90,
    startNote: 63,
    endNote: 24,
    volumeStart: 1,
    volumeEnd: 0,
    bend: "expo",
    vibratoDepth: 1.2,
    vibratoRate: 10,
    retriggerHz: 9,
    noiseMix: 0.2,
    wave: waves.thud,
  },
  {
    id: "fire-cast",
    name: "Fire Cast",
    category: "Magic",
    description: "Rising flame ignition with rough overtones.",
    durationMs: 420,
    repeatCount: 1,
    repeatIntervalMs: 60,
    startNote: 48,
    endNote: 84,
    volumeStart: 0.2,
    volumeEnd: 0.95,
    bend: "expo",
    vibratoDepth: 0.45,
    vibratoRate: 22,
    retriggerHz: 32,
    noiseMix: 0.25,
    wave: waves.fire,
  },
  {
    id: "fire-hit",
    name: "Fire Hit",
    category: "Magic",
    description: "Bright burst after a fire spell lands.",
    durationMs: 500,
    repeatCount: 1,
    repeatIntervalMs: 60,
    startNote: 86,
    endNote: 45,
    volumeStart: 1,
    volumeEnd: 0,
    bend: "dip",
    vibratoDepth: 0.75,
    vibratoRate: 28,
    retriggerHz: 24,
    noiseMix: 0.34,
    wave: waves.fire,
  },
  {
    id: "cursor-blip",
    name: "Menu Blip",
    category: "UI",
    description: "Compact selectable menu tone.",
    durationMs: 90,
    repeatCount: 1,
    repeatIntervalMs: 48,
    startNote: 84,
    endNote: 91,
    volumeStart: 0.55,
    volumeEnd: 0,
    bend: "linear",
    vibratoDepth: 0,
    vibratoRate: 0,
    retriggerHz: 0,
    noiseMix: 0,
    wave: waves.bell,
  },
  {
    id: "treasure",
    name: "Treasure Spark",
    category: "Reward",
    description: "Small rising sparkle for item or gil.",
    durationMs: 360,
    repeatCount: 1,
    repeatIntervalMs: 70,
    startNote: 72,
    endNote: 103,
    volumeStart: 0.35,
    volumeEnd: 0,
    bend: "rise-fall",
    vibratoDepth: 0.2,
    vibratoRate: 12,
    retriggerHz: 0,
    noiseMix: 0,
    wave: waves.bell,
  },
  {
    id: "heal",
    name: "Heal Pulse",
    category: "Magic",
    description: "Soft upward pulse for recovery magic.",
    durationMs: 580,
    repeatCount: 1,
    repeatIntervalMs: 120,
    startNote: 60,
    endNote: 91,
    volumeStart: 0.25,
    volumeEnd: 0,
    bend: "rise-fall",
    vibratoDepth: 0.35,
    vibratoRate: 8,
    retriggerHz: 5,
    noiseMix: 0,
    wave: waves.bell,
  },
];

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app root");

let audioContext: AudioContext | null = null;
let current: SfxPreset = clonePreset(starterPresets[0]);
let customPresets = loadCustomPresets();
let selectedPresetId = current.id;
let activeSource: AudioBufferSourceNode | null = null;

app.innerHTML = `
  <header class="topbar">
    <div>
      <h1>GB SFX Maker</h1>
      <p>Wave channel sound effects for compact RPG battles.</p>
    </div>
    <div class="top-actions">
      <button id="play" class="primary">Play</button>
      <button id="stop">Stop</button>
      <button id="randomize">Mutate</button>
    </div>
  </header>

  <main class="layout">
    <aside class="preset-panel">
      <div class="panel-title">Samples</div>
      <div id="preset-list" class="preset-list"></div>
    </aside>

    <section class="editor">
      <div class="name-row">
        <label>
          Name
          <input id="name" type="text" />
        </label>
        <label>
          Category
          <input id="category" type="text" />
        </label>
      </div>

      <div class="wave-card">
        <div class="panel-title">GB Wave RAM</div>
        <canvas id="wave-canvas" width="640" height="190"></canvas>
        <div id="wave-grid" class="wave-grid"></div>
      </div>

      <div class="controls">
        <label>Duration <input id="duration" type="range" min="40" max="1400" step="10" /></label>
        <output id="duration-out"></output>
        <label>Repeat Count <input id="repeat-count" type="range" min="1" max="32" step="1" /></label>
        <output id="repeat-count-out"></output>
        <label>Repeat Gap <input id="repeat-interval" type="range" min="16" max="180" step="2" /></label>
        <output id="repeat-interval-out"></output>
        <label>Start Note <input id="start-note" type="range" min="24" max="108" step="1" /></label>
        <output id="start-note-out"></output>
        <label>End Note <input id="end-note" type="range" min="24" max="108" step="1" /></label>
        <output id="end-note-out"></output>
        <label>Volume Start <input id="volume-start" type="range" min="0" max="1" step="0.01" /></label>
        <output id="volume-start-out"></output>
        <label>Volume End <input id="volume-end" type="range" min="0" max="1" step="0.01" /></label>
        <output id="volume-end-out"></output>
        <label>Vibrato Depth <input id="vibrato-depth" type="range" min="0" max="3" step="0.05" /></label>
        <output id="vibrato-depth-out"></output>
        <label>Vibrato Rate <input id="vibrato-rate" type="range" min="0" max="40" step="1" /></label>
        <output id="vibrato-rate-out"></output>
        <label>Retrigger <input id="retrigger" type="range" min="0" max="60" step="1" /></label>
        <output id="retrigger-out"></output>
        <label>Noise Mix <input id="noise-mix" type="range" min="0" max="0.6" step="0.01" /></label>
        <output id="noise-mix-out"></output>
      </div>

      <div class="bend-row">
        <span>Bend</span>
        <div class="segments" id="bend-segments">
          <button data-bend="linear">Linear</button>
          <button data-bend="expo">Expo</button>
          <button data-bend="dip">Dip</button>
          <button data-bend="rise-fall">Rise/Fall</button>
        </div>
      </div>
    </section>

    <aside class="save-panel">
      <div class="panel-title">Save</div>
      <button id="save-as" class="primary">Save As Custom</button>
      <button id="export-json">Export JSON</button>
      <button id="import-json">Import JSON</button>
      <button id="export-wav">Render WAV</button>
      <input id="file-input" hidden type="file" accept="application/json,.json" />
      <div class="hint" id="status">Ready</div>
      <div class="panel-title">Current</div>
      <pre id="summary"></pre>
    </aside>
  </main>
`;

const presetList = byId<HTMLDivElement>("preset-list");
const waveCanvas = byId<HTMLCanvasElement>("wave-canvas");
const waveGrid = byId<HTMLDivElement>("wave-grid");
const nameInput = byId<HTMLInputElement>("name");
const categoryInput = byId<HTMLInputElement>("category");
const summary = byId<HTMLPreElement>("summary");
const statusEl = byId<HTMLDivElement>("status");
const fileInput = byId<HTMLInputElement>("file-input");
const controls = {
  durationMs: [byId<HTMLInputElement>("duration"), byId<HTMLOutputElement>("duration-out")] as const,
  repeatCount: [byId<HTMLInputElement>("repeat-count"), byId<HTMLOutputElement>("repeat-count-out")] as const,
  repeatIntervalMs: [byId<HTMLInputElement>("repeat-interval"), byId<HTMLOutputElement>("repeat-interval-out")] as const,
  startNote: [byId<HTMLInputElement>("start-note"), byId<HTMLOutputElement>("start-note-out")] as const,
  endNote: [byId<HTMLInputElement>("end-note"), byId<HTMLOutputElement>("end-note-out")] as const,
  volumeStart: [byId<HTMLInputElement>("volume-start"), byId<HTMLOutputElement>("volume-start-out")] as const,
  volumeEnd: [byId<HTMLInputElement>("volume-end"), byId<HTMLOutputElement>("volume-end-out")] as const,
  vibratoDepth: [byId<HTMLInputElement>("vibrato-depth"), byId<HTMLOutputElement>("vibrato-depth-out")] as const,
  vibratoRate: [byId<HTMLInputElement>("vibrato-rate"), byId<HTMLOutputElement>("vibrato-rate-out")] as const,
  retriggerHz: [byId<HTMLInputElement>("retrigger"), byId<HTMLOutputElement>("retrigger-out")] as const,
  noiseMix: [byId<HTMLInputElement>("noise-mix"), byId<HTMLOutputElement>("noise-mix-out")] as const,
};

bindEvents();
renderAll();

function bindEvents(): void {
  byId<HTMLButtonElement>("play").addEventListener("click", () => void playCurrent());
  byId<HTMLButtonElement>("stop").addEventListener("click", stopPlayback);
  byId<HTMLButtonElement>("randomize").addEventListener("click", mutateCurrent);
  byId<HTMLButtonElement>("save-as").addEventListener("click", saveAsCustom);
  byId<HTMLButtonElement>("export-json").addEventListener("click", exportJson);
  byId<HTMLButtonElement>("import-json").addEventListener("click", () => fileInput.click());
  byId<HTMLButtonElement>("export-wav").addEventListener("click", exportWav);
  fileInput.addEventListener("change", importJson);
  nameInput.addEventListener("input", () => {
    current.name = nameInput.value.trim() || "Untitled SFX";
    renderSummary();
  });
  categoryInput.addEventListener("input", () => {
    current.category = categoryInput.value.trim() || "Custom";
    renderSummary();
  });

  const numericBindings: Array<[keyof SfxPreset, HTMLInputElement]> = [
    ["durationMs", controls.durationMs[0]],
    ["repeatCount", controls.repeatCount[0]],
    ["repeatIntervalMs", controls.repeatIntervalMs[0]],
    ["startNote", controls.startNote[0]],
    ["endNote", controls.endNote[0]],
    ["volumeStart", controls.volumeStart[0]],
    ["volumeEnd", controls.volumeEnd[0]],
    ["vibratoDepth", controls.vibratoDepth[0]],
    ["vibratoRate", controls.vibratoRate[0]],
    ["retriggerHz", controls.retriggerHz[0]],
    ["noiseMix", controls.noiseMix[0]],
  ];
  for (const [key, input] of numericBindings) {
    input.addEventListener("input", () => {
      (current[key] as number) = Number(input.value);
      renderControls();
      renderSummary();
      drawWave();
    });
  }

  byId<HTMLDivElement>("bend-segments").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const bend = target.dataset.bend as SfxPreset["bend"] | undefined;
    if (!bend) return;
    current.bend = bend;
    renderBend();
    renderSummary();
  });

  waveCanvas.addEventListener("pointerdown", (event) => editWaveFromPointer(event));
  waveCanvas.addEventListener("pointermove", (event) => {
    if (event.buttons === 1) editWaveFromPointer(event);
  });
}

function renderAll(): void {
  renderPresetList();
  renderFields();
  renderControls();
  renderBend();
  renderWaveGrid();
  drawWave();
  renderSummary();
}

function renderPresetList(): void {
  const presets = [...starterPresets, ...customPresets];
  presetList.innerHTML = "";
  for (const preset of presets) {
    const button = document.createElement("button");
    button.className = preset.id === selectedPresetId ? "preset active" : "preset";
    button.innerHTML = `<strong>${preset.name}</strong><span>${preset.category}</span>`;
    button.addEventListener("click", () => {
      selectedPresetId = preset.id;
      current = clonePreset(preset);
      renderAll();
      setStatus(`Loaded ${preset.name}`);
    });
    presetList.append(button);
  }
}

function renderFields(): void {
  nameInput.value = current.name;
  categoryInput.value = current.category;
}

function renderControls(): void {
  setControl("durationMs", current.durationMs, `${current.durationMs} ms`);
  setControl("repeatCount", current.repeatCount, `${current.repeatCount} hits`);
  setControl("repeatIntervalMs", current.repeatIntervalMs, `${current.repeatIntervalMs} ms`);
  setControl("startNote", current.startNote, noteName(current.startNote));
  setControl("endNote", current.endNote, noteName(current.endNote));
  setControl("volumeStart", current.volumeStart, current.volumeStart.toFixed(2));
  setControl("volumeEnd", current.volumeEnd, current.volumeEnd.toFixed(2));
  setControl("vibratoDepth", current.vibratoDepth, `${current.vibratoDepth.toFixed(2)} st`);
  setControl("vibratoRate", current.vibratoRate, `${current.vibratoRate} Hz`);
  setControl("retriggerHz", current.retriggerHz, current.retriggerHz ? `${current.retriggerHz} Hz` : "Off");
  setControl("noiseMix", current.noiseMix, `${Math.round(current.noiseMix * 100)}%`);
}

function renderBend(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-bend]").forEach((button) => {
    button.classList.toggle("active", button.dataset.bend === current.bend);
  });
}

function renderWaveGrid(): void {
  waveGrid.innerHTML = "";
  current.wave.forEach((value, index) => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "15";
    input.value = String(value);
    input.title = `Wave sample ${index}`;
    input.addEventListener("input", () => {
      current.wave[index] = clamp(Math.round(Number(input.value)), 0, 15);
      input.value = String(current.wave[index]);
      drawWave();
      renderSummary();
    });
    waveGrid.append(input);
  });
}

function renderSummary(): void {
  summary.textContent = JSON.stringify(
    {
      name: current.name,
      category: current.category,
      durationMs: current.durationMs,
      totalDurationMs: getTotalDurationMs(current),
      repeatCount: current.repeatCount,
      repeatIntervalMs: current.repeatIntervalMs,
      pitch: `${noteName(current.startNote)} -> ${noteName(current.endNote)}`,
      bend: current.bend,
      vibrato: `${current.vibratoDepth} st @ ${current.vibratoRate} Hz`,
      retriggerHz: current.retriggerHz,
      noiseMix: current.noiseMix,
      wave: current.wave,
    },
    null,
    2,
  );
}

function drawWave(): void {
  const context = waveCanvas.getContext("2d");
  if (!context) return;
  const width = waveCanvas.width;
  const height = waveCanvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#10161b";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#2b3b46";
  context.lineWidth = 1;
  for (let y = 0; y <= 15; y++) {
    const py = 18 + ((15 - y) / 15) * (height - 36);
    context.beginPath();
    context.moveTo(0, py);
    context.lineTo(width, py);
    context.stroke();
  }
  context.strokeStyle = "#62e58f";
  context.lineWidth = 3;
  context.beginPath();
  current.wave.forEach((value, index) => {
    const x = (index / 31) * (width - 28) + 14;
    const y = 18 + ((15 - value) / 15) * (height - 36);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.fillStyle = "#f6e65b";
  current.wave.forEach((value, index) => {
    const x = (index / 31) * (width - 28) + 14;
    const y = 18 + ((15 - value) / 15) * (height - 36);
    context.fillRect(x - 3, y - 3, 6, 6);
  });
}

async function playCurrent(): Promise<void> {
  stopPlayback();
  const context = getAudioContext();
  const buffer = renderBuffer(current, context.sampleRate);
  activeSource = context.createBufferSource();
  activeSource.buffer = buffer;
  activeSource.connect(context.destination);
  activeSource.start();
  activeSource.onended = () => {
    activeSource = null;
  };
  setStatus(`Playing ${current.name}`);
}

function stopPlayback(): void {
  if (!activeSource) return;
  activeSource.stop();
  activeSource.disconnect();
  activeSource = null;
  setStatus("Stopped");
}

function renderBuffer(preset: SfxPreset, rate: number): AudioBuffer {
  const context = new OfflineAudioContext(1, Math.ceil((getTotalDurationMs(preset) / 1000) * rate), rate);
  const data = renderSamples(preset, rate);
  const buffer = context.createBuffer(1, data.length, rate);
  buffer.copyToChannel(data, 0);
  return buffer;
}

function renderSamples(preset: SfxPreset, rate: number): Float32Array<ArrayBuffer> {
  const hit = renderHitSamples(preset, rate);
  const repeatCount = Math.max(1, Math.round(preset.repeatCount));
  const intervalSamples = Math.max(1, Math.round((preset.repeatIntervalMs / 1000) * rate));
  const total = hit.length + intervalSamples * (repeatCount - 1);
  const output = new Float32Array(total);
  for (let repeat = 0; repeat < repeatCount; repeat++) {
    const offset = repeat * intervalSamples;
    const accent = repeat % 4 === 0 ? 1 : 0.78 + (repeat % 3) * 0.07;
    for (let i = 0; i < hit.length; i++) {
      output[offset + i] += hit[i] * accent;
    }
  }
  for (let i = 0; i < output.length; i++) {
    output[i] = clampFloat(output[i]);
  }
  fadeEdges(output, rate);
  return output;
}

function renderHitSamples(preset: SfxPreset, rate: number): Float32Array<ArrayBuffer> {
  const total = Math.max(1, Math.ceil((preset.durationMs / 1000) * rate));
  const output = new Float32Array(total);
  let phase = 0;
  let noise = 0x12345678;
  for (let i = 0; i < total; i++) {
    const t = i / total;
    const note = interpolateNote(preset, t);
    const vibrato = preset.vibratoDepth * Math.sin(Math.PI * 2 * preset.vibratoRate * (i / rate));
    const frequency = midiToHz(note + vibrato);
    phase = (phase + frequency / rate) % 1;
    const waveIndex = Math.floor(phase * 32) % 32;
    const waveSample = (preset.wave[waveIndex] / 15) * 2 - 1;
    const volume = interpolateVolume(preset, t);
    const gate = preset.retriggerHz > 0 ? (Math.sin(Math.PI * 2 * preset.retriggerHz * (i / rate)) > -0.25 ? 1 : 0.2) : 1;
    noise = xorshift(noise);
    const noiseSample = ((noise & 0xffff) / 0x8000 - 1) * preset.noiseMix;
    output[i] = clampFloat((waveSample * (1 - preset.noiseMix) + noiseSample) * volume * gate);
  }
  fadeEdges(output, rate);
  return output;
}

function interpolateNote(preset: SfxPreset, t: number): number {
  if (preset.bend === "expo") return preset.startNote + (preset.endNote - preset.startNote) * (1 - Math.pow(1 - t, 2.5));
  if (preset.bend === "dip") return preset.startNote + (preset.endNote - preset.startNote) * t - Math.sin(Math.PI * t) * 10;
  if (preset.bend === "rise-fall") {
    const peak = Math.max(preset.startNote, preset.endNote) + 8;
    return t < 0.45
      ? preset.startNote + (peak - preset.startNote) * (t / 0.45)
      : peak + (preset.endNote - peak) * ((t - 0.45) / 0.55);
  }
  return preset.startNote + (preset.endNote - preset.startNote) * t;
}

function interpolateVolume(preset: SfxPreset, t: number): number {
  const base = preset.volumeStart + (preset.volumeEnd - preset.volumeStart) * t;
  const transient = Math.exp(-t * 2.2);
  return clampFloat(base * (0.35 + transient * 0.65));
}

function editWaveFromPointer(event: PointerEvent): void {
  const rect = waveCanvas.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const index = clamp(Math.round(x * 31), 0, 31);
  current.wave[index] = clamp(Math.round((1 - y) * 15), 0, 15);
  renderWaveGrid();
  drawWave();
  renderSummary();
}

function mutateCurrent(): void {
  current = {
    ...current,
    id: `custom-${Date.now()}`,
    name: `${current.name} Variant`,
    durationMs: clamp(current.durationMs + randomInt(-80, 100), 40, 1400),
    repeatCount: clamp(current.repeatCount + randomInt(-2, 3), 1, 32),
    repeatIntervalMs: clamp(current.repeatIntervalMs + randomInt(-12, 12), 16, 180),
    startNote: clamp(current.startNote + randomInt(-7, 7), 24, 108),
    endNote: clamp(current.endNote + randomInt(-10, 10), 24, 108),
    vibratoDepth: clampFloat(current.vibratoDepth + (Math.random() - 0.5) * 0.6),
    noiseMix: clampFloat(current.noiseMix + (Math.random() - 0.5) * 0.16),
    wave: current.wave.map((value) => clamp(value + randomInt(-2, 2), 0, 15)),
  };
  selectedPresetId = current.id;
  renderAll();
  setStatus("Created a variation");
}

function saveAsCustom(): void {
  const saved = {
    ...clonePreset(current),
    id: `custom-${Date.now()}`,
    name: current.name.trim() || "Custom SFX",
  };
  customPresets = [saved, ...customPresets.filter((preset) => preset.name !== saved.name)];
  localStorage.setItem(storageKey, JSON.stringify(customPresets));
  selectedPresetId = saved.id;
  current = clonePreset(saved);
  renderAll();
  setStatus(`Saved ${saved.name}`);
}

function exportJson(): void {
  const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${slug(current.name)}.json`);
  setStatus("Exported JSON");
}

async function importJson(): Promise<void> {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()) as SfxPreset;
    current = sanitizePreset(data);
    selectedPresetId = current.id;
    renderAll();
    setStatus(`Imported ${current.name}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Import failed");
  } finally {
    fileInput.value = "";
  }
}

function exportWav(): void {
  const data = renderSamples(current, sampleRate);
  const wav = encodeWav(data, sampleRate);
  downloadBlob(new Blob([wav], { type: "audio/wav" }), `${slug(current.name)}.wav`);
  setStatus("Rendered WAV");
}

function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    view.setInt16(offset, Math.round(clampFloat(sample) * 32767), true);
    offset += 2;
  }
  return buffer;
}

function setControl(key: keyof typeof controls, value: number, label: string): void {
  controls[key][0].value = String(value);
  controls[key][1].textContent = label;
}

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function clonePreset(preset: SfxPreset): SfxPreset {
  return { ...preset, wave: [...preset.wave] };
}

function sanitizePreset(input: SfxPreset): SfxPreset {
  const fallback = starterPresets[0];
  return {
    id: input.id || `imported-${Date.now()}`,
    name: input.name || "Imported SFX",
    category: input.category || "Custom",
    description: input.description || "",
    durationMs: clamp(Math.round(input.durationMs || fallback.durationMs), 40, 1400),
    repeatCount: clamp(Math.round(input.repeatCount || 1), 1, 32),
    repeatIntervalMs: clamp(Math.round(input.repeatIntervalMs || fallback.repeatIntervalMs), 16, 180),
    startNote: clamp(Math.round(input.startNote || fallback.startNote), 24, 108),
    endNote: clamp(Math.round(input.endNote || fallback.endNote), 24, 108),
    volumeStart: clampFloat(Number(input.volumeStart ?? fallback.volumeStart)),
    volumeEnd: clampFloat(Number(input.volumeEnd ?? fallback.volumeEnd)),
    bend: ["linear", "expo", "dip", "rise-fall"].includes(input.bend) ? input.bend : fallback.bend,
    vibratoDepth: clamp(Number(input.vibratoDepth ?? fallback.vibratoDepth), 0, 3),
    vibratoRate: clamp(Number(input.vibratoRate ?? fallback.vibratoRate), 0, 40),
    retriggerHz: clamp(Number(input.retriggerHz ?? fallback.retriggerHz), 0, 60),
    noiseMix: clamp(Number(input.noiseMix ?? fallback.noiseMix), 0, 0.6),
    wave: Array.from({ length: 32 }, (_, index) => clamp(Math.round(input.wave?.[index] ?? fallback.wave[index]), 0, 15)),
  };
}

function loadCustomPresets(): SfxPreset[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    return (JSON.parse(raw) as SfxPreset[]).map(sanitizePreset);
  } catch {
    return [];
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function noteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function getTotalDurationMs(preset: SfxPreset): number {
  return preset.durationMs + Math.max(0, preset.repeatCount - 1) * preset.repeatIntervalMs;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampFloat(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function xorshift(value: number): number {
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function fadeEdges(samples: Float32Array, rate: number): void {
  const fade = Math.min(samples.length, Math.floor(rate * 0.004));
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gb-sfx";
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}
