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
  const deps = s.depends_on ?? [];
  const meta = [s.size, s.status].filter(Boolean).map(esc).join(" · ") +
    (deps.length ? ` · ⇠ ${deps.map((d) => `<a class="dep" href="#story-${esc(d)}">${esc(d)}</a>`).join(", ")}` : "");
  return `<div class="story" id="story-${esc(s.id)}" data-id="${esc(s.id)}" data-deps="${esc(deps.join(" "))}" style="background:${colour}" title="${esc(tip)}"><div class="id">${esc(s.id)}</div><div class="t">${title}</div><div class="m">${meta}</div></div>`;
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
  html += `</div><svg class="deps" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs></svg></section>`;
  return html;
}

const legend = Object.entries(config.statuses).map(([k, v]) => `<span class="sw" style="background:${v}">${esc(k)}</span>`).join("");
const areaNav = areas.map((a) => `<a href="index.html#${esc(a.id)}">${esc(a.name)}</a>`).join("");

const css = `
:root{--line:#d0d4da;--ink:#1f2328;--muted:#6b7280;--accent:#0b57d0}
body{margin:0;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:#fafbfc}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:10px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;z-index:2}
header h1{font-size:18px;margin:0 12px 0 0}
nav a{margin-right:12px;color:var(--accent);text-decoration:none;white-space:nowrap}
nav a.current{font-weight:700;border-bottom:2px solid var(--accent)}
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
/* dependency arrows */
.area{position:relative}
.deps{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.deps path{fill:none;stroke:#b45309;stroke-width:1.5;marker-end:url(#arrow);opacity:.55;transition:opacity .15s}
.deps path.dim{opacity:.1}.deps path.hl{opacity:1;stroke-width:2.5}
#arrow path{fill:#b45309}
.story.hl{outline:2px solid #b45309}
.story .dep{color:inherit}
.story.external{border-left:3px solid #b45309}
.story:target{outline:2px solid var(--accent)}
/* cross-area release view */
.tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
.tabs button{font:inherit;padding:6px 14px;border:1px solid var(--line);background:#fff;border-radius:999px;cursor:pointer}
.tabs button[aria-selected=true]{background:var(--accent);color:#fff;border-color:var(--accent)}
.tabs button small{opacity:.75;margin-left:6px}
.lane-view{display:none}.lane-view.active{display:block}
.summary{border-collapse:collapse;margin-bottom:20px;font-size:13px}
.summary th,.summary td{border:1px solid var(--line);padding:4px 10px;text-align:right}
.summary th:first-child,.summary td:first-child{text-align:left}
.summary td.zero{color:var(--muted)}
.bylane{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:start}
.acol{background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px}
.acol h3{margin:0 0 8px;font-size:14px;background:#1f3a5f;color:#fff;padding:6px 8px;border-radius:4px}
.acol h3 small{float:right;font-weight:400;opacity:.8}
.acol h4{margin:8px 0 2px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.acol h5{margin:4px 0 4px;font-size:13px;font-weight:600}
.acol .story{margin-bottom:4px}
.acol .empty{color:var(--muted);font-style:italic}
`;

function shell({ title, current, body, script = "" }) {
  const nav = `<a href="releases.html" class="${current === "releases" ? "current" : ""}">By release</a>` +
    `<a href="index.html" class="${current === "maps" ? "current" : ""}">Maps</a> | ` + areaNav;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head><body>
<header><h1>${esc(config.title)}</h1><nav>${nav}</nav><div class="legend">${legend}</div></header>
<main>${body}</main>
<footer style="padding:20px;color:var(--muted)">Generated ${new Date().toISOString().slice(0, 10)} from ${areas.length} area files.</footer>
${script}</body></html>`;
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
      let inner = "";
      if (!rows.length) inner = `<div class="empty">Nothing in ${esc(r.label)}</div>`;
      for (const t of a.themes) {
        const inTheme = rows.filter((s) => s.theme === t.id);
        if (!inTheme.length) continue;
        inner += `<h4>${esc(t.name)}</h4>`;
        for (const e of t.epics) {
          const inEpic = inTheme.filter((s) => s.epic === e.id);
          if (!inEpic.length) continue;
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

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const depsScript = `<script>
(function(){
  function draw(area){
    const svg=area.querySelector('svg.deps'); if(!svg) return;
    const map=area.querySelector('.map');
    const aRect=area.getBoundingClientRect();
    svg.innerHTML=svg.querySelector('defs').outerHTML;
    // Overlay sits on the section, so account for the map's own horizontal scroll via rects.
    const pos=el=>{const r=el.getBoundingClientRect();return{x:r.left-aRect.left,y:r.top-aRect.top,w:r.width,h:r.height}};
    for(const to of area.querySelectorAll('.story[data-deps]')){
      const deps=to.dataset.deps.split(' ').filter(Boolean); if(!deps.length) continue;
      for(const id of deps){
        const from=area.querySelector('#story-'+CSS.escape(id));
        if(!from){ to.classList.add('external'); continue; }
        const a=pos(from), b=pos(to);
        // Leave from the bottom of the dependency, arrive at the top of the dependent;
        // if they sit side by side in the same lane, go right-to-left instead.
        let x1,y1,x2,y2,d;
        if(Math.abs(a.y-b.y)<a.h/2){ x1=a.x+a.w; y1=a.y+a.h/2; x2=b.x; y2=b.y+b.h/2;
          if(x2<x1){ x1=a.x; x2=b.x+b.w; } const mx=(x1+x2)/2; d='M'+x1+' '+y1+' C'+mx+' '+y1+' '+mx+' '+y2+' '+x2+' '+y2; }
        else { x1=a.x+a.w/2; y1=a.y+a.h; x2=b.x+b.w/2; y2=b.y; if(y2<y1){ y1=a.y; y2=b.y+b.h; }
          const my=(y1+y2)/2; d='M'+x1+' '+y1+' C'+x1+' '+my+' '+x2+' '+my+' '+x2+' '+y2; }
        const p=document.createElementNS('http://www.w3.org/2000/svg','path');
        p.setAttribute('d',d); p.dataset.from=id; p.dataset.to=to.dataset.id; svg.appendChild(p);
      }
    }
  }
  function drawAll(){ document.querySelectorAll('.area').forEach(draw); }
  function highlight(area, id){
    const paths=[...area.querySelectorAll('svg.deps path')];
    const linked=new Set();
    paths.forEach(p=>{ const on=!id||p.dataset.from===id||p.dataset.to===id; p.classList.toggle('hl',!!id&&on); p.classList.toggle('dim',!!id&&!on);
      if(id&&on){linked.add(p.dataset.from);linked.add(p.dataset.to);} });
    area.querySelectorAll('.story').forEach(s=>s.classList.toggle('hl',linked.has(s.dataset.id)&&s.dataset.id!==id));
  }
  document.querySelectorAll('.area').forEach(area=>{
    area.addEventListener('mouseover',e=>{const s=e.target.closest('.story'); if(s) highlight(area,s.dataset.id);});
    area.addEventListener('mouseout',e=>{if(e.target.closest('.story')) highlight(area,null);});
    area.querySelector('.map').addEventListener('scroll',()=>draw(area));
  });
  drawAll(); window.addEventListener('resize',drawAll);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(drawAll);
})();
</script>`;
fs.writeFileSync(path.join(root, "dist/index.html"), shell({ title: config.title, current: "maps", body: areas.map(areaMap).join(""), script: depsScript }));
fs.writeFileSync(path.join(root, "dist/releases.html"), releasesPage());
console.log(`Wrote dist/index.html and dist/releases.html (${areas.length} areas, ${areas.reduce((n, a) => n + flatten(a).length, 0)} stories)`);
