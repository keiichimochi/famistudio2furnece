import type { CommonChannel, CommonNote, CommonProject } from "../../mapper/common.js";

type TimedNote = CommonNote & {
  absoluteRow: number;
};

const FURNACE_TO_MIDI_OFFSET = 60;

export function writeMusicXmlFromCommon(project: CommonProject): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    "  <work>",
    `    <work-title>${xml(project.song.name || project.name)}</work-title>`,
    "  </work>",
    project.author || project.song.author ? `  <identification><creator type="composer">${xml(project.author || project.song.author)}</creator></identification>` : "",
    "  <part-list>",
    ...project.song.channels.map((channel, index) => `    <score-part id="${partId(index)}"><part-name>${xml(channel.target)}</part-name></score-part>`),
    "  </part-list>",
    ...project.song.channels.flatMap((channel, index) => writePart(channel, index, project.song.patternLength, project.song.ordersLength, project.song.tempo)),
    "</score-partwise>"
  ];

  return `${lines.filter((line) => line !== "").join("\n")}\n`;
}

function writePart(channel: CommonChannel, channelIndex: number, patternLength: number, ordersLength: number, tempo: number): string[] {
  const notes = expandChannelNotes(channel, patternLength);
  const lines = [`  <part id="${partId(channelIndex)}">`];
  for (let measureIndex = 0; measureIndex < ordersLength; measureIndex++) {
    lines.push(`    <measure number="${measureIndex + 1}">`);
    if (measureIndex === 0) {
      lines.push(...writeMeasureAttributes(channel, tempo));
    }
    lines.push(...writeMeasureNotes(notes, measureIndex, patternLength, channel.target === "GB Noise"));
    lines.push("    </measure>");
  }
  lines.push("  </part>");
  return lines;
}

function writeMeasureAttributes(channel: CommonChannel, tempo: number): string[] {
  const clef = channel.target === "GB Noise" ? ["        <sign>percussion</sign>", "        <line>2</line>"] : ["        <sign>G</sign>", "        <line>2</line>"];
  return [
    "      <attributes>",
    "        <divisions>1</divisions>",
    "        <key><fifths>0</fifths></key>",
    "        <time><beats>4</beats><beat-type>4</beat-type></time>",
    "        <clef>",
    ...clef,
    "        </clef>",
    "      </attributes>",
    `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`
  ];
}

function writeMeasureNotes(notes: TimedNote[], measureIndex: number, patternLength: number, unpitched: boolean): string[] {
  const measureStart = measureIndex * patternLength;
  const measureEnd = measureStart + patternLength;
  const measureNotes = notes
    .filter((note) => note.absoluteRow >= measureStart && note.absoluteRow < measureEnd)
    .sort((a, b) => a.absoluteRow - b.absoluteRow);
  const lines: string[] = [];
  let cursor = measureStart;

  for (const note of measureNotes) {
    if (note.absoluteRow > cursor) {
      lines.push(...writeRest(note.absoluteRow - cursor));
      cursor = note.absoluteRow;
    }
    const duration = Math.max(1, Math.min(note.duration ?? 1, measureEnd - note.absoluteRow));
    lines.push(...writeNote(note, duration, unpitched));
    cursor = Math.max(cursor, note.absoluteRow + duration);
  }

  if (cursor < measureEnd) lines.push(...writeRest(measureEnd - cursor));
  return lines;
}

function writeNote(note: TimedNote, duration: number, unpitched: boolean): string[] {
  if (unpitched) {
    return [
      "      <note>",
      "        <unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>",
      `        <duration>${duration}</duration>`,
      "        <voice>1</voice>",
      note.volume !== undefined ? `        <notations><technical><fret>${note.volume}</fret></technical></notations>` : "",
      "      </note>"
    ].filter((line) => line !== "");
  }

  const pitch = midiToPitch((note.note ?? 120) - FURNACE_TO_MIDI_OFFSET);
  return [
    "      <note>",
    "        <pitch>",
    `          <step>${pitch.step}</step>`,
    pitch.alter === 0 ? "" : `          <alter>${pitch.alter}</alter>`,
    `          <octave>${pitch.octave}</octave>`,
    "        </pitch>",
    `        <duration>${duration}</duration>`,
    "        <voice>1</voice>",
    note.volume !== undefined ? `        <notations><technical><fret>${note.volume}</fret></technical></notations>` : "",
    "      </note>"
  ].filter((line) => line !== "");
}

function writeRest(duration: number): string[] {
  return ["      <note>", "        <rest/>", `        <duration>${Math.max(1, duration)}</duration>`, "        <voice>1</voice>", "      </note>"];
}

function expandChannelNotes(channel: CommonChannel, patternLength: number): TimedNote[] {
  const notes: TimedNote[] = [];
  for (let orderIndex = 0; orderIndex < channel.order.length; orderIndex++) {
    const pattern = channel.patterns[channel.order[orderIndex] ?? 0];
    if (!pattern) continue;
    for (const row of pattern.rows) {
      if (row.note === undefined || row.note >= 180) continue;
      notes.push({
        ...row,
        absoluteRow: orderIndex * patternLength + row.row
      });
    }
  }
  return notes;
}

function midiToPitch(midi: number): { step: string; alter: number; octave: number } {
  const normalized = Math.max(0, Math.min(127, midi));
  const octave = Math.floor(normalized / 12) - 1;
  const pitchClass = normalized % 12;
  const names = [
    ["C", 0],
    ["C", 1],
    ["D", 0],
    ["D", 1],
    ["E", 0],
    ["F", 0],
    ["F", 1],
    ["G", 0],
    ["G", 1],
    ["A", 0],
    ["A", 1],
    ["B", 0]
  ] as const;
  const [step, alter] = names[pitchClass] ?? ["C", 0];
  return { step, alter, octave };
}

function partId(index: number): string {
  return `P${index + 1}`;
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
