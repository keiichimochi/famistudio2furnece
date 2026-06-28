import { readFile } from "node:fs/promises";

const FUW_MAGIC = "-Furnace waveta-";

export type FurnaceWavetableAsset = {
  version: number;
  block: Buffer;
};

export async function readFuwFile(path: string): Promise<FurnaceWavetableAsset[]> {
  return readFuwBuffer(await readFile(path));
}

export function readFuwBuffer(buffer: Buffer): FurnaceWavetableAsset[] {
  if (buffer.length < 28) throw new Error("Invalid FUW: file is too small.");
  const magic = buffer.subarray(0, 16).toString("ascii");
  if (magic !== FUW_MAGIC) throw new Error(`Invalid FUW: expected ${FUW_MAGIC}.`);
  const version = buffer.readUInt32LE(16);
  const assets: FurnaceWavetableAsset[] = [];
  let offset = 20;
  while (offset + 8 <= buffer.length) {
    const blockId = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (end > buffer.length) throw new Error(`Invalid FUW: ${blockId} block exceeds file size.`);
    if (blockId === "WAVE") assets.push({ version, block: buffer.subarray(offset, end) });
    offset = end;
  }
  if (assets.length === 0) throw new Error("Invalid FUW: no WAVE block found.");
  return assets;
}
