import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
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
});
