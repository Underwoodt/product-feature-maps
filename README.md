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
3. **Round-trips to tools.** `npm run export:csv` flattens all stories to `dist/stories.csv`
   for Jira / ADO / spreadsheet import. Stories can carry a `link` back to the ticket.

```bash
npm install
npm run build        # validate + render dist/index.html
npm run serve        # view at http://localhost:3000
npm run export:csv   # dist/stories.csv
```

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

## Roadmap for this tool

- [x] Cross-area view: all areas on one page filtered by release lane ("what is in Now?")
- [ ] Dependency arrows between stories (SVG overlay)
- [ ] Import from Jira / ADO export so the map can be refreshed from the tracker
- [ ] Per-area Markdown export for pasting into Confluence / Notion
- [ ] Printable A3 layout
