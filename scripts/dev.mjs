// Local editing server: serves dist/ and accepts POST /api/save from the map editor,
// writing the edited area back to its YAML file, validating, and rebuilding dist/.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { root, loadAreas } from "./lib.mjs";
import { build } from "./build.mjs";

const port = Number(process.env.PORT) || 4173;
const dist = path.join(root, "dist");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".csv": "text/csv", ".svg": "image/svg+xml" };

/** Serialise with short scalar lists (depends_on, tags) in flow style, matching the hand-written files. */
function toYaml(data) {
  const doc = new YAML.Document(data);
  YAML.visit(doc, { Seq(_, node) { if (node.items.every((i) => YAML.isScalar(i))) node.flow = true; } });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

function saveAreas(body) {
  const known = new Map(loadAreas().map((a) => [a.file, a.data]));
  const backups = [];
  const written = [];
  for (const { file, data } of body.areas ?? []) {
    if (!known.has(file)) throw new Error(`Unknown area file ${file}`);
    if (known.get(file).id !== data?.id) throw new Error(`Area id mismatch for ${file}`);
    const target = path.join(root, "areas", file);
    backups.push([target, fs.readFileSync(target, "utf8")]);
    fs.writeFileSync(target, toYaml(data));
    written.push(file);
  }
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/validate.mjs")], { stdio: "pipe" });
  } catch (e) {
    for (const [target, text] of backups) fs.writeFileSync(target, text);
    throw new Error(String(e.stderr || e.message).trim());
  }
  build();
  return written;
}

function json(res, code, obj) { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); }

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { const written = saveAreas(JSON.parse(body)); console.log("saved", written.join(", ")); json(res, 200, { ok: true, written }); }
      catch (e) { console.error("save failed:", e.message); json(res, 400, { error: e.message }); }
    });
    return;
  }
  let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(dist, p));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("Not found"); return; }
  res.writeHead(200, { "content-type": mime[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  build();
  console.log(`Feature maps editor: http://localhost:${port}/  (saves write to areas/*.yaml)`);
});
