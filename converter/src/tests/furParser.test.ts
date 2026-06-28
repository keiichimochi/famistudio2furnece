import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { fmsToCommonProject } from "../mapper/common.js";
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

  it("writes FamiStudio DutyCycle envelopes as Furnace duty macros", () => {
    const common = fmsToCommonProject({
      format: "text-fms",
      name: "Duty Fixture",
      pal: false,
      expansionMask: 0,
      instruments: [
        { id: 0, name: "Duty 0", envelopes: [], dpcmMappings: [] },
        { id: 1, name: "Duty 2", envelopes: [{ type: "DutyCycle", length: 1, loop: -1, release: -1, relative: false, values: [2] }], dpcmMappings: [] }
      ],
      dpcmSamples: [],
      warnings: [],
      songs: [
        {
          name: "Song",
          length: 1,
          loopPoint: 0,
          tempo: {
            mode: "FamiStudio",
            patternLength: 64,
            beatLength: 4,
            noteLength: 8,
            famitrackerTempo: 150,
            famitrackerSpeed: 6,
            groove: [8]
          },
          channels: [
            {
              type: 0,
              name: "Square1",
              order: [0],
              patterns: [
                {
                  id: 0,
                  name: "P0",
                  channel: "Square1",
                  notes: [{ time: 0, value: 49, flags: 0, slide: 0, instrumentId: 1, duration: 4, effectMask: 0, effects: {} }]
                }
              ]
            }
          ]
        }
      ]
    });
    const data = normalizeFurData(writeFur068FromCommon(common));
    const parsed = readFurBuffer(data);
    const dutyInstrument = parsed.instruments[1];
    expect(dutyInstrument?.name).toBe("Duty 2");

    const instrumentBytes = data.subarray(dutyInstrument.pointer, dutyInstrument.pointer + 8 + dutyInstrument.size);
    const macroOffset = instrumentBytes.indexOf(Buffer.from("MA"));
    expect(macroOffset).toBeGreaterThan(0);
    expect([...instrumentBytes.subarray(macroOffset, macroOffset + 16)]).toEqual([
      0x4d, 0x41, 0x0c, 0x00, 0x08, 0x00, 0x02, 0x01, 0xff, 0xff, 0x00, 0x01, 0x00, 0x01, 0x02, 0xff
    ]);
  });

  it("writes orders in Furnace 0.6.8.3 channel-major layout", () => {
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

    expect([...orders]).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]);
    expect(parsed.info.instrumentCount).toBe(2);
    expect(parsed.instruments.map((instrument) => instrument.name)).toEqual(["Lead", "Bass"]);
    expect(parsed.info.orders).toEqual([
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2]
    ]);
  });

  it("does not emit 0xff as an empty-row skip inside PATN data", () => {
    const fur = writeFur068FromCommon({
      name: "Fixture",
      author: "Tester",
      instruments: [{ index: 0, name: "Default", source: { name: "Default", envelopes: [], dpcmMappings: [] } }],
      warnings: [],
      song: {
        name: "Song",
        author: "Tester",
        patternLength: 256,
        ordersLength: 1,
        speed: 6,
        tempo: 150,
        rowScale: 1,
        channels: [
          {
            source: "Square1",
            target: "GB Square1",
            order: [0],
            patterns: [
              {
                index: 0,
                name: "Long Gap",
                rows: [
                  { row: 0, note: 108, source: { time: 0, value: 49, flags: 0, slide: 0, effectMask: 0, effects: {} } },
                  { row: 200, note: 110, source: { time: 200, value: 51, flags: 0, slide: 0, effectMask: 0, effects: {} } }
                ]
              }
            ]
          },
          { source: "Square2", target: "GB Square2", order: [0], patterns: [{ index: 0, name: "P0", rows: [] }] },
          { source: "Triangle", target: "GB Wave", order: [0], patterns: [{ index: 0, name: "P0", rows: [] }] },
          { source: "Noise", target: "GB Noise", order: [0], patterns: [{ index: 0, name: "P0", rows: [] }] }
        ]
      }
    });
    const patternData = extractPatternData(normalizeFurData(fur), 0);

    expect(patternData.at(-1)).toBe(0xff);
    expect([...patternData.subarray(0, -1)]).not.toContain(0xff);
  });

  it("keeps FamiStudio effect-only volume rows as Furnace volume-only rows", () => {
    const common = fmsToCommonProject({
      format: "binary-fms",
      name: "Volume Fixture",
      author: "Tester",
      pal: false,
      expansionMask: 0,
      instruments: [{ id: 1, name: "Lead", envelopes: [], dpcmMappings: [] }],
      dpcmSamples: [],
      warnings: [],
      songs: [
        {
          name: "Song",
          length: 1,
          loopPoint: 0,
          tempo: {
            mode: "FamiStudio",
            patternLength: 256,
            beatLength: 32,
            noteLength: 8,
            famitrackerTempo: 150,
            famitrackerSpeed: 6,
            groove: [8]
          },
          channels: [
            {
              type: 0,
              name: "Square1",
              order: [0],
              patterns: [
                {
                  id: 0,
                  name: "P0",
                  channel: "Square1",
                  notes: [
                    { time: 0, value: 49, flags: 0, slide: 0, instrumentId: 1, duration: 4, effectMask: 0, effects: {} },
                    { time: 130, value: 0xff, flags: 0, slide: 0, effectMask: 1, effects: { volume: 7 } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    const fur = writeFur068FromCommon(common);
    const parsed = readFurBuffer(fur);

    expect(common.song.channels[0]?.patterns[0]?.rows.find((row) => row.row === 130)).toMatchObject({ volume: 7 });
    expect(parsed.patterns[0]?.rows.find((row) => row.row === 130)).toEqual({ row: 130, volume: 7, effects: [] });
  });

  it("writes FamiStudio FinePitch rows as Furnace pitch effects", () => {
    const common = fmsToCommonProject({
      format: "text-fms",
      name: "FinePitch Fixture",
      pal: false,
      expansionMask: 0,
      instruments: [{ id: 0, name: "Lead", envelopes: [], dpcmMappings: [] }],
      dpcmSamples: [],
      warnings: [],
      songs: [
        {
          name: "Song",
          length: 1,
          loopPoint: 0,
          tempo: {
            mode: "FamiStudio",
            patternLength: 64,
            beatLength: 4,
            noteLength: 8,
            famitrackerTempo: 150,
            famitrackerSpeed: 6,
            groove: [8]
          },
          channels: [
            {
              type: 0,
              name: "Square1",
              order: [0],
              patterns: [
                {
                  id: 0,
                  name: "P0",
                  channel: "Square1",
                  notes: [
                    { time: 0, value: 49, flags: 0, slide: 0, instrumentId: 0, duration: 16, effectMask: 0, effects: { volume: 9, finePitch: -1 } },
                    { time: 8, value: 0xff, flags: 0, slide: 0, effectMask: 0, effects: { finePitch: 0 } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    const parsed = readFurBuffer(writeFur068FromCommon(common));

    expect(parsed.info.effectColumns).toEqual([1, 1, 1, 1]);
    expect(parsed.patterns[0]?.rows.find((row) => row.row === 0)).toMatchObject({
      note: 120,
      volume: 9,
      effects: [{ effect: 0xe5, value: 0x7e }]
    });
    expect(parsed.patterns[0]?.rows.find((row) => row.row === 8)).toEqual({
      row: 8,
      effects: [{ effect: 0xe5, value: 0x80 }]
    });
  });

  it("maps parsed FamiStudio effects that have safe Furnace equivalents", () => {
    const common = fmsToCommonProject({
      format: "binary-fms",
      name: "Effect Fixture",
      pal: false,
      expansionMask: 0,
      instruments: [{ id: 0, name: "Lead", envelopes: [], dpcmMappings: [] }],
      dpcmSamples: [],
      warnings: [],
      songs: [
        {
          name: "Song",
          length: 1,
          loopPoint: 0,
          tempo: {
            mode: "FamiStudio",
            patternLength: 64,
            beatLength: 4,
            noteLength: 8,
            famitrackerTempo: 150,
            famitrackerSpeed: 6,
            groove: [8]
          },
          channels: [
            {
              type: 0,
              name: "Square1",
              order: [0],
              patterns: [
                {
                  id: 0,
                  name: "P0",
                  channel: "Square1",
                  notes: [
                    { time: 0, value: 49, flags: 0, slide: 0, instrumentId: 0, duration: 16, effectMask: 0, effects: { vibrato: 0x23 } },
                    { time: 8, value: 0xff, flags: 0, slide: 0, effectMask: 0, effects: { volumeSlide: 0xf1 } },
                    { time: 16, value: 0xff, flags: 0, slide: 0, effectMask: 0, effects: { dutyCycle: 2 } },
                    { time: 24, value: 0xff, flags: 0, slide: 0, effectMask: 0, effects: { phaseReset: 1 } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
    const parsed = readFurBuffer(writeFur068FromCommon(common));

    expect(parsed.patterns[0]?.rows.find((row) => row.row === 0)?.effects).toEqual([{ effect: 0x04, value: 0x23 }]);
    expect(parsed.patterns[0]?.rows.find((row) => row.row === 8)?.effects).toEqual([{ effect: 0x0a, value: 0xf1 }]);
    expect(parsed.patterns[0]?.rows.find((row) => row.row === 16)?.effects).toEqual([{ effect: 0x12, value: 2 }]);
    expect(parsed.patterns[0]?.rows.find((row) => row.row === 24)).toBeUndefined();
    expect(common.warnings).toContain("Effect phaseReset is parsed but not converted in this minimal .fur export.");
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

function extractPatternData(raw: Buffer, patternPointerIndex: number): Buffer {
  const parsed = readFurBuffer(raw);
  const pointer = parsed.info.patternPointers[patternPointerIndex];
  if (pointer === undefined) throw new Error(`Missing pattern pointer ${patternPointerIndex}`);
  const reader = new FurBinaryReader(raw, pointer);
  expect(reader.ascii(4)).toBe("PATN");
  const size = reader.u32();
  reader.skip(1 + 1 + 2);
  reader.string();
  const dataStart = reader.tell();
  const dataEnd = pointer + 8 + size;
  return raw.subarray(dataStart, dataEnd);
}
