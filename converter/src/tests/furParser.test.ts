import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { FurBinaryReader } from "../parser/fur/binaryReader.js";
import { normalizeFurData } from "../parser/fur/index.js";
import { readFurBuffer } from "../parser/fur/index.js";
import { BinaryWriter } from "../writer/fur/binaryWriter.js";
import { writeFurRoundTrip } from "../writer/fur068/index.js";
import { writeFur068FromCommon } from "../writer/fur068/convert.js";

describe("Furnace 0.6.8.x parser", () => {
  it("rejects the newer INF2 header used by master-era files", () => {
    const w = new BinaryWriter();
    w.ascii("-Furnace module-", 16);
    w.u16(249);
    w.u16(0);
    w.i32(32);
    w.i32(0);
    w.i32(0);
    w.ascii("INF2", 4);
    w.i32(0);

    expect(() => readFurBuffer(w.toBuffer())).toThrow("expected INFO, got INF2");
  });

  it("round-trips normalized Furnace bytes independent of zlib output", () => {
    const w = new BinaryWriter();
    w.ascii("-Furnace module-", 16);
    w.u16(232);
    w.u16(0);
    w.i32(32);
    w.i32(0);
    w.i32(0);
    w.ascii("INFO", 4);
    w.i32(0);
    const normalized = w.toBuffer();
    const compressed = deflateSync(normalized);
    const roundtrip = writeFurRoundTrip({ data: normalizeFurData(compressed), compressed: true }, { compress: true });

    expect(normalizeFurData(roundtrip)).toEqual(normalized);
  });

  it("writes a Furnace 0.6.8.x INFO module from common data", () => {
    const fur = writeFur068FromCommon({
      name: "Fixture",
      author: "Tester",
      instruments: [{ index: 0, name: "Default", source: { name: "Default", envelopes: [], dpcmMappings: [] } }],
      warnings: [],
      song: {
        name: "Song",
        author: "Tester",
        patternLength: 64,
        ordersLength: 1,
        speed: 6,
        tempo: 150,
        rowScale: 1,
        channels: [
          {
            source: "Square1",
            target: "GB Square1",
            order: [0],
            patterns: [{ index: 0, name: "P0", rows: [{ row: 0, note: 108, instrument: 0, duration: 4, source: { time: 0, value: 49, flags: 0, slide: 0, duration: 4, effectMask: 0, effects: {} } }] }]
          },
          { source: "Square2", target: "GB Square2", order: [0], patterns: [{ index: 0, name: "P0", rows: [] }] },
          { source: "Triangle", target: "GB Wave", order: [0], patterns: [{ index: 0, name: "P0", rows: [] }] },
          { source: "Noise", target: "GB Noise", order: [0], patterns: [{ index: 0, name: "P0", rows: [] }] }
        ]
      }
    });
    const parsed = readFurBuffer(fur);

    expect(parsed.header.version).toBe(232);
    expect(parsed.info.blockId).toBe("INFO");
    expect(parsed.info.systemName).toBe("Game Boy");
    expect(parsed.info.instrumentCount).toBe(1);
    expect(parsed.info.patternCount).toBe(4);
    expect(parsed.patterns[0]?.rows[0]).toMatchObject({ row: 0, note: 108, instrument: 0 });
    expect(parsed.patterns[0]?.rows[1]).toMatchObject({ row: 4, note: 180 });
  });

  it("writes orders in Furnace order-major layout", () => {
    const fur = writeFur068FromCommon({
      name: "Fixture",
      author: "Tester",
      instruments: [
        { index: 0, name: "Lead", source: { name: "Lead", envelopes: [], dpcmMappings: [] } },
        { index: 1, name: "Bass", source: { name: "Bass", envelopes: [], dpcmMappings: [] } }
      ],
      warnings: [],
      song: {
        name: "Song",
        author: "Tester",
        patternLength: 64,
        ordersLength: 3,
        speed: 6,
        tempo: 150,
        rowScale: 1,
        channels: [
          { source: "Square1", target: "GB Square1", order: [0, 1, 2], patterns: fixturePatterns() },
          { source: "Square2", target: "GB Square2", order: [0, 1, 2], patterns: fixturePatterns() },
          { source: "Triangle", target: "GB Wave", order: [0, 1, 2], patterns: fixturePatterns() },
          { source: "Noise", target: "GB Noise", order: [0, 1, 2], patterns: fixturePatterns() }
        ]
      }
    });
    const raw = normalizeFurData(fur);
    const orders = extractOrderBytesFromInfo(raw, 4, 3);
    const parsed = readFurBuffer(fur);

    expect([...orders]).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
    expect(parsed.info.instrumentCount).toBe(2);
    expect(parsed.instruments.map((instrument) => instrument.name)).toEqual(["Lead", "Bass"]);
    expect(parsed.info.orders).toEqual([
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2]
    ]);
  });
});

function fixturePatterns() {
  return [
    { index: 0, name: "P0", rows: [] },
    { index: 1, name: "P1", rows: [] },
    { index: 2, name: "P2", rows: [] }
  ];
}

function extractOrderBytesFromInfo(raw: Buffer, channelCount: number, ordersLength: number): Buffer {
  const reader = new FurBinaryReader(raw);
  reader.skip(20);
  const infoPointer = reader.u32();
  const info = reader.fork(infoPointer);
  expect(info.ascii(4)).toBe("INFO");
  info.u32();
  info.skip(1 + 1 + 1 + 1 + 4 + 2 + 2 + 1 + 1);
  const instrumentCount = info.u16();
  const wavetableCount = info.u16();
  const sampleCount = info.u16();
  const patternCount = info.u32();
  info.skip(32 + 32 + 32 + 128);
  info.string();
  info.string();
  info.skip(4 + 20);
  info.skip((instrumentCount + wavetableCount + sampleCount + patternCount) * 4);
  const orderOffset = info.tell();
  return raw.subarray(orderOffset, orderOffset + channelCount * ordersLength);
}
