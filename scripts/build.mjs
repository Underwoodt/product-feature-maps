// Renders every area as a story map: themes/epics across the top, release lanes down the side.
import fs from "node:fs";
import path from "node:path";
import { root, loadConfig, loadAreas, flatten } from "./lib.mjs";

const config = loadConfig();
const areas = loadAreas().map((a) => a.data);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function storyCard(s) {
  const colour = config.statuses[s.status] ?? "#eee";
  const tip = [s.as_a && `As a ${s.as_a}`, s.i_want && `I want ${s.i_want}`, s.so_that && `so that ${s.so_that}`, s.notes].filter(Boolean).join("\n");
  const title = s.link ? `<a href="${esc(s.link)}">${esc(s.title)}</a>` : esc(s.title);
  const meta = [s.size, s.status, ...(s.depends_on?.length ? [`⇠ ${s.depends_on.join(", ")}`] : [])].filter(Boolean).join(" · ");
  return `<div class="story" style="background:${colour}" title="${esc(tip)}"><div class="id">${esc(s.id)}</div><div class="t">${title}</div><div class="m">${esc(meta)}</div></div>`;
}

function areaMap(area) {
  const releases = area.releases ?? config.releases;
  const rows = flatten(area);
  const epics = area.themes.flatMap((t) => t.epics.map((e) => ({ ...e, theme: t })));
  const cols = `120px repeat(${epics.length}, minmax(180px, 1fr))`;
  let html = `<section class="area" id="${esc(area.id)}"><h2>${esc(area.name)}</h2>`;
  if (area.description) html += `<p class="desc">${esc(area.description)}${area.owner ? ` <span class="owner">Owner: ${esc(area.owner)}</span>` : ""}</p>`;
  html += `<div class="map" style="grid-template-columns:${cols}">`;
  // Theme header row
  html += `<div class="corner">Theme</div>`;
  for (const t of area.themes) html += `<div class="theme" style="grid-column: span ${t.epics.length}" title="${esc(t.outcome)}"><b>${esc(t.name)}</b>${t.outcome ? `<small>${esc(t.outcome)}</small>` : ""}</div>`;
  // Epic header row
  html += `<div class="corner">Epic</div>`;
  for (const e of epics) html += `<div class="epic" title="${esc(e.description)}">${esc(e.name)}<small>${esc(e.id)}</small></div>`;
  // One row per release lane
  for (const r of releases) {
    const inLane = rows.filter((s) => s.release === r.id);
    if (!inLane.length && r.id === "unscheduled") continue;
    html += `<div class="lane">${esc(r.label)}<small>${inLane.length}</small></div>`;
    for (const e of epics) {
      const cell = inLane.filter((s) => s.epic === e.id).map(storyCard).join("");
      html += `<div class="cell">${cell}</div>`;
    }
  }
  html += `</div></section>`;
  return html;
}

const legend = Object.entries(config.statuses).map(([k, v]) => `<span class="sw" style="background:${v}">${esc(k)}</span>`).join("");
const nav = areas.map((a) => `<a href="#${esc(a.id)}">${esc(a.name)}</a>`).join("");

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.title)}</title>
<style>
:root{--line:#d0d4da;--ink:#1f2328;--muted:#6b7280}
body{margin:0;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:#fafbfc}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:10px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;z-index:2}
header h1{font-size:18px;margin:0 12px 0 0}
nav a{margin-right:12px;color:#0b57d0;text-decoration:none;white-space:nowrap}
.legend{margin-left:auto;display:flex;gap:6px}.sw{padding:2px 8px;border-radius:4px;border:1px solid var(--line);font-size:12px}
main{padding:20px}
.area{margin-bottom:48px}.area h2{margin:0 0 4px}.desc{margin:0 0 12px;color:var(--muted)}.owner{margin-left:8px;font-size:12px}
.map{display:grid;gap:4px;overflow-x:auto;align-items:stretch}
.corner,.lane{background:#fff;border:1px solid var(--line);padding:8px;font-weight:600;position:sticky;left:0}
.lane small{display:block;font-weight:400;color:var(--muted)}
.theme{background:#1f3a5f;color:#fff;padding:8px;border-radius:4px}.theme small{display:block;opacity:.8;font-weight:400}
.epic{background:#e8eef7;padding:8px;border-radius:4px;font-weight:600}.epic small{display:block;font-weight:400;color:var(--muted)}
.cell{border:1px dashed var(--line);min-height:48px;padding:4px;display:flex;flex-direction:column;gap:4px;background:#fff}
.story{border:1px solid rgba(0,0,0,.12);border-radius:4px;padding:6px;font-size:13px}
.story .id{font-size:11px;color:var(--muted)}.story .m{font-size:11px;color:var(--muted);margin-top:2px}
.story a{color:inherit}
</style></head><body>
<header><h1>${esc(config.title)}</h1><nav>${nav}</nav><div class="legend">${legend}</div></header>
<main>${areas.map(areaMap).join("")}</main>
<footer style="padding:20px;color:var(--muted)">Generated ${new Date().toISOString().slice(0, 10)} from ${areas.length} area files.</footer>
</body></html>`;

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/index.html"), page);
console.log(`Wrote dist/index.html (${areas.length} areas, ${areas.reduce((n, a) => n + flatten(a).length, 0)} stories)`);
