import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export const root = path.resolve(new URL("..", import.meta.url).pathname);

export function loadConfig() {
  return YAML.parse(fs.readFileSync(path.join(root, "config.yaml"), "utf8"));
}

export function loadAreas() {
  const dir = path.join(root, "areas");
  return fs
    .readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => ({ file: f, data: YAML.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
}

/** Flatten an area into story rows, inheriting release/status from the epic. */
export function flatten(area) {
  const rows = [];
  for (const theme of area.themes) {
    for (const epic of theme.epics) {
      for (const story of epic.stories ?? []) {
        rows.push({
          area: area.id,
          theme: theme.id,
          themeName: theme.name,
          epic: epic.id,
          epicName: epic.name,
          ...story,
          release: story.release ?? epic.release ?? "unscheduled",
          status: story.status ?? epic.status ?? "idea",
        });
      }
    }
  }
  return rows;
}
