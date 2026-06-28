#!/usr/bin/env node
import { Command } from "commander";
import { formatFurDump, readFurFile } from "../parser/fur/index.js";

const program = new Command();

program
  .name("furdump")
  .argument("<file>", "Furnace .fur file")
  .option("--rows", "include decoded pattern rows")
  .option("--row-limit <count>", "rows to print per pattern", "16")
  .action(async (file: string, options: { rows?: boolean; rowLimit: string }) => {
    const module = await readFurFile(file);
    process.stdout.write(`${formatFurDump(module, { rows: options.rows, rowLimit: Number.parseInt(options.rowLimit, 10) })}\n`);
  });

await program.parseAsync();
