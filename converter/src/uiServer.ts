import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { renderFurToMp3 } from "./audioExport.js";
import { writeNsfBufferProjectFiles } from "./nsfConvert.js";
import { readNsfBuffer } from "./parser/nsf/index.js";

export type UiServerOptions = {
  port: number;
  wavetable?: string;
  famistudio?: string;
  duration?: number;
  patternLength?: number;
  outputRoot?: string;
  furnace?: string;
  ffmpeg?: string;
};

export function startUiServer(options: UiServerOptions): void {
  const server = createServer(async (request, response) => {
    try {
      await route(request, response, options);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.listen(options.port, "127.0.0.1", () => {
    process.stdout.write(`NSF converter UI: http://127.0.0.1:${options.port}/\n`);
  });
}

async function route(request: IncomingMessage, response: ServerResponse, options: UiServerOptions): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (request.method === "GET" && url.pathname === "/") {
    send(response, 200, "text/html; charset=utf-8", INDEX_HTML);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/wavetable") {
    sendJson(response, 200, { wavetable: options.wavetable ?? null });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/inspect") {
    const body = await readBody(request);
    const document = readNsfBuffer(body);
    sendJson(response, 200, { header: document.header, tracks: document.tracks });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/convert") {
    const fileName = url.searchParams.get("name") ?? "upload.nsf";
    const body = await readBody(request);
    const output = await writeNsfBufferProjectFiles(body, fileName, options.outputRoot ?? join(process.cwd(), "out"), {
      wavetable: options.wavetable,
      famistudio: options.famistudio,
      duration: options.duration,
      patternLength: options.patternLength
    });
    sendJson(response, 200, {
      header: output.document.header,
      tracks: output.document.tracks,
      outputDir: output.result.outputDir,
      files: output.result.files
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/render-mp3") {
    const json = JSON.parse((await readBody(request)).toString("utf8")) as { fur?: unknown };
    if (typeof json.fur !== "string") throw new Error("Missing FUR path.");
    const fur = await resolveOutputFile(json.fur, options.outputRoot ?? join(process.cwd(), "out"));
    const output = await renderFurToMp3(fur, {
      furnace: options.furnace,
      ffmpeg: options.ffmpeg
    });
    sendJson(response, 200, output);
    return;
  }
  if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/api/file") {
    const path = url.searchParams.get("path");
    if (!path) throw new Error("Missing file path.");
    const file = await resolveOutputFile(path, options.outputRoot ?? join(process.cwd(), "out"));
    await sendFile(request, response, file);
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/wavetable/download" && options.wavetable) {
    send(response, 200, contentType(options.wavetable), await readFile(options.wavetable));
    return;
  }
  sendJson(response, 404, { error: "Not found" });
}

async function resolveOutputFile(path: string, outputRoot: string): Promise<string> {
  const root = await realpath(outputRoot);
  const file = await realpath(path);
  const child = relative(root, file);
  if (child.startsWith("..") || isAbsolute(child)) throw new Error(`File is outside the output directory: ${path}`);
  return file;
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  send(response, status, "application/json; charset=utf-8", Buffer.from(JSON.stringify(value)));
}

function send(response: ServerResponse, status: number, type: string, body: string | Buffer): void {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": "http://127.0.0.1"
  });
  response.end(body);
}

async function sendFile(request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
  const info = await stat(path);
  const headers = {
    "content-type": contentType(path),
    "content-disposition": `inline; filename="${basename(path).replace(/"/g, "")}"`,
    "cache-control": "no-store",
    "access-control-allow-origin": "http://127.0.0.1",
    "accept-ranges": "bytes"
  };
  const range = request.headers.range;
  if (typeof range === "string") {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
      const end = match[2] === "" ? info.size - 1 : Math.min(Number.parseInt(match[2], 10), info.size - 1);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < info.size) {
        const body = (await readFile(path)).subarray(start, end + 1);
        response.writeHead(206, {
          ...headers,
          "content-range": `bytes ${start}-${end}/${info.size}`,
          "content-length": body.length
        });
        response.end(request.method === "HEAD" ? undefined : body);
        return;
      }
    }
  }
  response.writeHead(200, {
    ...headers,
    "content-length": info.size
  });
  response.end(request.method === "HEAD" ? undefined : await readFile(path));
}

function contentType(path: string): string {
  if (extname(path) === ".fuw") return "application/octet-stream";
  if (extname(path) === ".mp3") return "audio/mpeg";
  if (extname(path) === ".wav") return "audio/wav";
  if (extname(path) === ".fur") return "application/octet-stream";
  return "application/octet-stream";
}

const INDEX_HTML = String.raw`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NSF to Furnace Batch Converter</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #11161d; color: #dbe7f3; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 22px; margin: 0 0 18px; font-weight: 650; }
    button { background: #2e7bd8; color: white; border: 0; border-radius: 6px; padding: 9px 13px; font-weight: 650; cursor: pointer; }
    button.secondary { background: #29435f; }
    button:disabled { opacity: .45; cursor: default; }
    .drop { border: 1px dashed #66809b; border-radius: 8px; min-height: 150px; display: grid; place-items: center; background: #16202b; }
    .drop.drag { border-color: #70b7ff; background: #18293a; }
    .toolbar { display: flex; gap: 10px; align-items: center; margin: 16px 0; flex-wrap: wrap; }
    .muted { color: #8ea1b4; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #121a23; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #263442; text-align: left; }
    th { color: #9bb8d4; font-size: 12px; letter-spacing: .02em; text-transform: uppercase; }
    code { color: #9fd0ff; }
    .status { margin-top: 14px; white-space: pre-wrap; color: #bfd0df; }
    .path { max-width: 520px; overflow-wrap: anywhere; }
    .audio-cell { min-width: 280px; }
    audio { width: 100%; max-width: 360px; height: 32px; display: block; margin-top: 7px; }
  </style>
</head>
<body>
  <main>
    <h1>NSF to Furnace 0.6.8.3 Batch Converter</h1>
    <div id="drop" class="drop">
      <div>
        <strong>NSFファイルをドロップ</strong>
        <div class="muted">複数曲を検出して、曲ごとの .fur を生成します。</div>
      </div>
    </div>
    <div class="toolbar">
      <button id="pick">NSFを選択</button>
      <button id="convert" disabled>一括コンバート</button>
      <span id="wave" class="muted"></span>
    </div>
    <input id="file" type="file" accept=".nsf,application/octet-stream" hidden>
    <section id="summary" class="muted"></section>
    <table id="tracks" hidden>
      <thead><tr><th>#</th><th>曲名</th><th>init song</th></tr></thead>
      <tbody></tbody>
    </table>
    <table id="files" hidden>
      <thead><tr><th>#</th><th>FUR</th><th>MP3確認</th></tr></thead>
      <tbody></tbody>
    </table>
    <div id="status" class="status"></div>
  </main>
  <script>
    const drop = document.querySelector("#drop");
    const fileInput = document.querySelector("#file");
    const pick = document.querySelector("#pick");
    const convert = document.querySelector("#convert");
    const summary = document.querySelector("#summary");
    const table = document.querySelector("#tracks");
    const tbody = table.querySelector("tbody");
    const filesTable = document.querySelector("#files");
    const filesBody = filesTable.querySelector("tbody");
    const status = document.querySelector("#status");
    const wave = document.querySelector("#wave");
    let nsfFile = null;

    fetch("/api/wavetable").then(r => r.json()).then(data => {
      wave.textContent = data.wavetable ? "Wavetable: " + data.wavetable : "Wavetable: 未設定";
    });

    pick.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => fileInput.files[0] && loadFile(fileInput.files[0]));
    for (const eventName of ["dragenter", "dragover"]) {
      drop.addEventListener(eventName, event => { event.preventDefault(); drop.classList.add("drag"); });
    }
    for (const eventName of ["dragleave", "drop"]) {
      drop.addEventListener(eventName, event => { event.preventDefault(); drop.classList.remove("drag"); });
    }
    drop.addEventListener("drop", event => {
      const file = event.dataTransfer.files[0];
      if (file) loadFile(file);
    });
    convert.addEventListener("click", async () => {
      if (!nsfFile) return;
      status.textContent = "変換中...";
      try {
        const response = await fetch("/api/convert?name=" + encodeURIComponent(nsfFile.name), {
          method: "POST",
          body: await nsfFile.arrayBuffer()
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "convert failed");
        status.textContent = result.files.length + " track(s) written to:\n" + result.outputDir;
        renderConvertedFiles(result.files);
      } catch (error) {
        status.textContent = "変換エラー: " + (error && error.message ? error.message : String(error));
      }
    });
    filesTable.addEventListener("click", async event => {
      const button = event.target.closest("button[data-index]");
      if (!button) return;
      const row = button.closest("tr");
      const audioCell = row.querySelector("[data-audio]");
      const file = convertedFiles[Number(button.dataset.index)];
      if (!file) return;
      button.disabled = true;
      button.textContent = "変換中...";
      audioCell.textContent = "FurnaceでWAVを書き出してMP3へ変換中...";
      try {
        const response = await fetch("/api/render-mp3", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fur: file.fur })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "MP3 render failed");
        const url = "/api/file?path=" + encodeURIComponent(result.mp3);
        audioCell.innerHTML = "<code class=\"path\">" + escapeHtml(result.mp3) + "</code>" +
          "<audio controls preload=\"metadata\" src=\"" + url + "\"></audio>";
        button.textContent = "MP3再生成";
        button.disabled = false;
      } catch (error) {
        audioCell.textContent = "MP3変換エラー: " + (error && error.message ? error.message : String(error));
        button.textContent = "MP3";
        button.disabled = false;
      }
    });

    async function loadFile(file) {
      nsfFile = file;
      status.textContent = "読み込み中...";
      const response = await fetch("/api/inspect", { method: "POST", body: await file.arrayBuffer() });
      const result = await response.json();
      if (!response.ok) {
        status.textContent = result.error || "読み込みに失敗しました。";
        convert.disabled = true;
        return;
      }
      summary.innerHTML = "<div>Title: <code>" + escapeHtml(result.header.title || "(untitled)") + "</code></div>" +
        "<div>Artist: <code>" + escapeHtml(result.header.artist || "(unknown)") + "</code></div>" +
        "<div>Songs: <code>" + result.header.totalSongs + "</code></div>";
      tbody.innerHTML = result.tracks.map(track =>
        "<tr><td>" + String(track.index + 1).padStart(2, "0") + "</td><td>" + escapeHtml(track.name) + "</td><td>" + track.initSong + "</td></tr>"
      ).join("");
      table.hidden = false;
      convert.disabled = false;
      status.textContent = "";
      filesTable.hidden = true;
      filesBody.innerHTML = "";
    }
    let convertedFiles = [];
    function renderConvertedFiles(files) {
      convertedFiles = files;
      filesBody.innerHTML = files.map((file, index) =>
        "<tr><td>" + String(index + 1).padStart(2, "0") + "</td>" +
        "<td class=\"path\"><code>" + escapeHtml(file.fur) + "</code></td>" +
        "<td class=\"audio-cell\"><button class=\"secondary\" data-index=\"" + index + "\">MP3</button><div data-audio class=\"muted\"></div></td></tr>"
      ).join("");
      filesTable.hidden = false;
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
    }
  </script>
</body>
</html>`;
