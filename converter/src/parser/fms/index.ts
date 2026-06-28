import { readFile } from "node:fs/promises";
import { FMS_MAGIC } from "./constants.js";
import { readBinaryFms } from "./binaryReader.js";
import { readTextFms } from "./textReader.js";
import type { FmsProject } from "./types.js";

export async function readFmsFile(path: string): Promise<FmsProject> {
  const data = await readFile(path);
  if (data.length >= 4 && data.readUInt32LE(0) === FMS_MAGIC) {
    return readBinaryFms(data);
  }
  return readTextFms(data.toString("utf8"));
}

export function inspectProject(project: FmsProject): string {
  const lines: string[] = [];
  lines.push("Project");
  lines.push(`Name : ${project.name}`);
  lines.push(`Format : ${project.format}${project.version ? ` v${project.version}` : ""}`);
  lines.push(`Songs : ${project.songs.length}`);
  lines.push("");

  project.songs.forEach((song, index) => {
    const patternCount = song.channels.reduce((sum, channel) => sum + channel.patterns.length, 0);
    lines.push(`Song ${index}`);
    lines.push(`Name : ${song.name}`);
    lines.push("");
    lines.push("Channels");
    for (const channel of song.channels) lines.push(channel.name);
    lines.push("");
    lines.push(`Pattern Count : ${patternCount}`);
    lines.push(`Instrument Count : ${project.instruments.length}`);
    lines.push(`DPCM Count : ${project.dpcmSamples.length}`);
    lines.push(`Tempo Mode : ${song.tempo.mode}`);
    lines.push(`Tempo : ${song.tempo.famitrackerTempo}`);
    lines.push(`Speed : ${song.tempo.famitrackerSpeed}`);
    if (index !== project.songs.length - 1) lines.push("");
  });

  if (project.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings");
    for (const warning of project.warnings) lines.push(`- ${warning}`);
  }

  return lines.join("\n");
}

export type { FmsProject } from "./types.js";
