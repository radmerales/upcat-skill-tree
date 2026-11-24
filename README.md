# UPCAT Skill Tree

An interactive, left-to-right study skill tree for the UPCAT (University of the Philippines College Admission Test). Pick a subject from the top dropdown, pan around the hex grid, and work from the start node through milestones that are surrounded by subskills.

The design is inspired by the [ARC Raiders Skill Builder](https://metaforge.app/arc-raiders/skill-builder): a pan-and-zoom canvas, glowing nodes, milestone gates, a mastery counter, click-to-learn, and right-click-to-remove. Every node sits on a true pointy-top hex lattice, with the connecting edges running along hex directions. Dark and light themes are both supported.

## Stack

- React 18 + TypeScript + Vite
- No UI framework — hand-written CSS and SVG
- All content lives in one JSON file
- Deployed to GitHub Pages via GitHub Actions

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run validate   # check the JSON before committing
npm run build      # type-check + production build
npm run preview    # preview the production build
```

## Editing content

Everything is in [`public/data/upcat-skill-tree.json`](public/data/upcat-skill-tree.json). The app fetches it at runtime, so editing the JSON and refreshing the page is enough — no rebuild needed in dev.

```jsonc
{
  "version": 2,
  "title": "UPCAT Skill Tree",
  "subtitle": "…",
  "stages": [
    { "label": "FOUNDATION", "note": "Rebuild the basics" }
    // one entry per milestone stage, left to right
  ],
  "subjects": [
    {
      "id": "math",
      "name": "Mathematics",
      "kicker": "SUBTEST 01",
      "blurb": "…",
      "accent": "#f6b93b",
      "branches": [
        { "id": "algebra", "name": "Algebra", "color": "#ff8f4d" }
      ],
      "nodes": [
        {
          "id": "math-start",
          "title": "Start Here",
          "code": "GO",
          "branch": "arithmetic",
          "role": "start",              // exactly one per subject, no stage
          "description": "…",
          "tip": "…"
        },
        {
          "id": "math-ops",
          "title": "Operations & Number Sense",
          "code": "OPS",
          "branch": "arithmetic",
          "role": "main",               // exactly one main per stage
          "stage": 0,
          "description": "…",
          "tip": "…"
        },
        {
          "id": "math-fractions",
          "title": "Fractions, Decimals & Percents",
          "code": "FRC",
          "branch": "arithmetic",
          "role": "sub",                // 1–5 subskills per stage
          "stage": 0,
          "description": "…",
          "tip": "…"
        }
        // …stage 1 main and subskills, stage 2, etc.
      ]
    }
  ]
}
```

### How the hex tree works

1. The **start node** is always available and opens the first stage.
2. A stage's **subskills** become available when the previous stage's milestone is claimed (or when the start node is cleared, for stage 1).
3. Master every subskill in a stage's ring, then claim the **milestone** at its centre.
4. Claiming that milestone opens the next stage. The final milestone completes the subject.

Subskills are placed automatically on the six cells surrounding their milestone. **Array order decides the slot**, so keep a stage's main node followed by its subskills in the order you want them around the ring:

| Subskills | Slots used |
| --- | --- |
| 1 | NE |
| 2 | NW, SE |
| 3 | NW, NE, SE |
| 4 | NW, NE, SE, SW |
| 5 | NW, NE, SE, SW, E (best saved for the final stage) |

### Add a subskill

1. Give it a unique `id` and pick one of the subject's `branch` ids.
2. Set `"role": "sub"` and the `stage` it belongs to.
3. Put it directly after the other subskills of that stage (up to 5) and run `npm run validate`.

### Add a stage

1. Add `{ "role": "main", "stage": N, ... }` plus at least one `{ "role": "sub", "stage": N, ... }` under the subject.
2. Stage numbers must be contiguous from `0`, and there can be only one main per stage.
3. Each stage uses `stages[N]` for its header label.

### Add a subject

Copy a subject object, give it a unique `id`, and fill in its branches, start node, and 4-stage path. The header dropdown, legend, progress, and ring layout are all derived automatically.

### Rules enforced by `npm run validate`

- Unique subject, branch, and node ids.
- Exactly one `start` node per subject, with no `stage`.
- Exactly one `main` node per stage, and at least one (at most five) `sub` nodes.
- Stage numbers are contiguous from `0`.
- Every node's branch and stage exist.
- Hex ring capacity is respected.
- Legacy `tier`, `lane`, and `requires` fields are reported so old data can be cleaned up.

The app runs the same checks on load and shows a readable error screen if the JSON is invalid.

## Interactions

| Action | Result |
| --- | --- |
| Drag | Pan the tree |
| Scroll / pinch | Zoom toward the cursor |
| Theme toggle (sun / moon) | Switch between dark and light mode |
| Click a diamond | Open the detail panel |
| Double-click a diamond | Master / unmaster a node |
| Master a subskill | Adds one segment to its milestone's progress pips |
| Right-click a mastered diamond | Remove it and its downstream stages |
| Claim milestone | Available once every subskill in the ring is mastered |
| Unlearn milestone | Clears its ring and every later stage |
| Branch chip | Dim everything outside that branch |
| Subject dropdown | Switch subjects (progress is kept per subject) |
| Reset | Clear mastered skills for the current subject |

Progress is saved in `localStorage` under `upcat-skill-tree:progress:v1`. The theme is saved under `upcat-skill-tree:theme:v1`; on a first visit it follows your system color-scheme preference. A shareable URL is written as `?subject=<id>`, so `?subject=science` opens Science directly.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which validates the JSON, builds the site, and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** once for a new repository.
