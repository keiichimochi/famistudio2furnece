import type { CommonChannel, CommonPattern, CommonProject } from "../../mapper/common.js";
import { BinaryWriter } from "./binaryWriter.js";

const FURNACE_VERSION = 240;
const CHANNELS = ["GB Square1", "GB Square2", "GB Wave", "GB Noise"] as const;

export function writeFur(project: CommonProject): Buffer {
  const w = new BinaryWriter();
  const channels = CHANNELS.map((name) => project.song.channels.find((channel) => channel.target === name) ?? emptyChannel(name));
  const patterns = collectPatterns(channels);

  w.ascii("-Furnace module-", 16);
  w.u16(FURNACE_VERSION);
  w.u16(0);
  w.i32(32);
  w.i32(0);
  w.i32(0);

  const pointerPatches: Array<{ offset: number; values: number[] }> = [];

  w.block("INF2", () => {
    w.string(project.song.name || project.name);
    w.string(project.author);
    w.string("Game Boy");
    w.string(project.name);
    w.string("");
    w.string("");
    w.string("");
    w.string("");
    w.f32(440);
    w.u8(1);

    w.f32(1);
    w.u16(4);
    w.u16(1);
    w.u16(0x04);
    w.u16(4);
    w.f32(1);
    w.f32(0);
    w.f32(0);

    w.i32(0);
    w.u8(1);

    writePointerList(w, pointerPatches, 0x01, 1);
    writePointerList(w, pointerPatches, 0x04, project.instruments.length);
    writePointerList(w, pointerPatches, 0x07, patterns.length);
    w.u8(0);
  });

  const sng2Pointer = writeSubsong(w, project, channels);
  pointerPatches[0]!.values.push(sng2Pointer);

  const instrumentPointers = project.instruments.map((instrument) => writeInstrument(w, instrument.name));
  pointerPatches[1]!.values.push(...instrumentPointers);

  const patternPointers = patterns.map((entry) => writePattern(w, project.song.patternLength, entry.channelIndex, entry.pattern));
  pointerPatches[2]!.values.push(...patternPointers);

  for (const patch of pointerPatches) {
    patch.values.forEach((value, index) => w.patchI32(patch.offset + index * 4, value));
  }

  return w.toBuffer();
}

function writePointerList(
  w: BinaryWriter,
  patches: Array<{ offset: number; values: number[] }>,
  elementType: number,
  count: number
): void {
  w.u8(elementType);
  w.i32(count);
  const offset = w.tell();
  for (let i = 0; i < count; i++) w.i32(0);
  patches.push({ offset, values: [] });
}

function writeSubsong(w: BinaryWriter, project: CommonProject, channels: CommonChannel[]): number {
  return w.block("SNG2", () => {
    const patternLength = Math.min(project.song.patternLength, 256);
    const ordersLength = Math.min(project.song.ordersLength, 256);
    w.f32(60);
    w.u8(1);
    w.u8(1);
    w.u16(patternLength);
    w.u16(ordersLength);
    w.u8(4);
    w.u8(16);
    w.u16(Math.max(1, project.song.tempo));
    w.u16(150);
    w.u8(1);
    for (let i = 0; i < 16; i++) w.u16(i === 0 ? project.song.speed : 0);
    w.string(project.song.name);
    w.string(project.warnings.join("\n"));

    for (const channel of channels) {
      for (let i = 0; i < ordersLength; i++) w.u8(channel.order[i] ?? 0);
    }
    for (let i = 0; i < 4; i++) w.u8(1);
    for (let i = 0; i < 4; i++) w.u8(1);
    for (let i = 0; i < 4; i++) w.u8(0);
    for (const channel of channels) w.string(channel.target);
    for (const channel of channels) w.string(shortChannelName(channel.target));
    for (let i = 0; i < 4; i++) w.i32(0);
  });
}

function writeInstrument(w: BinaryWriter, name: string): number {
  return w.block("INS2", () => {
    w.u16(FURNACE_VERSION);
    w.u8(2);
    w.u8(0);
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

function writeFeature(w: BinaryWriter, code: string, writeBody: () => void): void {
  w.ascii(code, 2);
  const sizeOffset = w.tell();
  w.u16(0);
  const start = w.tell();
  writeBody();
  const size = w.tell() - start;
  w.patchU16(sizeOffset, size);
}

function writePattern(w: BinaryWriter, patternLength: number, channelIndex: number, pattern: CommonPattern): number {
  return w.block("PATN", () => {
    w.u8(0);
    w.u8(channelIndex);
    w.u16(pattern.index);
    w.string(pattern.name);
    const notesByRow = new Map(pattern.rows.map((row) => [row.row, row]));
    let emptyRows = 0;
    const maxRow = Math.min(patternLength, 256);

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

    for (let row = 0; row < maxRow; row++) {
      const note = notesByRow.get(row);
      if (!note) {
        emptyRows++;
        continue;
      }
      flushEmpty();
      let mask = 0x01 | 0x02;
      if (note.volume !== undefined) mask |= 0x04;
      w.u8(mask);
      w.u8(note.note);
      w.u8(note.instrument);
      if (note.volume !== undefined) w.u8(note.volume);
    }
    flushEmpty();
    w.u8(0xff);
  });
}

function collectPatterns(channels: CommonChannel[]): Array<{ channelIndex: number; pattern: CommonPattern }> {
  return channels.flatMap((channel, channelIndex) => {
    const used = new Set(channel.order);
    return channel.patterns.filter((pattern) => used.has(pattern.index)).map((pattern) => ({ channelIndex, pattern }));
  });
}

function emptyChannel(name: CommonChannel["target"]): CommonChannel {
  return {
    source: name,
    target: name,
    order: [0],
    patterns: [{ index: 0, name: "Empty", rows: [] }]
  };
}

function shortChannelName(name: string): string {
  return name.replace("GB ", "").replace("Square", "Sq");
}
