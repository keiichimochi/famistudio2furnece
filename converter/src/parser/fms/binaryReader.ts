import { inflateRaw } from "pako";
import {
  activeChannelTypes,
  channelName,
  effectMasks,
  envelopeNames,
  FMS_CURRENT_VERSION,
  FMS_MAGIC
} from "./constants.js";
import type {
  FmsChannel,
  FmsDpcmMapping,
  FmsDpcmSample,
  FmsEffectValue,
  FmsEnvelope,
  FmsInstrument,
  FmsNote,
  FmsPattern,
  FmsProject,
  FmsSong,
  FmsTempo
} from "./types.js";

type RefResolver = {
  instrumentIds: Set<number>;
  arpeggioIds: Set<number>;
  sampleIds: Set<number>;
};

class BufferCursor {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  get remaining(): number {
    return this.buffer.length - this.offset;
  }

  eof(): boolean {
    return this.offset >= this.buffer.length;
  }

  tell(): number {
    return this.offset;
  }

  skip(bytes: number): void {
    this.ensure(bytes);
    this.offset += bytes;
  }

  bool(): boolean {
    return this.u8() !== 0;
  }

  u8(): number {
    this.ensure(1);
    return this.buffer.readUInt8(this.offset++);
  }

  i8(): number {
    this.ensure(1);
    return this.buffer.readInt8(this.offset++);
  }

  i16(): number {
    this.ensure(2);
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  u16(): number {
    this.ensure(2);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  i32(): number {
    this.ensure(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  f32(): number {
    this.ensure(4);
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  string(): string {
    const byteLength = this.i32();
    if (byteLength < 0) return "";
    this.ensure(byteLength);
    const value = this.buffer.toString("utf16le", this.offset, this.offset + byteLength);
    this.offset += byteLength;
    return value;
  }

  bytes(): Buffer {
    const length = this.i32();
    if (length < 0) return Buffer.alloc(0);
    this.ensure(length);
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  i16Array(): number[] {
    const length = this.i32();
    if (length < 0) return [];
    const values: number[] = [];
    for (let i = 0; i < length; i++) values.push(this.i16());
    return values;
  }

  i8Array(): number[] {
    const length = this.i32();
    if (length < 0) return [];
    const values: number[] = [];
    for (let i = 0; i < length; i++) values.push(this.i8());
    return values;
  }

  i32Array(): number[] {
    const length = this.i32();
    if (length < 0) return [];
    const values: number[] = [];
    for (let i = 0; i < length; i++) values.push(this.i32());
    return values;
  }

  color(): void {
    this.i32();
  }

  private ensure(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      throw new Error(`Unexpected end of FMS data at ${this.offset}; need ${bytes} byte(s).`);
    }
  }
}

export function readBinaryFms(file: Buffer): FmsProject {
  if (file.length < 12 || file.readUInt32LE(0) !== FMS_MAGIC) {
    throw new Error("Not a binary FamiStudio .fms file.");
  }

  const version = file.readInt32LE(4);
  if (version > FMS_CURRENT_VERSION) {
    throw new Error(`FMS version ${version} is newer than supported version ${FMS_CURRENT_VERSION}.`);
  }

  const expectedSize = file.readInt32LE(8);
  const compressed = file.subarray(12);
  const raw = Buffer.from(inflateRaw(compressed));
  if (raw.length !== expectedSize) {
    throw new Error(`FMS deflate size mismatch: expected ${expectedSize}, got ${raw.length}.`);
  }

  const reader = new BinaryFmsReader(raw, version);
  return reader.readProject();
}

class BinaryFmsReader {
  private readonly c: BufferCursor;
  private readonly warnings: string[] = [];
  private readonly refs: RefResolver = {
    instrumentIds: new Set(),
    arpeggioIds: new Set(),
    sampleIds: new Set()
  };

  private project = {
    name: "Untitled",
    author: "Unknown",
    copyright: "",
    pal: false,
    expansionMask: 0,
    numN163Channels: 1,
    tempoMode: 0
  };

  constructor(buffer: Buffer, private readonly version: number) {
    this.c = new BufferCursor(buffer);
  }

  readProject(): FmsProject {
    this.c.i32(); // nextUniqueId

    if (this.version >= 15) {
      this.c.bool();
      this.c.bool();
      this.c.bool();
      this.c.bool();
    }

    if (this.version >= 2) {
      this.project.name = this.c.string();
      this.project.author = this.c.string();
      this.project.copyright = this.c.string();
    }

    if (this.version >= 4) this.project.expansionMask = this.c.i32();
    if (this.version >= 5) {
      this.project.numN163Channels = this.c.i32();
      this.project.tempoMode = this.c.i32();
    } else {
      this.project.tempoMode = 1;
    }
    if (this.version >= 6) this.project.pal = this.c.bool();

    if (this.version >= 19) this.skipExportConfigs();
    if (this.version >= 17) this.c.i32(); // tuning
    if (this.version >= 16) this.skipFoldersAndEngineOptions();
    if (this.version >= 16) this.skipMixerSettings();

    const dpcmSamples = this.readDpcmSamples();
    const instruments = this.readInstruments();
    if (this.version >= 7) this.skipArpeggios();
    const songs = this.readSongs();

    if (!this.c.eof()) {
      this.warnings.push(`Unread trailing binary data: ${this.c.remaining} byte(s) at offset ${this.c.tell()}.`);
    }

    return {
      format: "binary-fms",
      version: this.version,
      name: this.project.name,
      author: this.project.author,
      copyright: this.project.copyright,
      pal: this.project.pal,
      expansionMask: this.project.expansionMask,
      instruments,
      dpcmSamples,
      songs,
      warnings: this.warnings
    };
  }

  private skipExportConfigs(): void {
    this.skipAudioExportConfig();
    this.skipVideoExportConfig();
    this.skipNsfExportConfig();
    this.skipRomFdsExportConfig();
    this.skipMidiExportConfig();
    this.skipVgmExportConfig();
    this.skipFamiStudioTextExportConfig();
    this.skipSongListOnlyConfig();
    this.skipMusicCodeExportConfig();
    this.skipSfxExportConfig();
    this.skipMusicCodeExportConfig();
    this.skipSfxExportConfig();
  }

  private skipChannelExportSettings(): void {
    this.c.i32();
    this.c.i32();
    this.c.bool();
    this.c.i32();
    this.c.i32();
    this.c.i32();
  }

  private skipSongListExportSettings(): void {
    this.c.i32();
    this.c.bool();
  }

  private skipAudioExportConfig(): void {
    this.c.i32();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.i32();
    this.c.i32();
    this.c.i32();
    this.c.bool();
    this.c.bool();
    this.c.bool();
    const channelCount = this.c.i32();
    for (let i = 0; i < channelCount; i++) this.skipChannelExportSettings();
  }

  private skipVideoExportConfig(): void {
    this.c.i32();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.i32();
    this.c.i32();
    this.c.i32();
    this.c.i32();
    this.c.i32();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.i32();
    this.c.string();
    this.c.bool();
    this.c.bool();
    const channelCount = this.c.i32();
    for (let i = 0; i < channelCount; i++) this.skipChannelExportSettings();
  }

  private skipNsfExportConfig(): void {
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.string();
    this.skipSongList();
  }

  private skipRomFdsExportConfig(): void {
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.string();
    this.skipSongList();
  }

  private skipMidiExportConfig(): void {
    this.c.i32();
    this.c.bool();
    this.c.bool();
    this.c.i32();
    this.c.string();
    const count = this.c.i32();
    for (let i = 0; i < count; i++) {
      this.c.i32();
      this.c.bool();
      this.c.i32();
      this.c.i32();
    }
  }

  private skipVgmExportConfig(): void {
    this.c.i32();
    for (let i = 0; i < 7; i++) this.c.string();
    this.c.bool();
  }

  private skipFamiStudioTextExportConfig(): void {
    this.c.bool();
    this.skipSongList();
  }

  private skipSongListOnlyConfig(): void {
    this.skipSongList();
  }

  private skipMusicCodeExportConfig(): void {
    this.c.string();
    this.c.bool();
    this.c.string();
    this.c.string();
    this.c.string();
    this.c.bool();
    this.c.bool();
    this.skipSongList();
  }

  private skipSfxExportConfig(): void {
    this.c.string();
    this.c.string();
    this.c.bool();
    this.skipSongList();
  }

  private skipSongList(): void {
    const count = this.c.i32();
    for (let i = 0; i < count; i++) this.skipSongListExportSettings();
  }

  private skipFoldersAndEngineOptions(): void {
    const folderCount = this.c.i32();
    for (let i = 0; i < folderCount; i++) {
      this.c.i32();
      this.c.string();
      this.c.bool();
    }
    this.c.bool();
    this.c.bool();
    this.c.bool();
  }

  private skipMixerSettings(): void {
    const overrideBassCutoffHz = this.c.bool();
    if (overrideBassCutoffHz) this.c.i32();
    const overrideMask = this.c.i32();
    for (let i = 0; i < 8; i++) {
      if ((overrideMask & (1 << i)) !== 0) {
        this.c.f32();
        this.c.f32();
        this.c.i32();
        if (i === 2) this.c.i32();
      }
    }
  }

  private readDpcmSamples(): FmsDpcmSample[] {
    const count = this.c.i32();
    const samples: FmsDpcmSample[] = [];
    for (let i = 0; i < count; i++) {
      const id = this.c.i32();
      this.refs.sampleIds.add(id);
      const name = this.c.string();
      let source: FmsDpcmSample["source"] = "unknown";
      let dataLength = 0;
      let bank = 0;
      let folder = "";

      if (this.version < 9) {
        dataLength = this.c.bytes().length;
        source = "dmc";
      } else {
        const sourceDataIsWav = this.c.bool();
        source = sourceDataIsWav ? "wav" : "dmc";
        if (sourceDataIsWav) {
          this.c.i32();
          dataLength = this.c.i16Array().length * 2;
        } else {
          dataLength = this.c.bytes().length;
        }
        this.c.color();
        if (this.version >= 15) bank = this.c.i32();
        if (this.version >= 16) folder = this.c.string();
        this.c.i32();
        this.c.i32();
        this.c.i32();
        this.c.i32();
        this.c.bool();
        this.c.bool();
        this.c.bool();
        for (let v = 0; v < 4; v++) {
          this.c.i32();
          this.c.f32();
        }
        if (this.version >= 10) this.c.string();
        if (this.version >= 11) {
          this.c.f32();
          this.c.i32();
        }
      }

      samples.push({ id, name, folder, bank, source, dataLength });
    }
    return samples;
  }

  private readInstruments(): FmsInstrument[] {
    const count = this.c.i32();
    const instruments: FmsInstrument[] = [];
    for (let i = 0; i < count; i++) {
      instruments.push(this.readInstrument());
    }
    return instruments;
  }

  private readInstrument(): FmsInstrument {
    const id = this.c.i32();
    this.refs.instrumentIds.add(id);
    const name = this.c.string();
    this.c.color();

    if (this.version < 5) this.c.i32();
    const expansion = this.version >= 4 ? this.c.i32() : 0;
    if (this.version >= 5) this.skipExpansionInstrumentFields(expansion);

    const envelopeMask = this.version < 15 ? this.c.u8() : this.c.u16();
    const envelopes: FmsEnvelope[] = [];
    for (let i = 0; i < envelopeNames.length; i++) {
      if ((envelopeMask & (1 << i)) !== 0) {
        envelopes.push(this.readEnvelope(envelopeNames[i]));
      }
    }

    const folder = this.version >= 16 ? this.c.string() : "";
    const dpcmMappings: FmsDpcmMapping[] = [];
    if (expansion === 0 && this.version >= 15) {
      const mappingCount = this.c.i32();
      const notes: number[] = [];
      for (let i = 0; i < mappingCount; i++) notes.push(this.c.i32());
      for (const note of notes) dpcmMappings.push(this.readDpcmMapping(note));
    }

    return {
      id,
      name,
      expansion: expansionName(expansion),
      folder,
      envelopes,
      dpcmMappings
    };
  }

  private skipExpansionInstrumentFields(expansion: number): void {
    switch (expansion) {
      case 1:
        if (this.version >= 10) this.c.i32();
        break;
      case 2:
        this.c.i32();
        for (let i = 0; i < 8; i++) this.c.i32();
        if (this.version >= 19) {
          this.c.bool();
          this.c.bool();
        }
        break;
      case 3:
        this.c.i32();
        this.c.i32();
        this.c.i32();
        this.c.i32();
        this.c.i32();
        this.c.i32();
        if (this.version >= 18) this.c.i32();
        if (this.version >= 16) {
          this.c.bool();
          this.c.i32();
          this.c.i32();
        }
        if (this.version >= 14) {
          this.c.f32();
          this.c.f32();
          this.c.bool();
          this.c.i16Array();
        }
        break;
      case 5:
        this.c.i32();
        this.c.i32();
        this.c.i32();
        if (this.version >= 14) {
          this.c.i32();
          this.c.f32();
          this.c.f32();
          this.c.bool();
          this.c.i16Array();
        }
        if (this.version >= 17) this.c.bool();
        break;
      case 6:
        if (this.version >= 16) {
          this.c.bool();
          this.c.i32();
          this.c.i32();
          this.c.i32();
        }
        break;
      case 7:
        this.c.i32();
        for (let i = 0; i < 31; i++) this.c.i32();
        if (this.version >= 16) {
          this.c.bool();
          this.c.i32();
          this.c.i32();
          this.c.i32();
        }
        break;
      default:
        break;
    }
  }

  private readEnvelope(type: string): FmsEnvelope {
    const length = this.c.i32();
    const loop = this.c.i32();
    const release = this.version >= 3 ? this.c.i32() : -1;
    const relative = this.version >= 4 ? this.c.bool() : false;
    const values = this.c.i8Array();
    return { type, length, loop, release, relative, values: values.slice(0, length) };
  }

  private readDpcmMapping(note: number): FmsDpcmMapping {
    const sample = this.c.i32();
    const loop = this.c.bool();
    const pitch = this.c.i32();
    if (this.version >= 13) {
      this.c.bool();
      this.c.i32();
    }
    return { note, sample, pitch, loop };
  }

  private skipArpeggios(): void {
    const count = this.c.i32();
    for (let i = 0; i < count; i++) {
      const id = this.c.i32();
      this.refs.arpeggioIds.add(id);
      this.c.string();
      this.c.color();
      if (this.version >= 16) this.c.string();
      this.readEnvelope("Arpeggio");
    }
  }

  private readSongs(): FmsSong[] {
    const count = this.c.i32();
    const songs: FmsSong[] = [];
    for (let i = 0; i < count; i++) songs.push(this.readSong());
    return songs;
  }

  private readSong(): FmsSong {
    const id = this.c.i32();
    const patternLength = this.c.i32();
    const length = this.c.i32();
    const beatLength = this.c.i32();
    const name = this.c.string();
    const famitrackerTempo = this.c.i32();
    const famitrackerSpeed = this.c.i32();
    this.c.color();
    let loopPoint = 0;
    let noteLength: number | undefined;
    let groove: number[] = [];
    let groovePaddingMode: number | undefined;

    if (this.version >= 5) {
      loopPoint = this.c.i32();
      noteLength = this.c.i32();
      groove = this.version >= 10 ? this.c.i32Array() : [noteLength];
      if (this.version >= 19) groovePaddingMode = this.c.i32();
      for (let i = 0; i < length; i++) {
        const custom = this.c.bool();
        this.c.i32();
        this.c.i32();
        this.c.i32();
        if (this.version >= 10) {
          this.c.i32Array();
          this.c.i32();
        }
        if (custom) this.warnings.push(`Song "${name}" has custom pattern tempo settings at pattern ${i}; recorded but not expanded in Phase 1.`);
      }
    }

    if (this.version >= 16) this.c.string();

    const tempo: FmsTempo = {
      mode: this.project.tempoMode === 0 ? "FamiStudio" : this.project.tempoMode === 1 ? "FamiTracker" : "Unknown",
      patternLength,
      beatLength,
      famitrackerTempo,
      famitrackerSpeed,
      noteLength,
      groove,
      groovePaddingMode
    };

    const channels = activeChannelTypes(this.project.expansionMask, this.project.numN163Channels).map((type) =>
      this.readChannel(type, length)
    );

    return { id, name, length, loopPoint, tempo, channels };
  }

  private readChannel(expectedType: number, songLength: number): FmsChannel {
    this.c.i32(); // song ref
    const patternCount = this.c.i32();
    const type = this.version >= 4 ? this.c.i32() : expectedType;
    const patterns: FmsPattern[] = [];
    for (let i = 0; i < patternCount; i++) patterns.push(this.readPattern(type));
    const order: Array<number | null> = [];
    for (let i = 0; i < 256; i++) {
      const patternId = this.c.i32();
      if (i < songLength) order.push(patternId < 0 ? null : patternId);
    }
    return { type, name: channelName(type), patterns, order };
  }

  private readPattern(channelType: number): FmsPattern {
    const id = this.c.i32();
    const name = this.c.string();
    const serializedChannelType = this.c.i32();
    this.c.color();
    this.c.i32(); // song ref
    const notes: FmsNote[] = [];
    if (this.version < 5) {
      this.warnings.push(`Pattern "${name}" uses pre-v5 dense notes; note parsing is not implemented in Phase 1.`);
      for (let i = 0; i < 256; i++) this.skipLegacyNote();
    } else {
      const count = this.c.i32();
      for (let i = 0; i < count; i++) {
        const time = this.c.i16();
        notes.push(this.readNote(time));
      }
    }
    const type = serializedChannelType >= 0 ? serializedChannelType : channelType;
    return { id, name, channelType: type, channel: channelName(type), notes };
  }

  private skipLegacyNote(): void {
    this.c.u8();
    this.c.u8();
    this.c.u8();
    this.c.i32();
    this.c.u8();
    this.c.u8();
    this.c.u8();
  }

  private readNote(time: number): FmsNote {
    const value = this.c.u8();
    const flags = this.c.u8();
    let slide = 0;
    let instrumentId: number | undefined;
    let duration: number | undefined;
    let release: number | undefined;
    const isMusical = value >= 1 && value <= 0x60;

    if (this.version < 10 || isMusical) {
      slide = this.c.u8();
      const ref = this.c.i32();
      if (ref >= 0) instrumentId = ref;
    }

    if (this.version >= 10) {
      if (isMusical) {
        duration = this.c.u16();
        release = this.c.u16();
      } else if (value === 0) {
        duration = 1;
      }
    }

    const effectMask = this.c.u16();
    const effects: Record<string, FmsEffectValue> = {};
    if ((effectMask & effectMasks.volume) !== 0) effects.volume = this.c.u8();
    if ((effectMask & effectMasks.vibrato) !== 0) effects.vibrato = this.c.u8();
    if ((effectMask & effectMasks.speed) !== 0) effects.speed = this.c.u8();
    if ((effectMask & effectMasks.finePitch) !== 0) effects.finePitch = this.c.i8();
    if ((effectMask & effectMasks.fdsModSpeed) !== 0) effects.fdsModSpeed = this.c.u16();
    if ((effectMask & effectMasks.fdsModDepth) !== 0) effects.fdsModDepth = this.c.u8();
    if (this.version >= 8 && (effectMask & effectMasks.dutyCycle) !== 0) effects.dutyCycle = this.c.u8();
    if (this.version >= 8 && (effectMask & effectMasks.noteDelay) !== 0) effects.noteDelay = this.c.u8();
    if (this.version >= 8 && (effectMask & effectMasks.cutDelay) !== 0) effects.cutDelay = this.c.u8();
    if (this.version >= 11 && (effectMask & (effectMasks.volume | effectMasks.volumeSlide)) === (effectMasks.volume | effectMasks.volumeSlide)) {
      effects.volumeSlide = this.c.u8();
    }
    if (this.version >= 13 && (effectMask & effectMasks.deltaCounter) !== 0) effects.deltaCounter = this.c.u8();
    if (this.version >= 15 && (effectMask & effectMasks.phaseReset) !== 0) effects.phaseReset = this.c.u8();
    if (this.version >= 16 && (effectMask & effectMasks.envelopePeriod) !== 0) effects.envelopePeriod = this.c.u16();

    let arpeggioId: number | undefined;
    if (this.version >= 7) {
      const ref = this.c.i32();
      if (ref >= 0) arpeggioId = ref;
    }

    return { time, value, flags, slide, instrumentId, duration, release, effectMask, effects, arpeggioId };
  }
}

function expansionName(expansion: number): string {
  switch (expansion) {
    case 0:
      return "None";
    case 1:
      return "VRC6";
    case 2:
      return "VRC7";
    case 3:
      return "FDS";
    case 4:
      return "MMC5";
    case 5:
      return "N163";
    case 6:
      return "S5B";
    case 7:
      return "EPSM";
    default:
      return `Expansion${expansion}`;
  }
}
