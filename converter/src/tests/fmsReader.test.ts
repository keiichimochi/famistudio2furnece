import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fmsToCommonProject } from "../mapper/common.js";
import { inspectProject, readFmsFile } from "../parser/fms/index.js";
import { writeFur } from "../writer/fur/index.js";

const root = join(import.meta.dirname, "..", "..");

describe("FMS Reader", () => {
  it("reads a FamiStudio Text export", async () => {
    const project = await readFmsFile(join(root, "fixtures", "sample-text.fms.txt"));

    expect(project).toMatchInlineSnapshot(`
      {
        "author": "Codex",
        "copyright": undefined,
        "dpcmSamples": [
          {
            "dataLength": 8,
            "folder": undefined,
            "name": "Kick",
            "source": "dmc",
          },
        ],
        "expansionMask": 0,
        "format": "text-fms",
        "instruments": [
          {
            "dpcmMappings": [],
            "envelopes": [
              {
                "length": 4,
                "loop": 1,
                "relative": false,
                "release": -1,
                "type": "Volume",
                "values": [
                  15,
                  12,
                  8,
                  0,
                ],
              },
              {
                "length": 1,
                "loop": -1,
                "relative": false,
                "release": -1,
                "type": "DutyCycle",
                "values": [
                  2,
                ],
              },
            ],
            "expansion": "None",
            "folder": undefined,
            "name": "Lead",
          },
        ],
        "name": "Fixture Project",
        "pal": false,
        "songs": [
          {
            "channels": [
              {
                "name": "Square1",
                "order": [
                  0,
                  0,
                ],
                "patterns": [
                  {
                    "channel": "Square1",
                    "channelType": 0,
                    "name": "A",
                    "notes": [],
                  },
                ],
                "type": 0,
              },
              {
                "name": "Square2",
                "order": [
                  0,
                  0,
                ],
                "patterns": [
                  {
                    "channel": "Square2",
                    "channelType": 1,
                    "name": "A",
                    "notes": [],
                  },
                ],
                "type": 1,
              },
              {
                "name": "Triangle",
                "order": [
                  0,
                  0,
                ],
                "patterns": [
                  {
                    "channel": "Triangle",
                    "channelType": 2,
                    "name": "A",
                    "notes": [],
                  },
                ],
                "type": 2,
              },
              {
                "name": "Noise",
                "order": [
                  0,
                  0,
                ],
                "patterns": [
                  {
                    "channel": "Noise",
                    "channelType": 3,
                    "name": "A",
                    "notes": [],
                  },
                ],
                "type": 3,
              },
              {
                "name": "DPCM",
                "order": [
                  0,
                  0,
                ],
                "patterns": [
                  {
                    "channel": "DPCM",
                    "channelType": 4,
                    "name": "A",
                    "notes": [],
                  },
                ],
                "type": 4,
              },
            ],
            "length": 2,
            "loopPoint": 0,
            "name": "Battle",
            "tempo": {
              "beatLength": 4,
              "famitrackerSpeed": 6,
              "famitrackerTempo": 150,
              "groove": [
                4,
              ],
              "mode": "FamiStudio",
              "noteLength": 4,
              "patternLength": 16,
            },
          },
        ],
        "warnings": [],
      }
    `);
  });

  it("detects and inflates a binary FMS file", async () => {
    const project = await readFmsFile(join(root, "fixtures", "battle.fms"));

    expect(project.format).toBe("binary-fms");
    expect(project.version).toBeGreaterThanOrEqual(1);
    expect(project.songs.length).toBeGreaterThan(0);
    expect(project.instruments.length).toBeGreaterThan(0);
    expect(project.songs[0]?.channels.map((channel) => channel.name)).toEqual([
      "Square1",
      "Square2",
      "Triangle",
      "Noise",
      "DPCM"
    ]);
  });

  it("prints the Phase 1 inspect summary", async () => {
    const project = await readFmsFile(join(root, "fixtures", "sample-text.fms.txt"));
    expect(inspectProject(project)).toMatchInlineSnapshot(`
      "Project
      Name : Fixture Project
      Format : text-fms
      Songs : 1

      Song 0
      Name : Battle

      Channels
      Square1
      Square2
      Triangle
      Noise
      DPCM

      Pattern Count : 5
      Instrument Count : 1
      DPCM Count : 1
      Tempo Mode : FamiStudio
      Tempo : 150
      Speed : 6"
    `);
  });

  it("keeps fixture files present for FF3-oriented golden replacement", async () => {
    await expect(readFile(join(root, "fixtures", "battle.fms"))).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(join(root, "fixtures", "town.fms"))).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(join(root, "fixtures", "boss.fms"))).resolves.toBeInstanceOf(Buffer);
  });

  it("scales FamiStudio rows to Furnace tracker rows", () => {
    const common = fmsToCommonProject({
      format: "binary-fms",
      name: "Scale Fixture",
      author: "Codex",
      pal: false,
      expansionMask: 0,
      instruments: [{ id: 1, name: "Lead", envelopes: [], dpcmMappings: [] }],
      dpcmSamples: [],
      warnings: [],
      songs: [
        {
          name: "Battle",
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
                    { time: 0, value: 30, flags: 0, slide: 0, instrumentId: 1, duration: 4, effectMask: 0, effects: {} },
                    { time: 4, value: 31, flags: 0, slide: 0, instrumentId: 1, duration: 4, effectMask: 0, effects: {} }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    expect(common.song.rowScale).toBe(4);
    expect(common.song.patternLength).toBe(64);
    expect(common.song.speed).toBe(8);
    expect(common.song.channels[0]?.patterns[0]?.rows.map((row) => ({ row: row.row, duration: row.duration }))).toEqual([
      { row: 0, duration: 1 },
      { row: 1, duration: 1 }
    ]);
  });

  it("writes a minimal uncompressed Furnace module", async () => {
    const project = await readFmsFile(join(root, "fixtures", "battle.fms"));
    const common = fmsToCommonProject(project);
    const fur = writeFur(common);

    expect(fur.subarray(0, 16).toString("ascii")).toBe("-Furnace module-");
    expect(fur.subarray(32, 36).toString("ascii")).toBe("INF2");
    expect(fur.includes(Buffer.from("SNG2"))).toBe(true);
    expect(fur.includes(Buffer.from("INS2"))).toBe(true);
    expect(fur.includes(Buffer.from("PATN"))).toBe(true);
  });
});
