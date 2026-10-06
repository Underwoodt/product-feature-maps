import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import { root, loadConfig, loadAreas, flatten } from "./lib.mjs";

const schema = JSON.parse(fs.readFileSync(path.join(root, "schema/area.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const config = loadConfig();
const errors = [];
const allIds = new Map();

for (const { file, data } of loadAreas()) {
  if (!validate(data)) {
    for (const e of validate.errors) errors.push(`${file}: ${e.instancePath || "/"} ${e.message}`);
    continue;
  }
  const releases = new Set((data.releases ?? config.releases).map((r) => r.id));
  const statuses = new Set(Object.keys(config.statuses));
  for (const row of flatten(data)) {
    for (const id of [row.theme, row.epic, row.id]) {
      if (allIds.has(id) && allIds.get(id) !== file) errors.push(`${file}: duplicate id ${id} (also in ${allIds.get(id)})`);
      allIds.set(id, file);
    }
    if (!releases.has(row.release)) errors.push(`${file}: story ${row.id} has unknown release "${row.release}"`);
    if (!statuses.has(row.status)) errors.push(`${file}: story ${row.id} has unknown status "${row.status}"`);
  }
}
// Second pass: dependency targets must exist somewhere.
for (const { file, data } of loadAreas()) {
  for (const row of flatten(data)) {
    for (const dep of row.depends_on ?? []) {
      if (!allIds.has(dep)) errors.push(`${file}: story ${row.id} depends on unknown id ${dep}`);
    }
  }
}

if (errors.length) {
  console.error("Validation failed:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("All area files valid.");
