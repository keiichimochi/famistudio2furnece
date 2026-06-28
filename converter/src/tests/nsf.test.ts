import { describe, expect, it } from "vitest";
import { convertNsfBufferToFurFiles } from "../nsfConvert.js";
import { readFuwBuffer } from "../parser/fur/wavetable.js";
import { readNsfBuffer } from "../parser/nsf/index.js";
import { readFurBuffer } from "../parser/fur/index.js";
import { chmod, copyFile, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("NSF batch conversion", () => {
  it("reads NSF headers and lists tracks", () => {
    const document = readNsfBuffer(createNsfFixture({ title: "Demo", artist: "Composer", songs: 3 }));

    expect(document.header.title).toBe("Demo");
    expect(document.header.artist).toBe("Composer");
    expect(document.header.totalSongs).toBe(3);
    expect(document.tracks.map((track) => track.name)).toEqual(["Demo 01", "Demo 02", "Demo 03"]);
  });

  it("creates one Furnace shell per NSF track and embeds FUW wavetable blocks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fms2fur-"));
    const wavetable = createFuwFixture();
    const wavetablePath = join(dir, "triangle.fuw");
    const fakeFamiStudioPath = await createFakeFamiStudio(dir);
    await writeFile(wavetablePath, wavetable);

    const result = await convertNsfBufferToFurFiles(createNsfFixture({ title: "Demo", artist: "Composer", songs: 2 }), "demo.nsf", {
      wavetable: wavetablePath,
      famistudio: fakeFamiStudioPath
    });
    const parsed = readFurBuffer(result.files[0]!.data);

    expect(result.files.map((file) => file.name)).toEqual(["Demo-01.fur", "Demo-02.fur"]);
    expect(parsed.info.systemName).toBe("Game Boy");
    expect(parsed.info.wavetableCount).toBe(1);
    expect(parsed.info.wavetablePointers[0]).toBeGreaterThan(0);
    expect(readFuwBuffer(wavetable)[0]?.block.subarray(0, 4).toString("ascii")).toBe("WAVE");
  });
});

function createNsfFixture(options: { title: string; artist: string; songs: number }): Buffer {
  const buffer = Buffer.alloc(160);
  buffer.write("NESM\u001a", 0, "binary");
  buffer.writeUInt8(1, 5);
  buffer.writeUInt8(options.songs, 6);
  buffer.writeUInt8(1, 7);
  buffer.writeUInt16LE(0x8000, 8);
  buffer.writeUInt16LE(0x8000, 10);
  buffer.writeUInt16LE(0x8003, 12);
  buffer.write(options.title, 14, 32, "utf8");
  buffer.write(options.artist, 46, 32, "utf8");
  buffer.writeUInt16LE(16666, 110);
  return buffer;
}

async function createFakeFamiStudio(dir: string): Promise<string> {
  const fixturePath = join(import.meta.dirname, "..", "..", "fixtures", "sample-text.fms.txt");
  const fixtureCopyPath = join(dir, "sample-text.fms.txt");
  const executablePath = join(dir, "fake-famistudio.sh");
  await copyFile(fixturePath, fixtureCopyPath);
  await writeFile(
    executablePath,
    `#!/bin/sh\ncp "${fixtureCopyPath.replaceAll('"', '\\"')}" "$3"\n`
  );
  await chmod(executablePath, 0o755);
  return executablePath;
}

function createFuwFixture(): Buffer {
  const values = Array.from({ length: 32 }, (_, index) => index & 0x0f);
  const header = Buffer.alloc(20);
  header.write("-Furnace waveta-", 0, "ascii");
  header.writeUInt32LE(232, 16);
  const block = Buffer.alloc(8 + 4 + values.length * 4);
  block.write("WAVE", 0, "ascii");
  block.writeUInt32LE(block.length - 8, 4);
  block.writeUInt32LE(values.length, 8);
  values.forEach((value, index) => block.writeUInt32LE(value, 12 + index * 4));
  return Buffer.concat([header, block]);
}
