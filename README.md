# UPCAT Skill Tree

An interactive, left-to-right study skill tree for the UPCAT (University of the Philippines College Admission Test). Pick a subject from the top dropdown, pan around the canvas, and master diamond nodes by following their prerequisites.

The design is inspired by the [ARC Raiders Skill Builder](https://metaforge.app/arc-raiders/skill-builder): a pan-and-zoom canvas, glowing skill nodes, prerequisite lines, a mastery counter, click-to-learn, and right-click-to-remove. Dark and light themes are both supported.

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
  "version": 1,
  "title": "UPCAT Skill Tree",
  "subtitle": "…",
  "tiers": [
    { "label": "FOUNDATION", "note": "Rebuild the basics" }
    // tier 0, tier 1, … — column headers, left to right
  ],
  "subjects": [
    {
      "id": "math",                  // unique, used in ?subject=math
      "name": "Mathematics",         // shown in the dropdown
      "kicker": "SUBTEST 01",
      "blurb": "…",                  // shown in the dropdown
      "accent": "#f6b93b",           // subject accent color
      "branches": [
        { "id": "algebra", "name": "Algebra", "color": "#ff8f4d" }
      ],
      "nodes": [
        {
          "id": "math-ops",          // unique within the subject
          "title": "Operations & Number Sense",
          "code": "OPS",             // 2–4 characters shown inside the diamond
          "branch": "algebra",       // must exist in this subject's branches
          "tier": 0,                 // column, 0 = leftmost
          "lane": 0,                 // row inside the column
          "description": "…",        // detail panel body
          "tip": "…",                // optional "study method" callout
          "requires": []             // ids of earlier-tier prerequisites
        }
      ]
    }
  ]
}
```

### Add a skill

1. Give it a unique `id` (e.g. `math-trig`).
2. Pick a `branch`, a `tier` column, and a free `lane` row.
3. List prerequisite ids in `requires`. They **must sit in an earlier tier** so the graph always flows left to right.
4. Add the node to that subject's `nodes` array and run `npm run validate`.

### Add a branch

Add `{ "id": "...", "name": "...", "color": "#rrggbb" }` to the subject's `branches`. The branch color drives the node border, mastered fill, connection line, and the legend chip.

### Add a subject

Copy a subject object, give it a unique `id`, and fill in `branches` and `nodes`. The header dropdown builds itself from this array, and progress is stored per subject id.

### Rules enforced by `npm run validate`

- Unique subject, branch, and node ids.
- Every `requires` id exists in the same subject.
- Prerequisites are in an earlier tier than the node that needs them.
- No two nodes share the same `tier` + `lane`.
- Every node is reachable from a root node.
- Tiers referenced by nodes exist in the `tiers` array.

The app runs the same checks on load and shows a readable error screen if the JSON is invalid.

## Interactions

| Action | Result |
| --- | --- |
| Drag | Pan the tree |
| Scroll / pinch | Zoom toward the cursor |
| Theme toggle (sun / moon) | Switch between dark and light mode |
| Click a diamond | Open the detail panel |
| Double-click a diamond | Master / unmaster it |
| Right-click a mastered diamond | Remove it and everything it unlocks |
| Branch chip | Dim everything outside that branch |
| Subject dropdown | Switch subjects (progress is kept per subject) |
| Reset | Clear mastered skills for the current subject |

Progress is saved in `localStorage` under `upcat-skill-tree:progress:v1`. The theme is saved under `upcat-skill-tree:theme:v1`; on a first visit it follows your system color-scheme preference. A shareable URL is written as `?subject=<id>`, so `?subject=science` opens Science directly.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which validates the JSON, builds the site, and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** once for a new repository.
