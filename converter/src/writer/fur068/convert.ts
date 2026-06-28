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
  const instrumentPointers = [writeGbInstrument(w, "Default")];
  const patternPointers = patterns.map((pattern) => writePattern(w, project.song.patternLength, pattern));
  const assetDirPointers = [writeAssetDir(w), writeAssetDir(w), writeAssetDir(w)];

  let cursor = pointers.instrumentPointers;
  for (const pointer of instrumentPointers) {
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
): { instrumentPointers: number; patternPointers: number; assetDirs: number } {
  let instrumentPointers = 0;
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
    w.u16(1);
    w.u16(0);
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
    w.i32(0);
    patternPointers = w.tell();
    for (let i = 0; i < patterns.length; i++) w.i32(0);

    const ordersLength = Math.min(project.song.ordersLength, 256);
    for (const channel of channels) {
      for (let i = 0; i < ordersLength; i++) w.u8(channel.order[i] ?? 0);
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
  return { instrumentPointers, patternPointers, assetDirs };
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
    const rows = new Map(ref.pattern.rows.map((row) => [row.row, row]));
    let emptyRows = 0;
    const flushEmpty = () => {
      while (emptyRows > 0) {
        if (emptyRows === 1) {
          w.u8(0);
          emptyRows = 0;
        } else {
          const chunk = Math.min(emptyRows, 129);
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
      mask |= 2;
      if (row.volume !== undefined) mask |= 4;
      w.u8(mask);
      if (row.note !== undefined) w.u8(row.note);
      w.u8(0);
      if (row.volume !== undefined) w.u8(row.volume);
    }
    flushEmpty();
    w.u8(0xff);
  });
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
