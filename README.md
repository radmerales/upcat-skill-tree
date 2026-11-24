# UPCAT Skill Tree

An interactive, left-to-right study map for the UPCAT (University of the Philippines College Admission Test). Pick a subject from the top dropdown and work from the start node through a connected honeycomb of skills.

The design is inspired by the [ARC Raiders Skill Builder](https://metaforge.app/arc-raiders/skill-builder): a pan-and-zoom canvas, glowing nodes, a mastery counter, click-to-learn, and right-click-to-remove. Every node is a full hex tile on a pointy-top honeycomb, and prerequisites are connected along the shared edge of the two cells. Dark and light themes are both supported.

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
  "version": 3,
  "title": "UPCAT Skill Tree",
  "subtitle": "…",
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
          "q": 0,
          "r": 0,
          "start": true,              // exactly one node per subject
          "description": "…",
          "tip": "…",
          "requires": []
        },
        {
          "id": "math-expressions",
          "title": "Algebraic Expressions",
          "code": "ALG",
          "branch": "algebra",
          "q": 1,
          "r": -1,
          "description": "…",
          "tip": "…",
          "requires": ["math-start"]  // must share a hex edge with this node
        }
      ]
    }
  ]
}
```

### Hex cells and prerequisites

Each node occupies one cell of a pointy-top axial hex grid. `q` grows to the right; `r` moves down and to the right. Nodes are drawn at the cell centre and fill the cell, so their corners line up with the background honeycomb.

A node can require any number of nodes, but **every prerequisite must be an adjacent cell** — the connector is rendered on the shared edge of the background hexagons. Validation rejects any link that does not share a hex edge.

The current maps use three arms that radiate from the start and converge on a final capstone:

- Start at `0,0`.
- Each subsequent node in an arm sits one cell to the east of the previous node (`q + 1`, same `r`).
- The final capstone sits one column to the right of the arm ends and requires the last node of each arm.

### Add a skill

1. Find a free cell next to an existing node. Check the neighbours in the `q/r` grid.
2. Give the node a unique `id`, a `branch`, and its `q`/`r`.
3. Add `requires` with the ids of adjacent nodes that must be mastered first.
4. Run `npm run validate` — it checks adjacency, collisions, and reachability.

### Add a branch

Add `{ "id": "...", "name": "...", "color": "#rrggbb" }` to the subject's `branches`. The colour drives the node border, mastered fill, shared-edge connector, and legend chip.

### Add a subject

Copy a subject object, give it a unique `id`, and fill in branches and a connected node map with exactly one `"start": true` node. The header dropdown, legend, and progress counter build themselves from this array.

### Rules enforced by `npm run validate`

- Unique subject, branch, and node ids.
- Exactly one start node, with no prerequisites.
- Every non-start node has at least one prerequisite.
- Every prerequisite exists, is not the node itself, and **shares a hex edge** with the node.
- No two nodes share the same `q` + `r` cell.
- Every node can eventually be unlocked from the start.
- Legacy `role`, `stage`, `tier`, and `lane` fields are reported so old data can be cleaned up.

The app runs the same checks on load and shows a readable error screen if the JSON is invalid.

## Interactions

| Action | Result |
| --- | --- |
| Drag | Pan the tree |
| Scroll / pinch | Zoom toward the cursor |
| Theme toggle (sun / moon) | Switch between dark and light mode |
| Click a hex | Open the detail panel |
| Double-click a hex | Master / unmaster a node |
| Right-click a mastered hex | Remove it and every node that depends on it |
| Start node | Master it to open the three connected arms |
| Branch chip | Dim everything outside that branch |
| Subject dropdown | Switch subjects (progress is kept per subject) |
| Reset | Clear mastered skills for the current subject |

Hexes are connected by the shared border between adjacent cells. Master a node to open every hex that requires it. Progress is saved in `localStorage` under `upcat-skill-tree:progress:v1`. The theme is saved under `upcat-skill-tree:theme:v1`; on a first visit it follows your system color-scheme preference. A shareable URL is written as `?subject=<id>`, so `?subject=science` opens Science directly.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which validates the JSON, builds the site, and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** once for a new repository.
