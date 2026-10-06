// Client-side map renderer and editor. Loads data.json, draws one story map per area,
// lets you edit cards and drag them between lanes/epics, and saves back via the dev server.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let DATA;                 // { config, areas: [{ file, ...area }] }
const dirty = new Set();  // area ids with unsaved changes
const app = $("#app");

// ---------- data helpers ----------
function lanesFor(area) { return area.releases ?? DATA.config.releases; }
function* walk(area) {
  for (const theme of area.themes) for (const epic of theme.epics) for (const [index, story] of (epic.stories ?? []).entries()) yield { theme, epic, story, index };
}
function effective(story, epic) {
  return { ...story, release: story.release ?? epic.release ?? "unscheduled", status: story.status ?? epic.status ?? "idea" };
}
function findStory(id) {
  for (const area of DATA.areas) for (const hit of walk(area)) if (hit.story.id === id) return { area, ...hit };
  return null;
}
function findEpic(id) {
  for (const area of DATA.areas) for (const theme of area.themes) for (const epic of theme.epics) if (epic.id === id) return { area, theme, epic };
  return null;
}
function allIds() { const s = new Set(); for (const a of DATA.areas) for (const h of walk(a)) { s.add(h.theme.id); s.add(h.epic.id); s.add(h.story.id); } return s; }
function touch(area) { dirty.add(area.id); }
function clean(obj) {
  // Drop empty strings/arrays so the saved YAML stays tidy.
  if (Array.isArray(obj)) return obj.map(clean).filter((v) => v !== undefined);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const c = clean(v);
      if (c === "" || c === undefined || (Array.isArray(c) && !c.length)) continue;
      out[k] = c;
    }
    return out;
  }
  return obj;
}

// ---------- rendering ----------
function storyCard(raw, epic) {
  const s = effective(raw, epic);
  const colour = DATA.config.statuses[s.status] ?? "#eee";
  const tip = [s.as_a && `As a ${s.as_a}`, s.i_want && `I want ${s.i_want}`, s.so_that && `so that ${s.so_that}`, s.notes].filter(Boolean).join("\n");
  const deps = s.depends_on ?? [];
  const meta = [s.size, s.status].filter(Boolean).map(esc).join(" · ") +
    (deps.length ? ` · ⇠ ${deps.map((d) => `<a class="dep" href="#story-${esc(d)}">${esc(d)}</a>`).join(", ")}` : "");
  return `<div class="story" id="story-${esc(s.id)}" data-id="${esc(s.id)}" data-deps="${esc(deps.join(" "))}" draggable="true" style="background:${colour}" title="${esc(tip)}"><div class="id">${esc(s.id)}</div><div class="t">${esc(s.title)}</div><div class="m">${meta}</div></div>`;
}

function areaMap(area) {
  const releases = lanesFor(area);
  const epics = area.themes.flatMap((t) => t.epics.map((e) => ({ ...e, theme: t })));
  const cols = `120px repeat(${epics.length}, minmax(180px, 1fr))`;
  let html = `<section class="area" id="${esc(area.id)}" data-area="${esc(area.id)}"><h2>${esc(area.name)}<button class="edit edit-area" title="Edit area">✎</button></h2>`;
  html += `<p class="desc">${esc(area.description)}${area.owner ? ` <span class="owner">Owner: ${esc(area.owner)}</span>` : ""}</p>`;
  html += `<div class="map" style="grid-template-columns:${cols}"><div class="corner">Theme</div>`;
  for (const t of area.themes) html += `<div class="theme" style="grid-column: span ${t.epics.length}" data-theme="${esc(t.id)}"><b>${esc(t.name)}</b>${t.outcome ? `<small>${esc(t.outcome)}</small>` : ""}<span class="hdr-btns"><button class="edit add-epic" title="Add epic to this theme">+ epic</button><button class="edit edit-theme" title="Edit theme">✎</button></span></div>`;
  html += `<div class="corner">Epic</div>`;
  for (const e of epics) html += `<div class="epic" data-epic="${esc(e.id)}" title="${esc(e.description)}">${esc(e.name)}<small>${esc(e.id)}</small><button class="edit edit-epic" title="Edit epic">✎</button></div>`;
  for (const r of releases) {
    const inLane = [...walk(area)].filter((h) => effective(h.story, h.epic).release === r.id);
    html += `<div class="lane">${esc(r.label)}<small>${inLane.length}</small></div>`;
    for (const e of epics) {
      const cards = inLane.filter((h) => h.epic.id === e.id).map((h) => storyCard(h.story, h.epic)).join("");
      html += `<div class="cell" data-epic="${esc(e.id)}" data-lane="${esc(r.id)}">${cards}<button class="add-story" title="Add story here">+ story</button></div>`;
    }
  }
  html += `</div><svg class="deps" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs></svg></section>`;
  return html;
}

function toolbar() {
  const list = [...dirty].map((id) => DATA.areas.find((a) => a.id === id)?.name).join(", ");
  return `<div class="toolbar"><span class="hint">Click a card to edit it. Drag cards between lanes and epics. Hover ✎ on headers to edit themes and epics.</span>
  <span class="status" id="status">${dirty.size ? `Unsaved: ${esc(list)}` : ""}</span>
  <button id="save" class="primary" ${dirty.size ? "" : "disabled"}>Save</button>
  <button id="download" ${dirty.size ? "" : "disabled"}>Download YAML</button></div>`;
}

function render() {
  const y = window.scrollY;
  app.innerHTML = toolbar() + DATA.areas.map(areaMap).join("");
  window.scrollTo(0, y);
  drawAll();
}
function status(msg, err = false) { const el = $("#status"); if (el) { el.textContent = msg; el.classList.toggle("err", err); } }

// ---------- dependency arrows ----------
function draw(area) {
  const svg = $("svg.deps", area); if (!svg) return;
  const aRect = area.getBoundingClientRect();
  svg.innerHTML = $("defs", svg).outerHTML;
  const pos = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - aRect.left, y: r.top - aRect.top, w: r.width, h: r.height }; };
  for (const to of area.querySelectorAll(".story[data-deps]")) {
    for (const id of to.dataset.deps.split(" ").filter(Boolean)) {
      const from = area.querySelector("#story-" + CSS.escape(id));
      if (!from) { to.classList.add("external"); continue; }
      const a = pos(from), b = pos(to);
      let x1, y1, x2, y2, d;
      if (Math.abs(a.y - b.y) < a.h / 2) {
        x1 = a.x + a.w; y1 = a.y + a.h / 2; x2 = b.x; y2 = b.y + b.h / 2;
        if (x2 < x1) { x1 = a.x; x2 = b.x + b.w; }
        const mx = (x1 + x2) / 2; d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
      } else {
        x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = b.x + b.w / 2; y2 = b.y;
        if (y2 < y1) { y1 = a.y; y2 = b.y + b.h; }
        const my = (y1 + y2) / 2; d = `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
      }
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d); p.dataset.from = id; p.dataset.to = to.dataset.id; svg.appendChild(p);
    }
  }
}
function drawAll() { app.querySelectorAll(".area").forEach(draw); }
function highlight(area, id) {
  const linked = new Set();
  area.querySelectorAll("svg.deps path").forEach((p) => {
    const on = !id || p.dataset.from === id || p.dataset.to === id;
    p.classList.toggle("hl", !!id && on); p.classList.toggle("dim", !!id && !on);
    if (id && on) { linked.add(p.dataset.from); linked.add(p.dataset.to); }
  });
  area.querySelectorAll(".story").forEach((s) => s.classList.toggle("hl", linked.has(s.dataset.id) && s.dataset.id !== id));
}

// ---------- generic form dialog ----------
function form(title, fields, values = {}, { canDelete = false } = {}) {
  return new Promise((resolve) => {
    const dlg = $("#dlg");
    const field = (f) => {
      const v = values[f.key] ?? "";
      let input;
      if (f.type === "select") input = `<select name="${f.key}">${f.options.map((o) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(o || "–")}</option>`).join("")}</select>`;
      else if (f.type === "textarea") input = `<textarea name="${f.key}" rows="2">${esc(v)}</textarea>`;
      else input = `<input name="${f.key}" value="${esc(v)}" ${f.required ? "required" : ""} ${f.pattern ? `pattern="${f.pattern}"` : ""} ${f.readonly ? "readonly" : ""}>`;
      return `<label>${esc(f.label)}${input}</label>`;
    };
    const body = fields.map((f) => (Array.isArray(f) ? `<div class="row">${f.map(field).join("")}</div>` : field(f))).join("");
    dlg.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3>${body}<menu>${canDelete ? `<button value="delete" class="danger" formnovalidate>Delete</button>` : ""}<button value="cancel" formnovalidate>Cancel</button><button value="ok" class="primary">OK</button></menu></form>`;
    const f = $("form", dlg);
    dlg.onclose = () => {
      if (dlg.returnValue === "ok") resolve(Object.fromEntries(new FormData(f)));
      else if (dlg.returnValue === "delete") resolve({ __delete: true });
      else resolve(null);
    };
    dlg.showModal();
    $("input,textarea,select", f)?.focus();
  });
}

const storyFields = (area, exclude) => [
  { key: "title", label: "Title", required: true },
  { key: "as_a", label: "As a" }, { key: "i_want", label: "I want" }, { key: "so_that", label: "So that" },
  { key: "notes", label: "Notes", type: "textarea" },
  [{ key: "release", label: "Release lane", type: "select", options: lanesFor(area).map((r) => r.id) },
   { key: "status", label: "Status", type: "select", options: Object.keys(DATA.config.statuses) },
   { key: "size", label: "Size", type: "select", options: ["", "XS", "S", "M", "L", "XL"] }],
  { key: "depends_on", label: "Depends on (IDs, comma separated)" },
  { key: "link", label: "Link (ticket URL)" },
];
function applyStory(story, v) {
  Object.assign(story, { title: v.title, as_a: v.as_a, i_want: v.i_want, so_that: v.so_that, notes: v.notes, release: v.release, status: v.status, size: v.size, link: v.link,
    depends_on: v.depends_on.split(",").map((s) => s.trim()).filter(Boolean) });
  for (const k of Object.keys(story)) if (story[k] === "" || (Array.isArray(story[k]) && !story[k].length)) delete story[k];
}

async function editStory(id) {
  const hit = findStory(id); if (!hit) return;
  const cur = effective(hit.story, hit.epic);
  const v = await form(`Edit ${id}`, storyFields(hit.area), { ...cur, depends_on: (cur.depends_on ?? []).join(", ") }, { canDelete: true });
  if (!v) return;
  if (v.__delete) { if (!confirm(`Delete ${id}?`)) return; hit.epic.stories.splice(hit.index, 1); }
  else applyStory(hit.story, v);
  touch(hit.area); render();
}
async function addStory(epicId, lane) {
  const hit = findEpic(epicId); if (!hit) return;
  const ids = allIds(); let n = (hit.epic.stories?.length ?? 0) + 1; while (ids.has(`${epicId}-${n}`)) n++;
  const v = await form(`New story in ${hit.epic.name}`, [{ key: "id", label: "ID", required: true, pattern: "[A-Za-z0-9-]+" }, ...storyFields(hit.area)],
    { id: `${epicId}-${n}`, release: lane, status: "idea", depends_on: "" });
  if (!v) return;
  if (ids.has(v.id)) { alert(`ID ${v.id} already exists.`); return; }
  const story = { id: v.id }; applyStory(story, v);
  (hit.epic.stories ??= []).push(story); touch(hit.area); render();
}
const epicFields = (area) => [
  { key: "name", label: "Name", required: true },
  { key: "description", label: "Description", type: "textarea" },
  { key: "release", label: "Default release lane for stories without one", type: "select", options: ["", ...lanesFor(area).map((r) => r.id)] },
];
function applyEpic(epic, v) {
  Object.assign(epic, { name: v.name, description: v.description, release: v.release });
  for (const k of ["description", "release"]) if (!epic[k]) delete epic[k];
}
async function editEpic(id) {
  const hit = findEpic(id); if (!hit) return;
  const v = await form(`Edit epic ${id}`, epicFields(hit.area), hit.epic, { canDelete: true });
  if (!v) return;
  if (v.__delete) {
    if (hit.epic.stories?.length) { alert(`Move or delete the ${hit.epic.stories.length} stories in this epic first.`); return; }
    if (hit.theme.epics.length === 1) { alert("A theme needs at least one epic; add another before deleting this one."); return; }
    if (!confirm(`Delete epic ${id}?`)) return;
    hit.theme.epics.splice(hit.theme.epics.indexOf(hit.epic), 1);
  } else applyEpic(hit.epic, v);
  touch(hit.area); render();
}
async function addEpic(areaId, themeId) {
  const area = DATA.areas.find((a) => a.id === areaId); const theme = area?.themes.find((t) => t.id === themeId); if (!theme) return;
  const ids = allIds(); let n = theme.epics.length + 1; while (ids.has(`${themeId}-${n}`)) n++;
  const v = await form(`New epic in ${theme.name}`, [{ key: "id", label: "ID", required: true, pattern: "[A-Za-z0-9-]+" }, ...epicFields(area)], { id: `${themeId}-${n}` });
  if (!v) return;
  if (ids.has(v.id)) { alert(`ID ${v.id} already exists.`); return; }
  const epic = { id: v.id }; applyEpic(epic, v); epic.stories = [];
  theme.epics.push(epic); touch(area); render();
}
async function editTheme(areaId, id) {
  const area = DATA.areas.find((a) => a.id === areaId); const theme = area?.themes.find((t) => t.id === id); if (!theme) return;
  const v = await form(`Edit theme ${id}`, [{ key: "name", label: "Name", required: true }, { key: "outcome", label: "Outcome", type: "textarea" }], theme);
  if (!v) return;
  Object.assign(theme, v); if (!theme.outcome) delete theme.outcome;
  touch(area); render();
}
async function editArea(areaId) {
  const area = DATA.areas.find((a) => a.id === areaId); if (!area) return;
  const v = await form(`Edit area`, [{ key: "name", label: "Name", required: true }, { key: "description", label: "Description", type: "textarea" }, { key: "owner", label: "Owner" }], area);
  if (!v) return;
  Object.assign(area, v); for (const k of ["description", "owner"]) if (!area[k]) delete area[k];
  touch(area); render();
}

// ---------- drag and drop ----------
function moveStory(id, epicId, lane, beforeId) {
  const src = findStory(id), dst = findEpic(epicId); if (!src || !dst) return;
  if (src.area !== dst.area) { status("Stories can only be moved within their own area.", true); return; }
  const [story] = src.epic.stories.splice(src.index, 1);
  story.release = lane;
  const list = (dst.epic.stories ??= []);
  let at = beforeId ? list.findIndex((s) => s.id === beforeId) : -1;
  if (at < 0) at = list.length;
  list.splice(at, 0, story);
  touch(src.area); render();
}

// ---------- save / download ----------
function payload() {
  return { areas: [...dirty].map((id) => { const { file, ...data } = DATA.areas.find((a) => a.id === id); return { file, data: clean(data) }; }) };
}
async function save() {
  status("Saving…");
  try {
    const r = await fetch("api/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    dirty.clear(); render(); status(`Saved ${j.written?.join(", ") ?? ""}`);
  } catch (e) {
    status(`Could not save (${e.message}). Run "npm run dev" for live saving, or use Download YAML.`, true);
  }
}
async function download() {
  const YAML = await import("https://cdn.jsdelivr.net/npm/yaml@2.6.0/browser/index.js");
  for (const { file, data } of payload().areas) {
    const blob = new Blob([YAML.stringify(data, { lineWidth: 0 })], { type: "text/yaml" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: file });
    a.click(); URL.revokeObjectURL(a.href);
  }
  status("Downloaded. Copy the files into areas/ and run npm run build.");
}

// ---------- events ----------
app.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("a")) return;
  if (t.id === "save") return save();
  if (t.id === "download") return download();
  const area = t.closest(".area")?.dataset.area;
  if (t.classList.contains("add-story")) { const c = t.closest(".cell"); return addStory(c.dataset.epic, c.dataset.lane); }
  if (t.classList.contains("edit-area")) return editArea(area);
  if (t.classList.contains("edit-theme")) return editTheme(area, t.closest(".theme").dataset.theme);
  if (t.classList.contains("add-epic")) return addEpic(area, t.closest(".theme").dataset.theme);
  if (t.classList.contains("edit-epic")) return editEpic(t.closest(".epic").dataset.epic);
  const card = t.closest(".story"); if (card) return editStory(card.dataset.id);
});
app.addEventListener("mouseover", (e) => { const s = e.target.closest(".story"); if (s) highlight(s.closest(".area"), s.dataset.id); });
app.addEventListener("mouseout", (e) => { const s = e.target.closest(".story"); if (s) highlight(s.closest(".area"), null); });
app.addEventListener("scroll", (e) => { if (e.target.classList?.contains("map")) draw(e.target.closest(".area")); }, true);

let dragId = null;
app.addEventListener("dragstart", (e) => { const s = e.target.closest(".story"); if (!s) return; dragId = s.dataset.id; s.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
app.addEventListener("dragend", (e) => { e.target.closest(".story")?.classList.remove("dragging"); app.querySelectorAll(".cell.over").forEach((c) => c.classList.remove("over")); dragId = null; });
app.addEventListener("dragover", (e) => { const c = e.target.closest(".cell"); if (!c || !dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; c.classList.add("over"); });
app.addEventListener("dragleave", (e) => { const c = e.target.closest(".cell"); if (c && !c.contains(e.relatedTarget)) c.classList.remove("over"); });
app.addEventListener("drop", (e) => {
  const c = e.target.closest(".cell"); if (!c || !dragId) return;
  e.preventDefault();
  const before = e.target.closest(".story")?.dataset.id;
  moveStory(dragId, c.dataset.epic, c.dataset.lane, before !== dragId ? before : null);
});
window.addEventListener("resize", drawAll);
window.addEventListener("beforeunload", (e) => { if (dirty.size) { e.preventDefault(); e.returnValue = ""; } });

// ---------- boot ----------
fetch("data.json", { cache: "no-store" }).then((r) => r.json()).then((d) => { DATA = d; render(); if (document.fonts?.ready) document.fonts.ready.then(drawAll); })
  .catch((e) => { app.innerHTML = `<p class="status err">Could not load data.json: ${esc(e.message)}. Run npm run build.</p>`; });
