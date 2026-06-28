import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { convertNsfBufferToFurFiles } from "./nsfConvert.js";
import { readNsfBuffer } from "./parser/nsf/index.js";

export type UiServerOptions = {
  port: number;
  wavetable?: string;
  famistudio?: string;
  duration?: number;
  patternLength?: number;
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
    const result = await convertNsfBufferToFurFiles(body, fileName, {
      wavetable: options.wavetable,
      famistudio: options.famistudio,
      duration: options.duration,
      patternLength: options.patternLength
    });
    sendJson(response, 200, {
      header: result.document.header,
      tracks: result.document.tracks,
      files: result.files.map((file) => ({
        name: file.name,
        data: file.data.toString("base64"),
        warnings: file.warnings
      }))
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/wavetable/download" && options.wavetable) {
    send(response, 200, contentType(options.wavetable), await readFile(options.wavetable));
    return;
  }
  sendJson(response, 404, { error: "Not found" });
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

function contentType(path: string): string {
  if (extname(path) === ".fuw") return "application/octet-stream";
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
      const response = await fetch("/api/convert?name=" + encodeURIComponent(nsfFile.name), {
        method: "POST",
        body: await nsfFile.arrayBuffer()
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "convert failed");
      await saveFiles(result.files);
      status.textContent = result.files.length + " file(s) written.";
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
    }

    async function saveFiles(files) {
      if ("showDirectoryPicker" in window) {
        const dir = await window.showDirectoryPicker({ mode: "readwrite" });
        for (const file of files) {
          const handle = await dir.getFileHandle(file.name, { create: true });
          const writable = await handle.createWritable();
          await writable.write(base64ToBytes(file.data));
          await writable.close();
        }
        return;
      }
      for (const file of files) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([base64ToBytes(file.data)], { type: "application/octet-stream" }));
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    function base64ToBytes(value) {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
    }
  </script>
</body>
</html>`;
