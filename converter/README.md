# fms2fur

FamiStudio (`.fms`) and NSF (`.nsf`) sources to Game Boy Furnace 0.6.8.3 projects.

## Requirements

- Node.js 22+
- npm
- TypeScript / ESM
- No Docker
- No Python

## CLI

```sh
npm install
npm run build
node dist/cli.js inspect fixtures/battle.fms
node dist/cli.js convert fixtures/battle.fms -o battle.fur
```

NSF import uses FamiStudio's command-line NSF importer first, then converts the generated FamiStudio text project through the normal pipeline.

```sh
node dist/cli.js nsf-inspect music.nsf
node dist/cli.js nsf-convert music.nsf \
  --wavetable ../sample/wavetable.fuw \
  --out-dir ./out
node dist/cli.js ui \
  --wavetable ../sample/wavetable.fuw
```

If FamiStudio is not in the default location, pass `--famistudio <path>` or set `FAMISTUDIO_CLI`.

Output:

```txt
Project
Name : ...
Format : binary-fms v19
Songs : 1

Song 0
Name : ...

Channels
Square1
Square2
Triangle
Noise
DPCM

Pattern Count : ...
Instrument Count : ...
DPCM Count : ...
```

## Architecture

```txt
FamiStudio (.fms)
NSF (.nsf) -> FamiStudio CLI -> FamiStudio text
  -> common JSON IR
  -> Furnace (.fur)
  -> DefleMask (.dmf)
```

## Mapping Plan

| NES/FamiStudio | Game Boy |
| --- | --- |
| Square1 / Pulse1 | GB Square1 |
| Square2 / Pulse2 | GB Square2 |
| Triangle | GB Wave |
| Noise | GB Noise |
| DPCM | muted, or approximated to Noise in a later phase |

## Phase Status

| Phase | Status |
| --- | --- |
| Phase 1 FMS Reader | Implemented: binary `.fms`, FamiStudio text, inspect CLI, Vitest coverage |
| Phase 2 Common JSON | Implemented for current converter path |
| Phase 3 NES to Game Boy mapping | Implemented for pulse/triangle/noise/DPCM mute |
| Phase 4 Envelope conversion | Not started |
| Phase 5 Pattern conversion | Not started |
| Phase 6 Effect conversion | Not started |
| Phase 7 Instrument conversion | Not started |
| Phase 8 Furnace writer | In progress: Furnace 0.6.8.3 `.fur` writer, FUW wavetable embedding |
| Phase 9 DefleMask writer | Not started |
| Phase 10 Full convert CLI | Not started |

## Conversion Spec

Phase 1 preserves these FamiStudio structures:

- Songs
- Instruments
- Channels
- Patterns
- Tempo metadata
- Envelopes
- DPCM samples and mappings

NSF conversion currently relies on FamiStudio's NSF importer. The UI lists NSF songs, imports each song through FamiStudio, embeds the configured `.fuw` wavetable for GB Wave usage, and saves one `.fur` per NSF song.

## Unsupported Effects

All effects are currently parsed as source metadata only. Effect conversion starts in Phase 6, where unsupported effects will emit warnings.

## Fixtures

`fixtures/battle.fms`, `fixtures/town.fms`, and `fixtures/boss.fms` are placeholders using an official FamiStudio unit-test project until FF3-oriented fixtures are added.
