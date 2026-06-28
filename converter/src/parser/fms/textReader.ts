import { channelName } from "./constants.js";
import type { FmsChannel, FmsDpcmSample, FmsEnvelope, FmsInstrument, FmsPattern, FmsProject, FmsSong } from "./types.js";

type ParsedLine = {
  indent: number;
  keyword: string;
  attrs: Record<string, string>;
};

export function readTextFms(text: string): FmsProject {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(parseLine)
    .filter((line): line is ParsedLine => line !== null);

  const projectLine = lines.find((line) => line.keyword === "Project");
  if (!projectLine) throw new Error("FamiStudio text project must start with a Project line.");

  const project: FmsProject = {
    format: "text-fms",
    name: projectLine.attrs.Name ?? "Untitled",
    author: projectLine.attrs.Author,
    copyright: projectLine.attrs.Copyright,
    pal: toBool(projectLine.attrs.PAL),
    expansionMask: 0,
    instruments: [],
    dpcmSamples: [],
    songs: [],
    warnings: []
  };

  let currentInstrument: FmsInstrument | undefined;
  let currentSong: FmsSong | undefined;
  let currentChannel: FmsChannel | undefined;

  for (const line of lines.slice(1)) {
    if (line.indent === 1 && line.keyword === "DPCMSample") {
      const data = line.attrs.Data ?? "";
      const sample: FmsDpcmSample = {
        name: line.attrs.Name ?? "Unnamed Sample",
        folder: line.attrs.Folder,
        source: "dmc",
        dataLength: Math.floor(data.length / 2)
      };
      project.dpcmSamples.push(sample);
      currentInstrument = undefined;
      currentSong = undefined;
      currentChannel = undefined;
      continue;
    }

    if (line.indent === 1 && line.keyword === "Instrument") {
      currentInstrument = {
        name: line.attrs.Name ?? "Unnamed Instrument",
        expansion: line.attrs.Expansion ?? "None",
        folder: line.attrs.Folder,
        envelopes: [],
        dpcmMappings: []
      };
      project.instruments.push(currentInstrument);
      currentSong = undefined;
      currentChannel = undefined;
      continue;
    }

    if (line.indent === 2 && line.keyword === "Envelope" && currentInstrument) {
      currentInstrument.envelopes.push(readEnvelope(line.attrs));
      continue;
    }

    if (line.indent === 2 && line.keyword === "DPCMMapping" && currentInstrument) {
      currentInstrument.dpcmMappings.push({
        note: line.attrs.Note ?? "",
        sample: line.attrs.Sample,
        pitch: toInt(line.attrs.Pitch, 15),
        loop: toBool(line.attrs.Loop)
      });
      continue;
    }

    if (line.indent === 1 && line.keyword === "Song") {
      currentSong = {
        name: line.attrs.Name ?? "Unnamed Song",
        length: toInt(line.attrs.Length, 0),
        loopPoint: toInt(line.attrs.LoopPoint, 0),
        tempo: {
          mode: line.attrs.FamiTrackerTempo ? "FamiTracker" : "FamiStudio",
          patternLength: toInt(line.attrs.PatternLength, 0),
          beatLength: toInt(line.attrs.BeatLength, 0),
          famitrackerTempo: toInt(line.attrs.FamiTrackerTempo, 150),
          famitrackerSpeed: toInt(line.attrs.FamiTrackerSpeed, 6),
          noteLength: line.attrs.NoteLength ? toInt(line.attrs.NoteLength, 10) : undefined,
          groove: parseIntList(line.attrs.Groove)
        },
        channels: []
      };
      project.songs.push(currentSong);
      currentInstrument = undefined;
      currentChannel = undefined;
      continue;
    }

    if (line.indent === 2 && line.keyword === "Channel" && currentSong) {
      const type = channelTypeFromName(line.attrs.Type ?? line.attrs.Name ?? "");
      currentChannel = {
        type,
        name: line.attrs.Type ?? line.attrs.Name ?? channelName(type),
        patterns: [],
        order: parseOrder(line.attrs.Patterns)
      };
      currentSong.channels.push(currentChannel);
      continue;
    }

    if (line.indent === 3 && line.keyword === "Pattern" && currentChannel) {
      const pattern: FmsPattern = {
        name: line.attrs.Name ?? `Pattern ${currentChannel.patterns.length}`,
        channel: currentChannel.name,
        channelType: currentChannel.type,
        notes: []
      };
      currentChannel.patterns.push(pattern);
      continue;
    }
  }

  return project;
}

function readEnvelope(attrs: Record<string, string>): FmsEnvelope {
  return {
    type: attrs.Type ?? "Unknown",
    length: toInt(attrs.Length, 0),
    loop: toInt(attrs.Loop, -1),
    release: toInt(attrs.Release, -1),
    relative: toBool(attrs.Relative),
    values: parseIntList(attrs.Values)
  };
}

function parseLine(raw: string): ParsedLine | null {
  if (raw.trim() === "" || raw.trimStart().startsWith("#")) return null;
  const indent = raw.match(/^\t*/)?.[0].length ?? 0;
  const body = raw.trim();
  const keyword = body.match(/^[A-Za-z0-9_]+/)?.[0];
  if (!keyword) return null;
  const attrs: Record<string, string> = {};
  const attrRegex = /([A-Za-z0-9_]+)="((?:\\.|[^"\\])*)"/g;
  for (const match of body.matchAll(attrRegex)) {
    attrs[match[1]] = match[2].replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
  return { indent, keyword, attrs };
}

function parseIntList(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10));
}

function parseOrder(value: string | undefined): Array<number | null> {
  return parseIntList(value).map((entry) => (entry < 0 ? null : entry));
}

function toBool(value: string | undefined): boolean {
  return value === "true" || value === "True" || value === "1";
}

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function channelTypeFromName(name: string): number {
  const normalized = name.toLowerCase();
  if (normalized === "square1" || normalized === "pulse1") return 0;
  if (normalized === "square2" || normalized === "pulse2") return 1;
  if (normalized === "triangle") return 2;
  if (normalized === "noise") return 3;
  if (normalized === "dpcm") return 4;
  return -1;
}
