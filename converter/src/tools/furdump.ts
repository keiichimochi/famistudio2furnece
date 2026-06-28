#!/usr/bin/env node
import { Command } from "commander";
import { formatFurDump, readFurFile } from "../parser/fur/index.js";

const program = new Command();

program
  .name("furdump")
  .argument("<file>", "Furnace .fur file")
  .action(async (file: string) => {
    const module = await readFurFile(file);
    process.stdout.write(`${formatFurDump(module)}\n`);
  });

await program.parseAsync();
