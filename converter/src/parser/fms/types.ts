export type FmsEnvelope = {
  type: string;
  length: number;
  loop: number;
  release: number;
  relative: boolean;
  values: number[];
};

export type FmsInstrument = {
  id?: number;
  name: string;
  expansion?: string;
  folder?: string;
  envelopes: FmsEnvelope[];
  dpcmMappings: FmsDpcmMapping[];
};

export type FmsDpcmSample = {
  id?: number;
  name: string;
  folder?: string;
  bank?: number;
  source: "dmc" | "wav" | "unknown";
  dataLength: number;
};

export type FmsDpcmMapping = {
  note: number | string;
  sample?: number | string;
  pitch: number;
  loop: boolean;
};

export type FmsEffectValue = number | boolean | null;

export type FmsNote = {
  time: number;
  value: number;
  flags: number;
  slide: number;
  instrumentId?: number;
  duration?: number;
  release?: number;
  effectMask: number;
  effects: Record<string, FmsEffectValue>;
  arpeggioId?: number;
};

export type FmsPattern = {
  id?: number;
  name: string;
  channelType?: number;
  channel: string;
  notes: FmsNote[];
};

export type FmsChannel = {
  type: number;
  name: string;
  patterns: FmsPattern[];
  order: Array<number | null>;
};

export type FmsTempo = {
  mode: "FamiStudio" | "FamiTracker" | "Unknown";
  patternLength: number;
  beatLength: number;
  famitrackerTempo: number;
  famitrackerSpeed: number;
  noteLength?: number;
  groove: number[];
  groovePaddingMode?: number;
};

export type FmsSong = {
  id?: number;
  name: string;
  length: number;
  loopPoint: number;
  tempo: FmsTempo;
  channels: FmsChannel[];
};

export type FmsProject = {
  format: "binary-fms" | "text-fms";
  version?: number;
  name: string;
  author?: string;
  copyright?: string;
  pal: boolean;
  expansionMask: number;
  instruments: FmsInstrument[];
  dpcmSamples: FmsDpcmSample[];
  songs: FmsSong[];
  warnings: string[];
};
