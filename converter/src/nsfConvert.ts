import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, parse } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fmsToCommonProject } from "./mapper/common.js";
import { readFmsFile } from "./parser/fms/index.js";
import { readFuwFile } from "./parser/fur/wavetable.js";
import { readNsfBuffer, readNsfFile, type NsfDocument, type NsfTrack } from "./parser/nsf/index.js";
import { writeFur068FromCommon } from "./writer/fur068/convert.js";

const execFileAsync = promisify(execFile);

export type ConvertedFurFile = {
  name: string;
  data: Buffer;
  warnings: string[];
};

export type NsfConversionOptions = {
  wavetable?: string;
  famistudio?: string;
  duration?: number;
  patternLength?: number;
};

export async function convertNsfFileToFurFiles(path: string, options: NsfConversionOptions = {}): Promise<ConvertedFurFile[]> {
  return convertNsfDocumentToFurFiles(await readNsfFile(path), path, options);
}

export async function convertNsfBufferToFurFiles(
  buffer: Buffer,
  fileName: string,
  options: NsfConversionOptions = {}
): Promise<{ document: NsfDocument; files: ConvertedFurFile[] }> {
  const document = readNsfBuffer(buffer);
  const tempDir = await mkdtemp(join(tmpdir(), "fms2fur-nsf-"));
  const inputPath = join(tempDir, basename(fileName) || "upload.nsf");
  try {
    await writeFile(inputPath, buffer);
    const files = await convertNsfDocumentToFurFiles(document, inputPath, options);
    return { document, files };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

export async function writeNsfFurFiles(path: string, outDir: string, options: NsfConversionOptions = {}): Promise<ConvertedFurFile[]> {
  const files = await convertNsfFileToFurFiles(path, options);
  await mkdir(outDir, { recursive: true });
  for (const file of files) {
    await writeFile(join(outDir, file.name), file.data);
  }
  return files;
}

async function convertNsfDocumentToFurFiles(
  document: NsfDocument,
  inputPath: string,
  options: NsfConversionOptions
): Promise<ConvertedFurFile[]> {
  const wavetables = options.wavetable ? await readFuwFile(options.wavetable) : [];
  const tempDir = await mkdtemp(join(tmpdir(), "fms2fur-famistudio-"));
  try {
    const files: ConvertedFurFile[] = [];
    for (const track of document.tracks) {
      const textPath = join(tempDir, `${String(track.index).padStart(2, "0")}.txt`);
      await importNsfTrackWithFamiStudio(inputPath, textPath, track, options);
      const project = await readFmsFile(textPath);
      const common = fmsToCommonProject(project, 0);
      common.name = document.header.title || common.name;
      common.author = document.header.artist || common.author;
      common.song.name = track.name;
      common.song.author = document.header.artist || common.song.author;
      common.wavetables = wavetables.map((wavetable, index) => ({ name: `Triangle ${index + 1}`, block: wavetable.block }));
      files.push({
        name: `${sanitizeFileName(document.header.title || parse(inputPath).name || "nsf")}-${String(track.index + 1).padStart(2, "0")}.fur`,
        data: writeFur068FromCommon(common),
        warnings: common.warnings
      });
    }
    return files;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function importNsfTrackWithFamiStudio(
  inputPath: string,
  outputPath: string,
  track: NsfTrack,
  options: NsfConversionOptions
): Promise<void> {
  const executable = options.famistudio ?? resolveDefaultFamiStudioExecutable();
  const args = [
    inputPath,
    "famistudio-txt-export",
    outputPath,
    `-nsf-import-song:${track.index}`,
    `-nsf-import-duration:${options.duration ?? 120}`,
    `-nsf-import-pattern-length:${options.patternLength ?? 256}`
  ];
  try {
    await execFileAsync(executable, args, { timeout: 180_000, maxBuffer: 1024 * 1024 * 8 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`FamiStudio NSF import failed for song ${track.index}: ${detail}`);
  }
}

function resolveDefaultFamiStudioExecutable(): string {
  if (process.env.FAMISTUDIO_CLI) return process.env.FAMISTUDIO_CLI;
  if (process.platform === "darwin") return "/Applications/FamiStudio.app/Contents/MacOS/main.command";
  if (process.platform === "win32") return "FamiStudio.exe";
  return "FamiStudio";
}

function sanitizeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "nsf"
  );
}
