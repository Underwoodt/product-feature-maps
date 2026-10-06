# Run book

Day-to-day commands for the product feature maps. All commands run from the project folder,
so every block starts with a `cd`. Running `npm` from anywhere else fails with
"Could not read package.json".

## First time on a machine

```bash
cd ~/claude-projects/product-feature-maps && npm install
```

## Build the maps

Validates every file in `areas/` against the schema, then renders both pages into `dist/`.

```bash
cd ~/claude-projects/product-feature-maps && npm run build
```

Output:

| File | What it is |
|---|---|
| `dist/index.html` | One story map per area (themes, epics, release lanes) |
| `dist/releases.html` | Cross-area view: "What is in Now?" with a tab per lane |

If validation fails the build stops and lists each problem with its file name. Common causes:

- A story `release` or `status` that is not listed in `config.yaml`.
- A duplicate ID across area files.
- A `depends_on` ID that does not exist.
- A YAML value containing `: ` that is not quoted, e.g. `description: "Quality: speed"`.

## View the maps

```bash
cd ~/claude-projects/product-feature-maps && npx serve dist -l 4173
```

Then open:

- http://localhost:4173/ for the area maps
- http://localhost:4173/releases.html for the by-release view
- http://localhost:4173/releases.html#next to open straight on a lane (`now`, `next`, `later`, `unscheduled`)

Stop the server with `Ctrl+C`. The pages are plain HTML, so `dist/index.html` can also be
opened directly in a browser or attached to an email.

## Export stories to CSV

Flattens every story to `dist/stories.csv` for import into Jira, Azure DevOps or a spreadsheet.

```bash
cd ~/claude-projects/product-feature-maps && npm run export:csv
```

## Validate only

Useful before a commit when you have edited YAML but do not need the pages.

```bash
cd ~/claude-projects/product-feature-maps && npm run validate
```

## Editing content

1. Edit the relevant file in `areas/`. The authoring format is in `README.md`.
2. Run the build. Fix any validation errors it reports.
3. Refresh the browser tab if the server is still running.
4. Commit:

```bash
cd ~/claude-projects/product-feature-maps && git add -A && git commit -m "Update <area> map"
```

## Changing release lanes

Edit the `releases:` list in `config.yaml` to rename lanes or switch to named releases
(for example R1, R2, MVP). Every story's `release` must match an `id` in that list, so update
the area files in the same change. One area can override the list with its own `releases:` block.
