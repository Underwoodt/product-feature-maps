// Builds dist/: data.json (all areas), index.html (client-rendered, editable maps),
// releases.html (static cross-area view), plus app.js and style.css copied from src/.
import fs from "node:fs";
import path from "node:path";
import { root, loadConfig, loadAreas, flatten } from "./lib.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function build() {
  const config = loadConfig();
  const loaded = loadAreas();
  const areas = loaded.map((a) => a.data);
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });

  const legend = Object.entries(config.statuses).map(([k, v]) => `<span class="sw" style="background:${v}">${esc(k)}</span>`).join("");
  const areaNav = areas.map((a) => `<a href="index.html#${esc(a.id)}">${esc(a.name)}</a>`).join("");

  function shell({ title, current, body, script = "" }) {
    const nav = `<a href="releases.html" class="${current === "releases" ? "current" : ""}">By release</a>` +
      `<a href="index.html" class="${current === "maps" ? "current" : ""}">Maps</a> | ` + areaNav;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="style.css"></head><body>
<header><h1>${esc(config.title)}</h1><nav>${nav}</nav><div class="legend">${legend}</div></header>
<main>${body}</main>
<footer style="padding:20px;color:var(--muted)">Generated ${new Date().toISOString().slice(0, 10)} from ${areas.length} area files.</footer>
${script}</body></html>`;
  }

  function storyCard(s) {
    const colour = config.statuses[s.status] ?? "#eee";
    const tip = [s.as_a && `As a ${s.as_a}`, s.i_want && `I want ${s.i_want}`, s.so_that && `so that ${s.so_that}`, s.notes].filter(Boolean).join("\n");
    const title = s.link ? `<a href="${esc(s.link)}">${esc(s.title)}</a>` : esc(s.title);
    const deps = s.depends_on ?? [];
    const meta = [s.size, s.status].filter(Boolean).map(esc).join(" · ") +
      (deps.length ? ` · ⇠ ${deps.map((d) => `<a class="dep" href="index.html#story-${esc(d)}">${esc(d)}</a>`).join(", ")}` : "");
    return `<div class="story" style="background:${colour}" title="${esc(tip)}"><div class="id">${esc(s.id)}</div><div class="t">${title}</div><div class="m">${meta}</div></div>`;
  }

  /** Cross-area view: one tab per release lane, one column per area, stories grouped by theme > epic. */
  function releasesPage() {
    const releases = config.releases;
    const all = areas.flatMap(flatten);
    const count = (laneId, areaId) => all.filter((s) => s.release === laneId && (!areaId || s.area === areaId)).length;
    const summary = `<table class="summary"><thead><tr><th>Area</th>${releases.map((r) => `<th>${esc(r.label)}</th>`).join("")}<th>Total</th></tr></thead><tbody>` +
      areas.map((a) => `<tr><td>${esc(a.name)}</td>${releases.map((r) => { const n = count(r.id, a.id); return `<td class="${n ? "" : "zero"}">${n}</td>`; }).join("")}<td>${flatten(a).length}</td></tr>`).join("") +
      `<tr><th>All areas</th>${releases.map((r) => `<th>${count(r.id)}</th>`).join("")}<th>${all.length}</th></tr></tbody></table>`;
    const tabs = `<div class="tabs" role="tablist">` + releases.map((r, i) =>
      `<button role="tab" aria-selected="${i === 0}" data-lane="${esc(r.id)}">${esc(r.label)}<small>${count(r.id)}</small></button>`).join("") + `</div>`;
    const views = releases.map((r, i) => {
      const cols = areas.map((a) => {
        const rows = flatten(a).filter((s) => s.release === r.id);
        let inner = rows.length ? "" : `<div class="empty">Nothing in ${esc(r.label)}</div>`;
        for (const t of a.themes) {
          const inTheme = rows.filter((s) => s.theme === t.id); if (!inTheme.length) continue;
          inner += `<h4>${esc(t.name)}</h4>`;
          for (const e of t.epics) {
            const inEpic = inTheme.filter((s) => s.epic === e.id); if (!inEpic.length) continue;
            inner += `<h5>${esc(e.name)}</h5>` + inEpic.map(storyCard).join("");
          }
        }
        return `<div class="acol"><h3><a href="index.html#${esc(a.id)}" style="color:inherit;text-decoration:none">${esc(a.name)}</a><small>${rows.length}</small></h3>${inner}</div>`;
      }).join("");
      return `<section class="lane-view ${i === 0 ? "active" : ""}" id="lane-${esc(r.id)}" role="tabpanel"><h2>What is in ${esc(r.label)}?</h2><div class="bylane">${cols}</div></section>`;
    }).join("");
    const script = `<script>
const tabs=[...document.querySelectorAll('.tabs [role=tab]')];
function show(id){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.lane===id));
document.querySelectorAll('.lane-view').forEach(v=>v.classList.toggle('active',v.id==='lane-'+id));
history.replaceState(null,'','#'+id);}
tabs.forEach(b=>b.addEventListener('click',()=>show(b.dataset.lane)));
const h=location.hash.slice(1); if(tabs.some(b=>b.dataset.lane===h)) show(h);
</script>`;
    return shell({ title: `${config.title} – by release`, current: "releases", body: summary + tabs + views, script });
  }

  fs.writeFileSync(path.join(dist, "data.json"), JSON.stringify({ config, areas: loaded.map((a) => ({ file: a.file, ...a.data })) }, null, 2));
  fs.writeFileSync(path.join(dist, "index.html"), shell({ title: config.title, current: "maps", body: `<div id="app">Loading…</div><dialog id="dlg"></dialog>`, script: `<script type="module" src="app.js"></script>` }));
  fs.writeFileSync(path.join(dist, "releases.html"), releasesPage());
  for (const f of ["app.js", "style.css"]) fs.copyFileSync(path.join(root, "src", f), path.join(dist, f));
  return { areas: areas.length, stories: areas.reduce((n, a) => n + flatten(a).length, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const r = build();
  console.log(`Wrote dist/ (${r.areas} areas, ${r.stories} stories)`);
}
