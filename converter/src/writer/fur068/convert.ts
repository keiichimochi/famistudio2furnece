import { deflateSync } from "node:zlib";
import type { CommonChannel, CommonPattern, CommonProject } from "../../mapper/common.js";
import { BinaryWriter } from "../fur/binaryWriter.js";

const VERSION = 232;
const CHANNELS = ["GB Square1", "GB Square2", "GB Wave", "GB Noise"] as const;

type PatternRef = {
  channel: number;
  pattern: CommonPattern;
};

export function writeFur068FromCommon(project: CommonProject): Buffer {
  const w = new BinaryWriter();
  const channels = CHANNELS.map((name) => project.song.channels.find((channel) => channel.target === name) ?? emptyChannel(name));
  const patterns = collectPatterns(channels);

  w.ascii("-Furnace module-", 16);
  w.u16(VERSION);
  w.u16(0);
  w.i32(32);
  w.i32(0);
  w.i32(0);

  const pointers = writeInfo(w, project, channels, patterns);
  const instrumentPointers =
    project.instruments.length > 0
      ? project.instruments.map((instrument) => writeGbInstrument(w, instrument.name))
      : [writeGbInstrument(w, "Default")];
  const wavetablePointers = (project.wavetables ?? []).map((wavetable) => writeRawBlock(w, wavetable.block));
  const patternPointers = patterns.map((pattern) => writePattern(w, project.song.patternLength, pattern));
  const assetDirPointers = [writeAssetDir(w), writeAssetDir(w), writeAssetDir(w)];

  let cursor = pointers.instrumentPointers;
  for (const pointer of instrumentPointers) {
    w.patchI32(cursor, pointer);
    cursor += 4;
  }
  cursor = pointers.wavetablePointers;
  for (const pointer of wavetablePointers) {
    w.patchI32(cursor, pointer);
    cursor += 4;
  }
  cursor = pointers.patternPointers;
  for (const pointer of patternPointers) {
    w.patchI32(cursor, pointer);
    cursor += 4;
  }
  cursor = pointers.assetDirs;
  for (const pointer of assetDirPointers) {
    w.patchI32(cursor, pointer);
    cursor += 4;
  }

  return deflateSync(w.toBuffer());
}

function writeInfo(
  w: BinaryWriter,
  project: CommonProject,
  channels: CommonChannel[],
  patterns: PatternRef[]
): { instrumentPointers: number; wavetablePointers: number; patternPointers: number; assetDirs: number } {
  let instrumentPointers = 0;
  let wavetablePointers = 0;
  let patternPointers = 0;
  let assetDirs = 0;
  w.block("INFO", () => {
    w.u8(0); // time base
    w.u8(Math.max(1, project.song.speed));
    w.u8(Math.max(1, project.song.speed));
    w.u8(1); // arp speed
    w.f32(60);
    w.u16(Math.min(project.song.patternLength, 256));
    w.u16(Math.min(project.song.ordersLength, 256));
    w.u8(4);
    w.u8(16);
    const instrumentCount = Math.max(1, project.instruments.length);
    w.u16(instrumentCount);
    w.u16(project.wavetables?.length ?? 0);
    w.u16(0);
    w.i32(patterns.length);

    w.u8(0x04);
    for (let i = 1; i < 32; i++) w.u8(0);
    w.u8(64);
    for (let i = 1; i < 32; i++) w.u8(0);
    for (let i = 0; i < 32; i++) w.u8(0);
    for (let i = 0; i < 32; i++) w.i32(0);

    w.string(project.song.name || project.name);
    w.string(project.author);
    w.f32(440);
    writeZeros(w, 20);

    instrumentPointers = w.tell();
    for (let i = 0; i < Math.max(1, project.instruments.length); i++) w.i32(0);
    wavetablePointers = w.tell();
    for (let i = 0; i < (project.wavetables?.length ?? 0); i++) w.i32(0);
    patternPointers = w.tell();
    for (let i = 0; i < patterns.length; i++) w.i32(0);

    const ordersLength = Math.min(project.song.ordersLength, 256);
    for (const channel of channels) {
      for (let order = 0; order < ordersLength; order++) {
        w.u8(channel.order[order] ?? 0);
      }
    }
    for (let i = 0; i < 4; i++) w.u8(1);
    for (let i = 0; i < 4; i++) w.u8(1);
    for (let i = 0; i < 4; i++) w.u8(0);
    for (const channel of channels) w.string(channel.target);
    for (const channel of channels) w.string(shortChannelName(channel.target));
    w.string(project.warnings.join("\n"));
    w.f32(1);
    writeZeros(w, 28);
    w.u16(project.song.tempo || 150);
    w.u16(150);
    w.string(project.song.name || project.name);
    w.string("");
    w.u8(0);
    writeZeros(w, 3);
    w.string("Game Boy");
    w.string(project.name);
    w.string("");
    w.string("");
    w.string("");
    w.string("");
    w.f32(1);
    w.f32(0);
    w.f32(0);
    w.i32(0);
    w.u8(1);
    writeZeros(w, 8);
    w.u8(1);
    w.u8(Math.max(1, project.song.speed));
    for (let i = 1; i < 16; i++) w.u8(0);
    w.u8(0);
    assetDirs = w.tell();
    w.i32(0);
    w.i32(0);
    w.i32(0);
  });
  return { instrumentPointers, wavetablePointers, patternPointers, assetDirs };
}

function writeGbInstrument(w: BinaryWriter, name: string): number {
  return w.block("INS2", () => {
    w.u16(VERSION);
    w.u16(2);
    writeFeature(w, "NA", () => w.string(name));
    writeFeature(w, "GB", () => {
      w.u8(0x0f);
      w.u8(64);
      w.u8(0x02);
      w.u8(0);
    });
    w.ascii("EN", 2);
  });
}

function writePattern(w: BinaryWriter, patternLength: number, ref: PatternRef): number {
  return w.block("PATN", () => {
    w.u8(0);
    w.u8(ref.channel);
    w.u16(ref.pattern.index);
    w.string(ref.pattern.name);
    const rows = buildRowsWithNoteOffs(ref.pattern.rows, Math.min(patternLength, 256));
    let emptyRows = 0;
    const flushEmpty = () => {
      while (emptyRows > 0) {
        if (emptyRows === 1) {
          w.u8(0);
          emptyRows = 0;
        } else {
          const chunk = Math.min(emptyRows, 128);
          w.u8(0x80 | (chunk - 2));
          emptyRows -= chunk;
        }
      }
    };
    for (let rowIndex = 0; rowIndex < Math.min(patternLength, 256); rowIndex++) {
      const row = rows.get(rowIndex);
      if (!row) {
        emptyRows++;
        continue;
      }
      flushEmpty();
      let mask = 0;
      if (row.note !== undefined) mask |= 1;
      if (row.instrument !== undefined) mask |= 2;
      if (row.volume !== undefined) mask |= 4;
      const effect = row.effects?.[0];
      if (effect?.effect !== undefined) mask |= 8;
      if (effect?.value !== undefined) mask |= 16;
      w.u8(mask);
      if (row.note !== undefined) w.u8(row.note);
      if (row.instrument !== undefined) w.u8(row.instrument);
      if (row.volume !== undefined) w.u8(row.volume);
      if (effect?.effect !== undefined) w.u8(effect.effect);
      if (effect?.value !== undefined) w.u8(effect.value);
    }
    flushEmpty();
    w.u8(0xff);
  });
}

function buildRowsWithNoteOffs(rows: CommonPattern["rows"], patternLength: number): Map<number, CommonPattern["rows"][number]> {
  const result = new Map<number, CommonPattern["rows"][number]>();
  const musicalRows = new Set<number>();
  for (const row of rows) {
    const existing = result.get(row.row);
    result.set(row.row, existing ? mergeRow(existing, row) : row);
    if (row.note !== undefined && row.note >= 0 && row.note < 180) musicalRows.add(row.row);
  }
  for (const row of rows) {
    if (row.duration === undefined || row.note === undefined || row.note >= 180) continue;
    const endRow = row.row + row.duration;
    if (endRow <= row.row || endRow >= patternLength) continue;
    if (musicalRows.has(endRow)) continue;
    const existing = result.get(endRow);
    const noteOff = {
      row: endRow,
      note: 180,
      instrument: existing?.instrument,
      volume: existing?.volume,
      effects: existing?.effects,
      source: row.source
    };
    result.set(endRow, existing ? mergeRow(existing, noteOff) : noteOff);
  }
  return result;
}

function mergeRow(
  base: CommonPattern["rows"][number],
  next: CommonPattern["rows"][number]
): CommonPattern["rows"][number] {
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

function writeFeature(w: BinaryWriter, code: string, body: () => void): void {
  w.ascii(code, 2);
  const offset = w.tell();
  w.u16(0);
  const start = w.tell();
  body();
  w.patchU16(offset, w.tell() - start);
}

function writeAssetDir(w: BinaryWriter): number {
  return w.block("ADIR", () => w.i32(0));
}

function writeRawBlock(w: BinaryWriter, block: Buffer): number {
  const pointer = w.tell();
  w.bytes(block);
  return pointer;
}

function collectPatterns(channels: CommonChannel[]): PatternRef[] {
  return channels.flatMap((channel, channelIndex) => {
    const used = new Set(channel.order);
    return channel.patterns.filter((pattern) => used.has(pattern.index)).map((pattern) => ({ channel: channelIndex, pattern }));
  });
}

function emptyChannel(name: CommonChannel["target"]): CommonChannel {
  return { source: name, target: name, order: [0], patterns: [{ index: 0, name: "Empty", rows: [] }] };
}

function shortChannelName(name: string): string {
  return name.replace("GB ", "").replace("Square", "Sq");
}

function writeZeros(w: BinaryWriter, count: number): void {
  for (let i = 0; i < count; i++) w.u8(0);
}
