import type { CommonChannel, CommonNote, CommonPattern, CommonProject } from "../mapper/common.js";

export type CommonOptimizerOptions = {
  carryActiveVolume?: boolean;
  retriggerNoiseVolumes?: boolean;
  addCrossPatternNoteOffs?: boolean;
};

const DEFAULT_OPTIONS: Required<CommonOptimizerOptions> = {
  carryActiveVolume: true,
  retriggerNoiseVolumes: true,
  addCrossPatternNoteOffs: true
};

export function optimizeCommonProject(project: CommonProject, options: CommonOptimizerOptions = {}): CommonProject {
  const enabled = { ...DEFAULT_OPTIONS, ...options };
  for (const channel of project.song.channels) {
    if (enabled.carryActiveVolume) carryActiveVolume(channel);
    if (enabled.retriggerNoiseVolumes && channel.target === "GB Noise") retriggerNoiseVolumes(channel);
    if (enabled.addCrossPatternNoteOffs) addCrossPatternNoteOffs(channel, project.song.patternLength);
  }
  return project;
}

function carryActiveVolume(channel: CommonChannel): void {
  for (const pattern of channel.patterns) {
    let currentVolume: number | undefined;
    for (const row of pattern.rows) {
      if (row.note !== undefined && row.note < 180 && row.volume === undefined && currentVolume !== undefined) {
        row.volume = currentVolume;
      }
      if (row.volume !== undefined) currentVolume = row.volume;
    }
  }
}

function retriggerNoiseVolumes(channel: CommonChannel): void {
  for (const pattern of channel.patterns) {
    let lastNoiseNote: Pick<CommonNote, "note" | "instrument"> | undefined;
    for (const row of pattern.rows) {
      if (row.note !== undefined && row.note < 180) {
        lastNoiseNote = { note: row.note, instrument: row.instrument };
      } else if (row.note !== undefined) {
        lastNoiseNote = undefined;
      } else if (row.volume !== undefined && lastNoiseNote) {
        row.note = lastNoiseNote.note;
        row.instrument = lastNoiseNote.instrument;
      }
    }
  }
}

function addCrossPatternNoteOffs(channel: CommonChannel, patternLength: number): void {
  for (let orderIndex = 0; orderIndex < channel.order.length; orderIndex++) {
    const pattern = channel.patterns[channel.order[orderIndex] ?? 0];
    if (!pattern) continue;

    for (const row of pattern.rows) {
      if (row.note === undefined || row.note >= 180 || row.duration === undefined) continue;
      const absoluteEnd = orderIndex * patternLength + row.row + row.duration;
      const targetOrderIndex = Math.floor(absoluteEnd / patternLength);
      if (targetOrderIndex <= orderIndex || targetOrderIndex >= channel.order.length) continue;

      if (channel.target === "GB Noise") {
        addCrossPatternNoiseContinuation(channel, orderIndex + 1, targetOrderIndex, absoluteEnd, patternLength, row);
      }

      const targetRow = absoluteEnd % patternLength;
      const targetPattern = channel.patterns[channel.order[targetOrderIndex] ?? 0];
      if (!targetPattern) continue;
      if (targetPattern.rows.some((target) => target.row === targetRow && target.note !== undefined && target.note < 180)) continue;

      upsertRow(targetPattern, {
        row: targetRow,
        note: 180,
        source: row.source
      });
    }
  }
}

function addCrossPatternNoiseContinuation(
  channel: CommonChannel,
  startOrderIndex: number,
  endOrderIndex: number,
  absoluteEnd: number,
  patternLength: number,
  sourceRow: CommonNote
): void {
  for (let orderIndex = startOrderIndex; orderIndex <= endOrderIndex; orderIndex++) {
    const pattern = channel.patterns[channel.order[orderIndex] ?? 0];
    if (!pattern) continue;
    const endRow = orderIndex === endOrderIndex ? absoluteEnd % patternLength : patternLength;

    for (let rowIndex = 0; rowIndex < pattern.rows.length; rowIndex++) {
      const row = pattern.rows[rowIndex];
      if (row.row >= endRow || row.note !== undefined || row.volume === undefined) continue;
      pattern.rows[rowIndex] = mergeRow(row, {
        row: row.row,
        note: sourceRow.note,
        instrument: sourceRow.instrument,
        source: sourceRow.source
      });
    }
  }
}

function upsertRow(pattern: CommonPattern, row: CommonNote): void {
  const existingIndex = pattern.rows.findIndex((target) => target.row === row.row);
  if (existingIndex >= 0) {
    pattern.rows[existingIndex] = mergeRow(pattern.rows[existingIndex], row);
  } else {
    pattern.rows.push(row);
    pattern.rows.sort((a, b) => a.row - b.row);
  }
}

function mergeRow(base: CommonNote, next: CommonNote): CommonNote {
  return {
    row: base.row,
    note: next.note ?? base.note,
    instrument: next.instrument ?? base.instrument,
    duration: next.duration ?? base.duration,
    volume: next.volume ?? base.volume,
    effects: next.effects?.length ? next.effects : base.effects,
    source: next.source
  };
}
