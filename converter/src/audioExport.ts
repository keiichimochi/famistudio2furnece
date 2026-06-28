import { execFile } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type AudioExportOptions = {
  furnace?: string;
  ffmpeg?: string;
  loops?: number;
};

export type AudioExportResult = {
  fur: string;
  wav: string;
  mp3: string;
};

export async function renderFurToMp3(furPath: string, options: AudioExportOptions = {}): Promise<AudioExportResult> {
  if (extname(furPath).toLowerCase() !== ".fur") throw new Error("Only .fur files can be rendered.");
  await ensureReadable(furPath, "FUR file");

  const base = basename(furPath, extname(furPath));
  const outputDir = dirname(furPath);
  const wav = join(outputDir, `${base}.wav`);
  const mp3 = join(outputDir, `${base}.mp3`);
  const furnace = await resolveExecutable(options.furnace ?? process.env.FURNACE_CLI, defaultFurnaceCandidates());
  const ffmpeg = await resolveExecutable(options.ffmpeg ?? process.env.FFMPEG, defaultFfmpegCandidates());

  await runCommand(
    furnace,
    [
      "-loglevel",
      "error",
      "-noreport",
      "-nocontrols",
      "-nostatus",
      "-loops",
      String(options.loops ?? 0),
      "-output",
      wav,
      furPath
    ],
    "Furnace WAV render"
  );
  await ensureNonEmpty(wav, "WAV output");

  await runCommand(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "2", mp3], "ffmpeg MP3 encode");
  await ensureNonEmpty(mp3, "MP3 output");

  return { fur: furPath, wav, mp3 };
}

async function resolveExecutable(explicit: string | undefined, candidates: string[]): Promise<string> {
  if (explicit) {
    await ensureReadable(explicit, "executable");
    return explicit;
  }
  for (const candidate of candidates) {
    if (!candidate.includes("/")) return candidate;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return candidates[candidates.length - 1] ?? "furnace";
}

function defaultFurnaceCandidates(): string[] {
  if (process.platform === "darwin") return ["/Applications/Furnace.app/Contents/MacOS/Furnace", "furnace"];
  return ["furnace"];
}

function defaultFfmpegCandidates(): string[] {
  if (process.platform === "darwin") return ["/opt/homebrew/bin/ffmpeg", "ffmpeg"];
  return ["ffmpeg"];
}

async function ensureReadable(path: string, label: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} not found: ${path}`);
  }
}

async function ensureNonEmpty(path: string, label: string): Promise<void> {
  const info = await stat(path);
  if (info.size <= 44) throw new Error(`${label} is empty: ${path}`);
}

async function runCommand(command: string, args: string[], label: string): Promise<void> {
  try {
    await execFileAsync(command, args, {
      timeout: 600_000,
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    const detail = commandErrorDetail(error);
    throw new Error(`${label} failed: ${detail}`);
  }
}

function commandErrorDetail(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const stderrValue = (error as Error & { stderr?: unknown }).stderr;
  const stderr = typeof stderrValue === "string" ? stderrValue.trim() : "";
  if (stderr.length === 0) return error.message;
  return `${error.message}\n${stderr.slice(-2000)}`;
}
