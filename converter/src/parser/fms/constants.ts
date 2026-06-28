export const FMS_MAGIC = 0x21534d46;
export const FMS_CURRENT_VERSION = 19;

export const envelopeNames = [
  "Volume",
  "Arpeggio",
  "Pitch",
  "DutyCycle",
  "FDSWave",
  "FDSMod",
  "N163Wave",
  "Repeat",
  "MixerSettings",
  "NoiseFreq"
] as const;

export const channelNames = [
  "Square1",
  "Square2",
  "Triangle",
  "Noise",
  "DPCM",
  "VRC6Square1",
  "VRC6Square2",
  "VRC6Saw",
  "VRC7FM1",
  "VRC7FM2",
  "VRC7FM3",
  "VRC7FM4",
  "VRC7FM5",
  "VRC7FM6",
  "FDS",
  "MMC5Square1",
  "MMC5Square2",
  "MMC5DPCM",
  "N163Wave1",
  "N163Wave2",
  "N163Wave3",
  "N163Wave4",
  "N163Wave5",
  "N163Wave6",
  "N163Wave7",
  "N163Wave8",
  "S5BSquare1",
  "S5BSquare2",
  "S5BSquare3",
  "EPSMSquare1",
  "EPSMSquare2",
  "EPSMSquare3",
  "EPSMFM1",
  "EPSMFM2",
  "EPSMFM3",
  "EPSMFM4",
  "EPSMFM5",
  "EPSMFM6",
  "EPSMRythm1",
  "EPSMRythm2",
  "EPSMRythm3",
  "EPSMRythm4",
  "EPSMRythm5",
  "EPSMRythm6"
] as const;

export const expansionMasks = {
  vrc6: 1 << 0,
  vrc7: 1 << 1,
  fds: 1 << 2,
  mmc5: 1 << 3,
  n163: 1 << 4,
  s5b: 1 << 5,
  epsm: 1 << 6
} as const;

export const effectMasks = {
  volume: 1 << 0,
  vibrato: (1 << 1) | (1 << 2),
  finePitch: 1 << 3,
  speed: 1 << 4,
  fdsModDepth: 1 << 5,
  fdsModSpeed: 1 << 6,
  dutyCycle: 1 << 7,
  noteDelay: 1 << 8,
  cutDelay: 1 << 9,
  volumeSlide: 1 << 10,
  deltaCounter: 1 << 11,
  phaseReset: 1 << 12,
  envelopePeriod: 1 << 13
} as const;

export function channelName(type: number): string {
  return channelNames[type] ?? `Channel${type}`;
}

export function activeChannelTypes(expansionMask: number, numN163Channels: number): number[] {
  const types = [0, 1, 2, 3, 4];
  if ((expansionMask & expansionMasks.vrc6) !== 0) types.push(5, 6, 7);
  if ((expansionMask & expansionMasks.vrc7) !== 0) types.push(8, 9, 10, 11, 12, 13);
  if ((expansionMask & expansionMasks.fds) !== 0) types.push(14);
  if ((expansionMask & expansionMasks.mmc5) !== 0) types.push(15, 16);
  if ((expansionMask & expansionMasks.n163) !== 0) {
    for (let i = 0; i < Math.max(0, Math.min(numN163Channels, 8)); i++) types.push(18 + i);
  }
  if ((expansionMask & expansionMasks.s5b) !== 0) types.push(26, 27, 28);
  if ((expansionMask & expansionMasks.epsm) !== 0) {
    for (let i = 29; i <= 43; i++) types.push(i);
  }
  return types;
}
