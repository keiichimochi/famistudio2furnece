#!/usr/bin/env node
import { Command } from "commander";
import { inspectProject, readFmsFile } from "./parser/fms/index.js";

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
  .description("Convert FamiStudio songs to Furnace/DefleMask projects")
  .action(async (file: string) => {
    await readFmsFile(file);
    throw new Error(
      "convert is disabled until the Furnace 0.6.8.3 round-trip writer is implemented. Use furdump/furdiff first."
    );
  });

await program.parseAsync();
