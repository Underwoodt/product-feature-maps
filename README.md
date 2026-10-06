# Product feature maps

Story-map style views of a product, one map per **product area**, each broken into
**themes → epics → stories** and laid across **release lanes** (now / next / later, or named releases).

Product areas covered:

| Area file | What it holds |
|---|---|
| `areas/01-product-management.yaml` | PM artifacts and deliverables (problem statements, roadmap, decision log…) |
| `areas/02-product-features.yaml` | Functional features users interact with |
| `areas/03-rbac.yaml` | Roles, permissions, identity across systems |
| `areas/04-architecture.yaml` | Structural and technical decisions |
| `areas/05-operations.yaml` | Running and supporting the live service |
| `areas/06-non-functional.yaml` | Accessibility, performance, resilience, compliance |

## How it works

1. **Data is the source of truth.** Each area is one YAML file. The hierarchy is fixed:
   `area → theme → epic → story`. Every story (or its parent epic) names a `release` lane and a `status`.
2. **Everything else is generated.** `npm run build` validates the YAML against
   `schema/area.schema.json`, then renders two pages:
   - `dist/index.html`: one story map per area, themes and epics across the top,
     release lanes down the side, status shown by colour.
   - `dist/releases.html`: the cross-area view. A summary table of story counts per area
     and lane, then one tab per lane ("What is in Now?") with a column per area, stories
     grouped by theme and epic. Link to a lane directly with `releases.html#next`.
3. **Editable in the browser.** `npm run dev` serves the maps with click-to-edit cards and
   drag-and-drop between lanes and epics, saving straight back to the YAML.
4. **Round-trips to tools.** `npm run export:csv` flattens all stories to `dist/stories.csv`
   for Jira / ADO / spreadsheet import. Stories can carry a `link` back to the ticket.

```bash
npm install
npm run dev          # build, serve at http://localhost:4173 and save edits back to areas/
npm run build        # validate + render dist/ (no server)
npm run export:csv   # dist/stories.csv
```

## Editing in the browser

With `npm run dev` running, the map page is an editor:

- **Click a card** to change its title, user-story fields, notes, lane, status, size, dependencies or link,
  or to delete it. **Hover a cell** and use "+ story" to add one there.
- **Drag a card** to another lane or epic. Dropping onto a card inserts before it.
- **Hover a theme header** for "+ epic", which adds an epic (ID, name, description, default lane) to that theme.
  An epic with no stories can be deleted from its ✎ dialog.
- **Hover a theme or epic header** and click ✎ to rename it or edit its outcome / description.
  The ✎ next to the area title edits the area's name, description and owner.
- **Save** writes the changed areas to their YAML files, re-validates them and rebuilds `dist/`.
  If validation fails the files are restored and the error is shown.
- **Download YAML** is the fallback when the page is served without the dev server (for example
  from GitHub Pages): it downloads the edited files for you to copy into `areas/` by hand.

Edits only ever touch the areas you changed. YAML comments in those files are not preserved,
so keep notes in `notes:` fields rather than comments.

## Authoring

```yaml
id: rbac
name: Systems RBAC
themes:
  - id: RB-MODEL
    name: Permission model
    outcome: Access is least-privilege and explainable.
    epics:
      - id: RB-MODEL-1
        name: Roles and permissions
        release: now            # default lane for stories in this epic
        stories:
          - id: RB-MODEL-1-1
            title: Define role catalogue
            as_a: platform owner
            i_want: a named set of roles
            so_that: access is granted consistently
            release: next       # overrides the epic's lane
            status: ready       # idea | ready | in-progress | done | blocked
            size: S             # XS–XL
            depends_on: [PF-ONB-1-1]
            link: https://jira.example/browse/ABC-123
```

Conventions:

- **IDs are stable and globally unique** (`AREA-THEME-n-m`). Stories reference each other by ID,
  and the validator rejects duplicates and dangling `depends_on`.
- **Release lanes** live in `config.yaml`. Swap `now/next/later` for named releases in one place,
  or override `releases:` inside a single area file.
- **Themes carry an outcome**, not a feature list. If you can't write the outcome, it's probably an epic.
- **Dependencies are drawn as arrows.** `depends_on` lists the IDs a story needs first. On the map page
  an arrow runs from each dependency to the dependent story; hover a card to highlight its arrows.
  A dependency on a story in another area cannot be drawn on that map, so the card gets an orange edge
  and the ID in its footer links to the other area's map.

## Roadmap for this tool

- [x] Cross-area view: all areas on one page filtered by release lane ("what is in Now?")
- [x] Dependency arrows between stories (SVG overlay)
- [ ] Import from Jira / ADO export so the map can be refreshed from the tracker
- [ ] Per-area Markdown export for pasting into Confluence / Notion
- [ ] Printable A3 layout
