#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { readFurDocument } from "../parser/fur/index.js";
import { writeFurRoundTrip } from "../writer/fur068/index.js";

const program = new Command();

program
  .name("furroundtrip")
  .argument("<input>", "input Furnace .fur file")
  .argument("<output>", "output Furnace .fur file")
  .option("--compress", "write zlib-compressed output")
  .option("--uncompressed", "write uncompressed output")
  .action(async (input: string, output: string, options: { compress?: boolean; uncompressed?: boolean }) => {
    const document = await readFurDocument(input);
    const compress = options.compress ? true : options.uncompressed ? false : document.compressed;
    await writeFile(output, writeFurRoundTrip(document, { compress }));
    process.stdout.write(`Wrote ${output}\n`);
  });

await program.parseAsync();
