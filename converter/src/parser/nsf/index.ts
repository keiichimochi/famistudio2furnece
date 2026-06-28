import { readFile } from "node:fs/promises";

export type NsfHeader = {
  version: number;
  totalSongs: number;
  startingSong: number;
  loadAddress: number;
  initAddress: number;
  playAddress: number;
  title: string;
  artist: string;
  copyright: string;
  ntscSpeed: number;
  banks: number[];
  palSpeed: number;
  region: number;
  expansion: number;
};

export type NsfTrack = {
  index: number;
  initSong: number;
  name: string;
};

export type NsfDocument = {
  header: NsfHeader;
  tracks: NsfTrack[];
  data: Buffer;
};

const NSF_MAGIC = "NESM\u001a";

export async function readNsfFile(path: string): Promise<NsfDocument> {
  return readNsfBuffer(await readFile(path));
}

export function readNsfBuffer(buffer: Buffer): NsfDocument {
  if (buffer.length < 128) throw new Error("Invalid NSF: file is shorter than the 128 byte header.");
  const magic = buffer.subarray(0, 5).toString("binary");
  if (magic !== NSF_MAGIC) throw new Error("Invalid NSF: expected NESM magic.");

  const header: NsfHeader = {
    version: buffer.readUInt8(5),
    totalSongs: buffer.readUInt8(6),
    startingSong: buffer.readUInt8(7),
    loadAddress: buffer.readUInt16LE(8),
    initAddress: buffer.readUInt16LE(10),
    playAddress: buffer.readUInt16LE(12),
    title: readFixedString(buffer, 14, 32),
    artist: readFixedString(buffer, 46, 32),
    copyright: readFixedString(buffer, 78, 32),
    ntscSpeed: buffer.readUInt16LE(110),
    banks: [...buffer.subarray(112, 120)],
    palSpeed: buffer.readUInt16LE(120),
    region: buffer.readUInt8(122),
    expansion: buffer.readUInt8(123)
  };

  const title = header.title || "NSF";
  const tracks = Array.from({ length: header.totalSongs }, (_, index) => ({
    index,
    initSong: index + 1,
    name: `${title} ${String(index + 1).padStart(2, "0")}`
  }));

  return { header, tracks, data: buffer.subarray(128) };
}

export function formatNsfTrackList(document: NsfDocument): string {
  const lines = [
    `Title : ${document.header.title || "(untitled)"}`,
    `Artist : ${document.header.artist || "(unknown)"}`,
    `Songs : ${document.header.totalSongs}`,
    `Start : ${document.header.startingSong}`,
    "",
    "Tracks"
  ];
  for (const track of document.tracks) {
    lines.push(`${String(track.index).padStart(2, "0")} : ${track.name}`);
  }
  return lines.join("\n");
}

function readFixedString(buffer: Buffer, offset: number, length: number): string {
  const slice = buffer.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end >= 0 ? end : slice.length).toString("utf8").trim();
}
