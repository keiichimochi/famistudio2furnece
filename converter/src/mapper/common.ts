import type { FmsChannel, FmsInstrument, FmsNote, FmsPattern, FmsProject, FmsSong } from "../parser/fms/types.js";

export type CommonNote = {
  row: number;
  note: number;
  instrument?: number;
  duration?: number;
  volume?: number;
  source: FmsNote;
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
  channels: CommonChannel[];
};

export type CommonProject = {
  name: string;
  author: string;
  instruments: CommonInstrument[];
  song: CommonSong;
  warnings: string[];
};

const channelMap: Record<string, CommonChannel["target"] | undefined> = {
  Square1: "GB Square1",
  Square2: "GB Square2",
  Triangle: "GB Wave",
  Noise: "GB Noise"
};

export function fmsToCommonProject(project: FmsProject, songIndex = 0): CommonProject {
  const song = project.songs[songIndex];
  if (!song) throw new Error(`Song index ${songIndex} does not exist.`);

  const warnings = [...project.warnings];
  const instruments = buildInstruments(project.instruments);
  const instrumentById = new Map<number, number>();
  project.instruments.forEach((instrument, index) => {
    if (instrument.id !== undefined) instrumentById.set(instrument.id, index);
  });

  const channels = song.channels
    .filter((channel) => channel.name !== "DPCM")
    .map((channel) => mapChannel(channel, instrumentById, warnings))
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
      patternLength: Math.min(song.tempo.patternLength || 64, 256),
      ordersLength: song.length,
      speed: mapFamiStudioSpeed(song),
      tempo: song.tempo.famitrackerTempo || 150,
      channels
    },
    warnings
  };
}

function mapFamiStudioSpeed(song: FmsSong): number {
  const base = Math.max(1, song.tempo.groove[0] ?? song.tempo.noteLength ?? song.tempo.famitrackerSpeed ?? 6);
  if (song.tempo.mode !== "FamiStudio" || !song.tempo.noteLength) return base;
  const beatScale = Math.max(1, Math.round(song.tempo.beatLength / song.tempo.noteLength));
  return Math.min(255, base * beatScale);
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
  warnings: string[]
): CommonChannel | null {
  const target = channelMap[channel.name];
  if (!target) {
    warnings.push(`Channel ${channel.name} is not mapped to Game Boy in Phase 3.`);
    return null;
  }

  const patternIndexById = new Map<number, number>();
  channel.patterns.forEach((pattern, index) => {
    if (pattern.id !== undefined) patternIndexById.set(pattern.id, index);
  });

  return {
    source: channel.name,
    target,
    order: channel.order.map((patternId) => {
      if (patternId === null) return 0;
      return patternIndexById.get(patternId) ?? 0;
    }),
    patterns: channel.patterns.map((pattern, index) => mapPattern(pattern, index, instrumentById, warnings))
  };
}

function mapPattern(
  pattern: FmsPattern,
  index: number,
  instrumentById: Map<number, number>,
  warnings: string[]
): CommonPattern {
  return {
    index,
    name: pattern.name || `Pattern ${index}`,
    rows: pattern.notes
      .map((note) => mapNote(note, instrumentById, warnings))
      .filter((note): note is CommonNote => note !== null)
  };
}

function mapNote(note: FmsNote, instrumentById: Map<number, number>, warnings: string[]): CommonNote | null {
  if (note.value === 0xff) return null;

  let mappedNote: number;
  if (note.value === 0) {
    mappedNote = 180;
  } else if (note.value === 0x80) {
    mappedNote = 181;
  } else if (note.value >= 1 && note.value <= 0x60) {
    mappedNote = note.value + 59;
  } else {
    warnings.push(`Unsupported FamiStudio note value ${note.value} at row ${note.time}; skipped.`);
    return null;
  }

  const instrument = note.instrumentId === undefined ? 0 : instrumentById.get(note.instrumentId) ?? 0;
  const volume = typeof note.effects.volume === "number" ? Math.max(0, Math.min(15, note.effects.volume)) : undefined;
  const unsupportedEffects = Object.keys(note.effects).filter((effect) => effect !== "volume");
  for (const effect of unsupportedEffects) {
    addWarning(warnings, `Effect ${effect} is parsed but not converted in this minimal .fur export.`);
  }

  const duration = note.duration && note.duration > 0 ? note.duration : undefined;
  return { row: note.time, note: mappedNote, instrument, duration, volume, source: note };
}

function addWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}
