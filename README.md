# UPCAT Skill Tree

An interactive flowchart-style study map for the UPCAT (University of the Philippines College Admission Test). Pick a subject from the top dropdown and work from the start node through skills placed on the corners of a triangular lattice.

A deliberately minimal, pan-and-zoom canvas: a quiet triangle grid, flat node shapes, a mastery counter, click-to-learn, and right-click-to-remove. Every node sits on a triangle corner — lessons are circles, quizzes are diamonds — and thin prerequisite lines are routed along the triangle edges like a flowchart. Dark and light themes are both supported.

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
  "version": 5,
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
          "type": "quiz",             // "lesson" (circle, default) or "quiz" (diamond)
          "u": 0,                     // triangle corner coordinates (see below)
          "v": 0,
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
          "u": 4,
          "v": -2,
          "description": "…",
          "tip": "…",
          "requires": ["math-start"]  // any node can be a prerequisite
        }
      ]
    }
  ]
}
```

### Triangle corners and routed prerequisites

The background is an equilateral **triangle mesh**. Nodes live on its **corners**, not inside the triangles or beside each other. `u` and `v` are corner-lattice coordinates: `u` moves horizontally and `v` moves down one triangle row. The start node uses `0,0`. Every integer `u,v` pair is a valid triangle corner.

Each node is a small shape with its label underneath, like a flowchart node: lesson nodes are circles and quiz nodes (`"type": "quiz"`) are diamonds. Nodes without a `type` default to `"lesson"`. Connector lines are path-found across the triangle graph between a node and each of its prerequisites, so lines only ever run along background triangle edges. The router also prefers fewer bends, which keeps paths clean.

For easy editing, copy a node's `u,v` and move by one triangle edge:

| Direction | `u` change | `v` change |
| --- | --- | --- |
| Right / left | ±1 | 0 |
| Down-right / up-left | 0 | ±1 |
| Up-right / down-left | ±1 | ∓1 |

`requires` can point at any node — it does not have to be the nearest one. The router finds a path through empty triangle edges. Validation requires every corner to be unique and every prerequisite chain to be reachable.

The current maps use three arms that start from the start node and converge on a final capstone, but the geometry is free-form: add, branch, or reconnect nodes wherever there is a free corner.

### Add a branch

Add `{ "id": "...", "name": "...", "color": "#rrggbb" }` to the subject's `branches`. The colour drives the node border, mastered fill, routed connector, and legend chip.

### Add a subject

Copy a subject object, give it a unique `id`, and fill in branches and a set of corner nodes with exactly one `"start": true` node. The header dropdown, legend, routed lines, and progress counter build themselves from this array.

### Rules enforced by `npm run validate`

- Unique subject, branch, and node ids.
- Exactly one start node, with no prerequisites.
- Every non-start node has at least one prerequisite.
- Every prerequisite exists and is not the node itself.
- Every `u,v` pair is a real triangle corner.
- `type`, when present, is either `"lesson"` or `"quiz"`.
- No two nodes share the same corner.
- Every node can eventually be unlocked from the start.
- Legacy `role`, `stage`, `tier`, and `lane` fields are reported so old data can be cleaned up.

The app runs the same checks on load and shows a readable error screen if the JSON is invalid.

## Interactions

| Action | Result |
| --- | --- |
| Drag | Pan the tree |
| Scroll / pinch | Zoom toward the cursor |
| Theme toggle (sun / moon) | Switch between dark and light mode |
| Click a node | Open the detail panel |
| Click outside the panel | Close the detail panel |
| Double-click a node | Master / unmaster a node |
| Select a node | Outline around its shape |
| Next available edges | Connector lines to the next unmastered nodes are highlighted |
| Right-click a mastered node | Remove it and every node that depends on it |
| Start node | Master it to open the three connected arms |
| Branch chip | Dim everything outside that branch |
| Subject dropdown | Switch subjects (progress is kept per subject) |
| Reset | Clear mastered skills for the current subject |

Flowchart lines travel along the triangle edges. Master a node to open every node that requires it, and the next available edges are drawn in their branch colours. Progress is saved in `localStorage` under `upcat-skill-tree:progress:v1`. The theme is saved under `upcat-skill-tree:theme:v1`; on a first visit it follows your system color-scheme preference. A shareable URL is written as `?subject=<id>`, so `?subject=science` opens Science directly.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which validates the JSON, builds the site, and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** once for a new repository.
