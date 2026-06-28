# fms2fur

FamiStudio (`.fms`) projects to Game Boy tracker projects.

Phase 1 is implemented first: project inspection and structural parsing. Conversion writers are intentionally not implemented yet.

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
```

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
| Phase 1 FMS Reader | In progress: binary `.fms` header/Deflate/project summary reader, text export reader, inspect CLI, Vitest coverage |
| Phase 2 Common JSON | Not started |
| Phase 3 NES to Game Boy mapping | Not started |
| Phase 4 Envelope conversion | Not started |
| Phase 5 Pattern conversion | Not started |
| Phase 6 Effect conversion | Not started |
| Phase 7 Instrument conversion | Not started |
| Phase 8 Furnace writer | Not started |
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

No musical conversion is performed yet.

## Unsupported Effects

All effects are currently parsed as source metadata only. Effect conversion starts in Phase 6, where unsupported effects will emit warnings.

## Fixtures

`fixtures/battle.fms`, `fixtures/town.fms`, and `fixtures/boss.fms` are placeholders using an official FamiStudio unit-test project until FF3-oriented fixtures are added.
