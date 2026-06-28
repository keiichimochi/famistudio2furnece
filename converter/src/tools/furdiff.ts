#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { Command } from "commander";

const program = new Command();

program
  .name("furdiff")
  .argument("<expected>", "expected .fur file")
  .argument("<actual>", "actual .fur file")
  .option("-l, --limit <count>", "maximum differences to print", "32")
  .action(async (expectedPath: string, actualPath: string, options: { limit: string }) => {
    const expected = await readFile(expectedPath);
    const actual = await readFile(actualPath);
    const limit = Number.parseInt(options.limit, 10);
    let count = 0;
    const max = Math.max(expected.length, actual.length);
    for (let offset = 0; offset < max; offset++) {
      const a = expected[offset];
      const b = actual[offset];
      if (a !== b) {
        process.stdout.write(
          `Offset 0x${offset.toString(16).padStart(6, "0")}\nExpected ${formatByte(a)}\nActual   ${formatByte(b)}\n\n`
        );
        count++;
        if (count >= limit) break;
      }
    }
    if (count === 0) process.stdout.write("Files are identical.\n");
  });

await program.parseAsync();

function formatByte(value: number | undefined): string {
  return value === undefined ? "<EOF>" : value.toString(16).padStart(2, "0");
}
