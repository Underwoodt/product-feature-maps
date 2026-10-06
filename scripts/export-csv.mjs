// Flat CSV of every story, suitable for import into Jira / Azure DevOps / a spreadsheet.
import fs from "node:fs";
import path from "node:path";
import { root, loadAreas, flatten } from "./lib.mjs";

const cols = ["area", "theme", "themeName", "epic", "epicName", "id", "title", "as_a", "i_want", "so_that", "release", "status", "size", "depends_on", "tags", "link"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const lines = [cols.join(",")];
for (const { data } of loadAreas()) {
  for (const row of flatten(data)) {
    lines.push(cols.map((c) => esc(Array.isArray(row[c]) ? row[c].join(";") : row[c])).join(","));
  }
}
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/stories.csv"), lines.join("\n"));
console.log(`Wrote dist/stories.csv (${lines.length - 1} stories)`);
