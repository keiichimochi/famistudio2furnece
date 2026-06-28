export type FurHeader = {
  magic: string;
  version: number;
  infoPointer: number;
};

export type FurInstrumentSummary = {
  index: number;
  pointer: number;
  blockId: string;
  size: number;
  version?: number;
  type?: number;
  name?: string;
};

export type FurPatternSummary = {
  index: number;
  pointer: number;
  blockId: string;
  size: number;
  subsong: number;
  channel: number;
  patternIndex: number;
  name: string;
  rowsDecoded: number;
};

export type FurInfoSummary = {
  blockId: "INFO";
  size: number;
  timeBase: number;
  speed1: number;
  speed2: number;
  arpSpeed: number;
  ticksPerSecond: number;
  patternLength: number;
  ordersLength: number;
  highlightA: number;
  highlightB: number;
  instrumentCount: number;
  wavetableCount: number;
  sampleCount: number;
  patternCount: number;
  chipIds: number[];
  channelCount: number;
  songName: string;
  songAuthor: string;
  systemName: string;
  category: string;
  orders: number[][];
  effectColumns: number[];
  instrumentPointers: number[];
  wavetablePointers: number[];
  samplePointers: number[];
  patternPointers: number[];
};

export type FurModuleSummary = {
  header: FurHeader;
  info: FurInfoSummary;
  instruments: FurInstrumentSummary[];
  patterns: FurPatternSummary[];
  eofOk: boolean;
  warnings: string[];
};
