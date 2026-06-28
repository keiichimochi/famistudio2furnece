#!/usr/bin/env node
import { dirname, join, parse } from "node:path";
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { fmsToCommonProject } from "./mapper/common.js";
import { writeNsfFurFiles } from "./nsfConvert.js";
import { inspectProject, readFmsFile } from "./parser/fms/index.js";
import { formatNsfTrackList, readNsfFile } from "./parser/nsf/index.js";
import { startUiServer } from "./uiServer.js";
import { writeFur068FromCommon } from "./writer/fur068/convert.js";

const program = new Command();

program.name("fms2fur").description("FamiStudio to Game Boy tracker converter").version("0.1.0");

program
  .command("inspect")
  .argument("<file>", "FamiStudio .fms project or FamiStudio Text export")
  .description("Read a FamiStudio project and print a Phase 1 structural summary")
  .action(async (file: string) => {
    const project = await readFmsFile(file);
    process.stdout.write(`${inspectProject(project)}\n`);
  });

program
  .command("convert")
  .argument("<file>", "FamiStudio .fms project")
  .option("-o, --out <file>", "output Furnace 0.6.8.3 .fur file")
  .description("Convert FamiStudio songs to Furnace/DefleMask projects")
  .action(async (file: string, options: { out?: string }) => {
    const fms = await readFmsFile(file);
    const common = fmsToCommonProject(fms, 0);
    const parsed = parse(file);
    const output = options.out ?? join(dirname(file), `${parsed.name}.fur`);
    await writeFile(output, writeFur068FromCommon(common));
    process.stdout.write(`Wrote ${output}\n`);
    if (common.warnings.length > 0) {
      process.stderr.write(`Warnings:\n${common.warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
    }
  });

program
  .command("nsf-inspect")
  .argument("<file>", "NES Sound Format .nsf file")
  .description("Read an NSF header and list contained songs")
  .action(async (file: string) => {
    process.stdout.write(`${formatNsfTrackList(await readNsfFile(file))}\n`);
  });

program
  .command("nsf-convert")
  .argument("<file>", "NES Sound Format .nsf file")
  .option("-o, --out-dir <dir>", "output directory", ".")
  .option("-w, --wavetable <file>", "Furnace .fuw wavetable to embed")
  .option("--famistudio <file>", "FamiStudio CLI executable")
  .option("--duration <sec>", "NSF capture duration in seconds", (value) => Number.parseInt(value, 10), 120)
  .option("--pattern-length <rows>", "FamiStudio NSF import pattern length", (value) => Number.parseInt(value, 10), 256)
  .description("Create one Furnace 0.6.8.3 .fur shell per NSF song")
  .action(async (file: string, options: { outDir: string; wavetable?: string; famistudio?: string; duration: number; patternLength: number }) => {
    const files = await writeNsfFurFiles(file, options.outDir, {
      wavetable: options.wavetable,
      famistudio: options.famistudio,
      duration: options.duration,
      patternLength: options.patternLength
    });
    for (const output of files) process.stdout.write(`Wrote ${join(options.outDir, output.name)}\n`);
    const warnings = new Set(files.flatMap((output) => output.warnings));
    if (warnings.size > 0) process.stderr.write(`Warnings:\n${[...warnings].map((warning) => `- ${warning}`).join("\n")}\n`);
  });

program
  .command("ui")
  .option("-p, --port <port>", "local UI port", (value) => Number.parseInt(value, 10), 51737)
  .option("-w, --wavetable <file>", "Furnace .fuw wavetable to embed", join(import.meta.dirname, "..", "..", "sample", "wavetable.fuw"))
  .option("--famistudio <file>", "FamiStudio CLI executable")
  .option("--duration <sec>", "NSF capture duration in seconds", (value) => Number.parseInt(value, 10), 120)
  .option("--pattern-length <rows>", "FamiStudio NSF import pattern length", (value) => Number.parseInt(value, 10), 256)
  .description("Start the local NSF batch conversion UI")
  .action((options: { port: number; wavetable?: string; famistudio?: string; duration: number; patternLength: number }) => {
    startUiServer({
      port: options.port,
      wavetable: options.wavetable,
      famistudio: options.famistudio,
      duration: options.duration,
      patternLength: options.patternLength
    });
  });

await program.parseAsync();
