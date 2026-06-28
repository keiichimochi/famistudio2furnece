import type { FmsChannel, FmsInstrument, FmsNote, FmsPattern, FmsProject, FmsSong } from "../parser/fms/types.js";

export type CommonNote = {
  row: number;
  note?: number;
  instrument?: number;
  duration?: number;
  volume?: number;
  effects?: CommonEffect[];
  source: FmsNote;
};

export type CommonEffect = {
  effect: number;
  value: number;
};

export type CommonPattern = {
  index: number;
  name: string;
  rows: CommonNote[];
};

export type CommonChannel = {
  source: string;
  target: "GB Square1" | "GB Square2" | "GB Wave" | "GB Noise";
  order: number[];
  patterns: CommonPattern[];
};

export type CommonInstrument = {
  index: number;
  name: string;
  source: FmsInstrument;
};

export type CommonSong = {
  name: string;
  author: string;
  patternLength: number;
  ordersLength: number;
  speed: number;
  tempo: number;
  rowScale: number;
  channels: CommonChannel[];
};

export type CommonWavetable = {
  name: string;
  block: Buffer;
};

export type CommonProject = {
  name: string;
  author: string;
  instruments: CommonInstrument[];
  wavetables?: CommonWavetable[];
  song: CommonSong;
  warnings: string[];
};

const channelMap: Record<string, CommonChannel["target"] | undefined> = {
  Square1: "GB Square1",
  Square2: "GB Square2",
  Triangle: "GB Wave",
  Noise: "GB Noise"
};
const FMS_NOTE_TO_FURNACE_OFFSET = 71;
const FURNACE_EFFECT_VIBRATO = 0x04;
const FURNACE_EFFECT_VOLUME_SLIDE = 0x0a;
const FURNACE_EFFECT_DUTY = 0x12;
const FURNACE_EFFECT_PITCH = 0xe5;
const CONVERTED_EFFECTS = new Set(["volume", "finePitch", "vibrato", "volumeSlide", "dutyCycle"]);

export type FmsToCommonOptions = {
  /**
   * Number of FamiStudio time units represented by one Furnace row.
   * Use 1 to preserve frame-level timing exactly. Use higher values only
   * when intentionally quantizing tracker rows.
   */
  rowScale?: number;
};

export function fmsToCommonProject(project: FmsProject, songIndex = 0, options: FmsToCommonOptions = {}): CommonProject {
  const song = project.songs[songIndex];
  if (!song) throw new Error(`Song index ${songIndex} does not exist.`);

  const warnings = [...project.warnings];
  const instruments = buildInstruments(project.instruments);
  const instrumentById = new Map<number, number>();
  project.instruments.forEach((instrument, index) => {
    if (instrument.id !== undefined) instrumentById.set(instrument.id, index);
  });
  const rowScale = options.rowScale ?? mapFamiStudioRowScale(song);
  const patternLength = Math.min(Math.max(1, Math.ceil((song.tempo.patternLength || 64) / rowScale)), 256);

  const channels = song.channels
    .filter((channel) => channel.name !== "DPCM")
    .map((channel) => mapChannel(channel, instrumentById, warnings, rowScale, patternLength))
    .filter((channel): channel is CommonChannel => channel !== null);

  if (song.channels.some((channel) => channel.name === "DPCM")) {
    warnings.push("DPCM channel is muted in the Phase 3 NES to Game Boy mapping.");
  }

  return {
    name: project.name,
    author: project.author ?? "",
    instruments,
    song: {
      name: song.name,
      author: project.author ?? "",
      patternLength,
      ordersLength: song.length,
      speed: mapFamiStudioSpeed(song, rowScale),
      tempo: song.tempo.famitrackerTempo || 150,
      rowScale,
      channels
    },
    warnings
  };
}

function mapFamiStudioSpeed(song: FmsSong, rowScale: number): number {
  if (song.tempo.mode === "FamiStudio") return Math.max(1, rowScale);
  return Math.max(1, song.tempo.famitrackerSpeed ?? 6);
}

function mapFamiStudioRowScale(_song: FmsSong): number {
  return 1;
}

function buildInstruments(instruments: FmsInstrument[]): CommonInstrument[] {
  if (instruments.length === 0) {
    return [{ index: 0, name: "Default", source: { name: "Default", envelopes: [], dpcmMappings: [] } }];
  }
  return instruments.map((instrument, index) => ({
    index,
    name: instrument.name || `Instrument ${index}`,
    source: instrument
  }));
}

function mapChannel(
  channel: FmsChannel,
  instrumentById: Map<number, number>,
  warnings: string[],
  rowScale: number,
  patternLength: number
): CommonChannel | null {
  const target = channelMap[channel.name];
  if (!target) {
    warnings.push(`Channel ${channel.name} is not mapped to Game Boy in Phase 3.`);
    return null;
  }

  const hasEmptyOrderSlot = channel.order.some((patternId) => patternId === null);
  const patternIndexOffset = hasEmptyOrderSlot ? 1 : 0;
  const patternIndexById = new Map<number, number>();
  channel.patterns.forEach((pattern, index) => {
    if (pattern.id !== undefined) patternIndexById.set(pattern.id, index + patternIndexOffset);
  });

  const patterns = channel.patterns.map((pattern, index) =>
    mapPattern(pattern, index + patternIndexOffset, instrumentById, warnings, rowScale, target)
  );
  if (hasEmptyOrderSlot) {
    patterns.unshift({ index: 0, name: "Empty", rows: [] });
  }
  const order = channel.order.map((patternId) => {
    if (patternId === null) return 0;
    return patternIndexById.get(patternId) ?? 0;
  });

  const commonChannel: CommonChannel = {
    source: channel.name,
    target,
    order,
    patterns
  };
  return commonChannel;
}

function mapPattern(
  pattern: FmsPattern,
  index: number,
  instrumentById: Map<number, number>,
  warnings: string[],
  rowScale: number,
  target: CommonChannel["target"]
): CommonPattern {
  const rows: CommonNote[] = [];

  for (const fmsNote of pattern.notes) {
    const row = mapNote(fmsNote, instrumentById, warnings, rowScale);
    if (!row) continue;
    rows.push(row);
  }

  return {
    index,
    name: pattern.name || `Pattern ${index}`,
    rows: mergeRows(rows)
  };
}

function mapNote(
  note: FmsNote,
  instrumentById: Map<number, number>,
  warnings: string[],
  rowScale: number
): CommonNote | null {
  const row = Math.max(0, Math.round(note.time / rowScale));
  const volume = typeof note.effects.volume === "number" ? Math.max(0, Math.min(15, note.effects.volume)) : undefined;
  const effects = mapEffects(note.effects);
  const unsupportedEffects = Object.keys(note.effects).filter((effect) => !CONVERTED_EFFECTS.has(effect));
  for (const effect of unsupportedEffects) {
    addWarning(warnings, `Effect ${effect} is parsed but not converted in this minimal .fur export.`);
  }

  if (note.value === 0xff) {
    return volume === undefined && effects.length === 0 ? null : { row, volume, effects, source: note };
  }

  let mappedNote: number;
  if (note.value === 0) {
    mappedNote = 180;
  } else if (note.value === 0x80) {
    mappedNote = 181;
  } else if (note.value >= 1 && note.value <= 0x60) {
    mappedNote = note.value + FMS_NOTE_TO_FURNACE_OFFSET;
  } else {
    warnings.push(`Unsupported FamiStudio note value ${note.value} at row ${note.time}; skipped.`);
    return null;
  }

  const instrument = note.instrumentId === undefined ? 0 : instrumentById.get(note.instrumentId) ?? 0;

  const duration =
    note.duration && note.duration > 0 ? Math.max(1, Math.round((note.time + note.duration) / rowScale) - row) : undefined;
  return { row, note: mappedNote, instrument, duration, volume, effects, source: note };
}

function mapEffects(effects: FmsNote["effects"]): CommonEffect[] {
  const mapped: CommonEffect[] = [];
  if (typeof effects.finePitch === "number") {
    const value = Math.max(0, Math.min(255, 0x80 + effects.finePitch * 2));
    mapped.push({ effect: FURNACE_EFFECT_PITCH, value });
  }
  if (typeof effects.vibrato === "number") {
    mapped.push({ effect: FURNACE_EFFECT_VIBRATO, value: Math.max(0, Math.min(255, effects.vibrato)) });
  }
  if (typeof effects.volumeSlide === "number") {
    mapped.push({ effect: FURNACE_EFFECT_VOLUME_SLIDE, value: Math.max(0, Math.min(255, effects.volumeSlide)) });
  }
  if (typeof effects.dutyCycle === "number") {
    mapped.push({ effect: FURNACE_EFFECT_DUTY, value: Math.max(0, Math.min(3, effects.dutyCycle)) });
  }
  return mapped;
}

function mergeRows(rows: CommonNote[]): CommonNote[] {
  const merged = new Map<number, CommonNote>();
  for (const row of rows) {
    const existing = merged.get(row.row);
    if (!existing) {
      merged.set(row.row, row);
      continue;
    }
    merged.set(row.row, mergeRow(existing, row));
  }
  return [...merged.values()].sort((a, b) => a.row - b.row);
}

function mergeRow(base: CommonNote, next: CommonNote): CommonNote {
  return {
    row: base.row,
    note: next.note ?? base.note,
    instrument: next.instrument ?? base.instrument,
    duration: next.duration ?? base.duration,
    volume: next.volume ?? base.volume,
    effects: next.effects?.length ? next.effects : base.effects,
    source: next.source
  };
}

function addWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}
