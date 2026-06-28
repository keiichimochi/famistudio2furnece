#!/usr/bin/env node
import { Command } from "commander";
import { dirname, join, parse } from "node:path";
import { writeFile } from "node:fs/promises";
import { fmsToCommonProject } from "./mapper/common.js";
import { inspectProject, readFmsFile } from "./parser/fms/index.js";
import { writeFur } from "./writer/fur/index.js";

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
  .option("-o, --out <file>", "output .fur file")
  .description("Convert FamiStudio songs to Furnace/DefleMask projects")
  .action(async (file: string, options: { out?: string }) => {
    const fms = await readFmsFile(file);
    const common = fmsToCommonProject(fms, 0);
    const fur = writeFur(common);
    const parsed = parse(file);
    const output = options.out ?? join(dirname(file), `${parsed.name}.fur`);
    await writeFile(output, fur);
    process.stdout.write(`Wrote ${output}\n`);
    if (common.warnings.length > 0) {
      process.stderr.write(`Warnings:\n${common.warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
    }
  });

await program.parseAsync();
