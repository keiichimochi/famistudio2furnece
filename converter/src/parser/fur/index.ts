import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { FurBinaryReader } from "./binaryReader.js";
import type { FurInfoSummary, FurInstrumentSummary, FurModuleSummary, FurPatternSummary } from "./types.js";

const MAGIC = "-Furnace module-";
const TARGET_VERSION = 232;
const CHIP_CHANNELS = new Map<number, number>([
  [0x03, 4],
  [0x04, 4],
  [0x05, 6],
  [0x06, 5],
  [0x80, 3],
  [0x81, 4],
  [0x82, 8],
  [0x83, 6],
  [0x87, 8],
  [0x88, 3],
  [0x89, 9],
  [0x8a, 1],
  [0x8b, 3],
  [0x8c, 8],
  [0x94, 4],
  [0x96, 4],
  [0xa8, 4],
  [0xd7, 2],
  [0xd8, 16]
]);

export async function readFurFile(path: string): Promise<FurModuleSummary> {
  return readFurBuffer(await readFile(path));
}

export async function readFurDocument(path: string): Promise<{ module: FurModuleSummary; data: Buffer; compressed: boolean }> {
  const input = await readFile(path);
  const normalized = normalizeFurBuffer(input);
  return {
    module: readFurBuffer(input),
    data: normalized,
    compressed: normalized !== input
  };
}

export function readFurBuffer(input: Buffer): FurModuleSummary {
  const buffer = normalizeFurBuffer(input);
  const reader = new FurBinaryReader(buffer);
  const magic = reader.ascii(16);
  if (magic !== MAGIC) throw new Error(`Invalid Furnace magic: ${magic}`);

  const version = reader.u16();
  reader.u16();
  const infoPointer = reader.u32();
  reader.u32();
  reader.u32();

  const warnings: string[] = [];
  if (version !== TARGET_VERSION) {
    warnings.push(`Format version is ${version}; target Furnace 0.6.8.x parser expects ${TARGET_VERSION}.`);
  }

  const info = readInfo(reader.fork(infoPointer), version, warnings);
  const instruments = info.instrumentPointers.map((pointer, index) => readInstrument(reader.fork(pointer), index, pointer, version, warnings));
  const patterns = info.patternPointers.map((pointer, index) =>
    readPattern(reader.fork(pointer), index, pointer, version, info.patternLength, warnings)
  );
  const eofOk = [...info.instrumentPointers, ...info.patternPointers].every((pointer) => pointer >= 0 && pointer < buffer.length);

  return {
    header: { magic, version, infoPointer },
    info,
    instruments,
    patterns,
    eofOk,
    warnings
  };
}

export function formatFurDump(module: FurModuleSummary): string {
  const lines = [
    `Version : ${module.header.version}`,
    `Info Header : ${module.info.blockId}`,
    `Song Name : ${module.info.songName}`,
    `Author : ${module.info.songAuthor}`,
    `System : ${module.info.systemName || module.info.chipIds.map((id) => `0x${id.toString(16)}`).join(",")}`,
    `Channels : ${module.info.channelCount}`,
    `Orders : ${module.info.ordersLength}`,
    `Pattern Length : ${module.info.patternLength}`,
    `Patterns : ${module.info.patternCount}`,
    `Instruments : ${module.info.instrumentCount}`,
    `Samples : ${module.info.sampleCount}`,
    `Wavetables : ${module.info.wavetableCount}`,
    `EOF OK : ${module.eofOk ? "yes" : "no"}`
  ];

  if (module.instruments.length > 0) {
    lines.push("Instrument List :");
    for (const instrument of module.instruments) {
      const name = instrument.name ? ` ${instrument.name}` : "";
      lines.push(`- ${instrument.index}: type=${instrument.type ?? "?"}${name}`);
    }
  }

  if (module.patterns.length > 0) {
    lines.push("Pattern List :");
    for (const pattern of module.patterns) {
      const name = pattern.name ? ` ${pattern.name}` : "";
      lines.push(`- ${pattern.index}: ch=${pattern.channel} pat=${pattern.patternIndex} rows=${pattern.rowsDecoded}${name}`);
    }
  }

  if (module.warnings.length > 0) {
    lines.push("Warnings :");
    for (const warning of module.warnings) lines.push(`- ${warning}`);
  }

  return lines.join("\n");
}

function normalizeFurBuffer(input: Buffer): Buffer {
  if (input.subarray(0, 16).toString("ascii") === MAGIC) return input;
  try {
    const inflated = inflateSync(input);
    if (inflated.subarray(0, 16).toString("ascii") === MAGIC) return inflated;
  } catch {
    // Not zlib-compressed.
  }
  return input;
}

export function normalizeFurData(input: Buffer): Buffer {
  return normalizeFurBuffer(input);
}

function readInfo(reader: FurBinaryReader, version: number, warnings: string[]): FurInfoSummary {
  const blockId = reader.ascii(4);
  if (blockId !== "INFO") throw new Error(`Invalid info header for Furnace 0.6.8.x: expected INFO, got ${blockId}`);
  const size = reader.u32();
  const timeBase = reader.u8();
  const speed1 = reader.u8();
  const speed2 = reader.u8();
  const arpSpeed = reader.u8();
  const ticksPerSecond = reader.f32();
  const patternLength = reader.u16();
  const ordersLength = reader.u16();
  const highlightA = reader.u8();
  const highlightB = reader.u8();
  const instrumentCount = reader.u16();
  const wavetableCount = reader.u16();
  const sampleCount = reader.u16();
  const patternCount = reader.u32();
  const chipIds = readChipIds(reader);
  reader.skip(32); // legacy chip volumes
  reader.skip(32); // legacy chip panning
  reader.skip(128); // chip flag pointers
  const songName = reader.string();
  const songAuthor = reader.string();
  reader.f32(); // tuning
  reader.skip(20); // compatibility flags through >=69
  const instrumentPointers = readPointers(reader, instrumentCount);
  const wavetablePointers = readPointers(reader, wavetableCount);
  const samplePointers = readPointers(reader, sampleCount);
  const patternPointers = readPointers(reader, patternCount);
  const channelCount = chipIds.reduce((sum, chipId) => sum + (CHIP_CHANNELS.get(chipId) ?? 0), 0);
  if (channelCount === 0) warnings.push("Could not infer channel count from chip IDs.");
  const orders = readOrders(reader, channelCount, ordersLength);
  const effectColumns = readBytes(reader, channelCount);
  reader.skip(channelCount); // channel hide
  reader.skip(channelCount); // channel collapse
  for (let i = 0; i < channelCount; i++) reader.string();
  for (let i = 0; i < channelCount; i++) reader.string();
  reader.string(); // song comment
  reader.f32(); // master volume
  reader.skip(28); // extended compatibility flags through >=130
  reader.u16(); // virtual tempo numerator
  reader.u16(); // virtual tempo denominator
  reader.string(); // first subsong name
  reader.string(); // first subsong comment
  const additionalSubsongs = reader.u8();
  reader.skip(3 + additionalSubsongs * 4);
  const systemName = reader.string();
  const category = reader.string();
  reader.string();
  reader.string();
  reader.string();
  reader.string();

  if (version >= 135) {
    for (const _chipId of chipIds) {
      reader.f32();
      reader.f32();
      reader.f32();
    }
    const patchbayCount = reader.u32();
    reader.skip(patchbayCount * 4);
  }
  if (version >= 136) reader.u8();
  if (version >= 138) reader.u8();
  if (version >= 155) reader.u8();
  if (version >= 168) reader.u8();
  if (version >= 183) reader.u8();
  if (version >= 184) reader.u8();
  if (version >= 188) reader.u8();
  if (version >= 191) reader.u8();
  if (version >= 200) reader.u8();
  if (version >= 139) {
    const speedPatternLength = reader.u8();
    if (speedPatternLength > 16) warnings.push(`Invalid speed pattern length ${speedPatternLength}.`);
    reader.skip(16);
    const grooveCount = reader.u8();
    for (let i = 0; i < grooveCount; i++) {
      reader.u8();
      reader.skip(16);
    }
  }
  if (version >= 156) {
    reader.u32();
    reader.u32();
    reader.u32();
  }

  const consumed = reader.tell();
  if (consumed < 8 + size) warnings.push(`INFO parser left ${8 + size - consumed} byte(s) unread in block.`);

  return {
    blockId: "INFO",
    size,
    timeBase,
    speed1,
    speed2,
    arpSpeed,
    ticksPerSecond,
    patternLength,
    ordersLength,
    highlightA,
    highlightB,
    instrumentCount,
    wavetableCount,
    sampleCount,
    patternCount,
    chipIds,
    channelCount,
    songName,
    songAuthor,
    systemName,
    category,
    orders,
    effectColumns,
    instrumentPointers,
    wavetablePointers,
    samplePointers,
    patternPointers
  };
}

function readInstrument(
  reader: FurBinaryReader,
  index: number,
  pointer: number,
  version: number,
  warnings: string[]
): FurInstrumentSummary {
  const blockId = reader.ascii(4);
  if (blockId !== "INS2") {
    warnings.push(`Instrument ${index} at 0x${pointer.toString(16)} has unexpected block ${blockId}.`);
    return { index, pointer, blockId, size: 0 };
  }
  const size = reader.u32();
  const instrumentVersion = reader.u16();
  const type = reader.u16();
  let name: string | undefined;
  const end = pointer + 8 + size;
  while (reader.tell() + 4 <= end) {
    const code = reader.ascii(2);
    if (code === "EN") break;
    const featureSize = reader.u16();
    const featureStart = reader.tell();
    if (code === "NA") name = reader.string();
    reader.seek(featureStart + featureSize);
  }
  if (instrumentVersion !== version) warnings.push(`Instrument ${index} version ${instrumentVersion} differs from module version ${version}.`);
  return { index, pointer, blockId, size, version: instrumentVersion, type, name };
}

function readPattern(
  reader: FurBinaryReader,
  index: number,
  pointer: number,
  version: number,
  patternLength: number,
  warnings: string[]
): FurPatternSummary {
  const blockId = reader.ascii(4);
  if (blockId !== "PATN") {
    warnings.push(`Pattern ${index} at 0x${pointer.toString(16)} has unexpected block ${blockId}.`);
    return { index, pointer, blockId, size: 0, subsong: 0, channel: 0, patternIndex: 0, name: "", rowsDecoded: 0 };
  }
  const size = reader.u32();
  const subsong = reader.u8();
  const channel = reader.u8();
  const patternIndex = reader.u16();
  const name = version >= 51 ? reader.string() : "";
  let rowsDecoded = 0;
  while (rowsDecoded < patternLength) {
    const mask = reader.u8();
    if (mask === 0xff) break;
    if ((mask & 0x80) !== 0) {
      rowsDecoded += (mask & 0x7f) + 2;
      continue;
    }
    if (mask === 0) {
      rowsDecoded++;
      continue;
    }
    const effectMaskLow = (mask & 0x20) !== 0 ? reader.u8() : 0;
    const effectMaskHigh = (mask & 0x40) !== 0 ? reader.u8() : 0;
    if ((mask & 0x01) !== 0) reader.u8();
    if ((mask & 0x02) !== 0) reader.u8();
    if ((mask & 0x04) !== 0) reader.u8();
    if ((mask & 0x08) !== 0) reader.u8();
    if ((mask & 0x10) !== 0) reader.u8();
    for (const bit of [0x04, 0x08, 0x10, 0x20, 0x40, 0x80]) if ((effectMaskLow & bit) !== 0) reader.u8();
    for (const bit of [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]) if ((effectMaskHigh & bit) !== 0) reader.u8();
    rowsDecoded++;
  }
  return { index, pointer, blockId, size, subsong, channel, patternIndex, name, rowsDecoded };
}

function readChipIds(reader: FurBinaryReader): number[] {
  const chips: number[] = [];
  for (let i = 0; i < 32; i++) {
    const chip = reader.u8();
    if (chip !== 0) chips.push(chip);
  }
  return chips;
}

function readPointers(reader: FurBinaryReader, count: number): number[] {
  const pointers: number[] = [];
  for (let i = 0; i < count; i++) pointers.push(reader.u32());
  return pointers;
}

function readBytes(reader: FurBinaryReader, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) values.push(reader.u8());
  return values;
}

function readOrders(reader: FurBinaryReader, channelCount: number, ordersLength: number): number[][] {
  const orders: number[][] = [];
  for (let channel = 0; channel < channelCount; channel++) {
    const channelOrders: number[] = [];
    for (let order = 0; order < ordersLength; order++) channelOrders.push(reader.u8());
    orders.push(channelOrders);
  }
  return orders;
}
