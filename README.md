# UPCAT Skill Tree

An interactive flowchart-style study map for the UPCAT (University of the Philippines College Admission Test). Pick a subject from the top dropdown and work from the start node through skills placed on hex anchors of a triangular lattice.

A warm, Primary-inspired study map: cream paper surfaces, rounded cards and pill chips, soft warm borders, green completion checks, and playful yellow, red, and blue accents. Every node starts on a hex anchor — lessons are circles, quizzes are diamonds — and warm connectors run along the triangle mesh, re-routing as you drag nodes between anchors.

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
          "u": 0,                     // hex anchor coordinates (see below)
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

### Hex anchors and connectors

The background is an equilateral **triangle mesh**. Nodes are only allowed on **hex centres** — alternating corners of the mesh, where six triangles meet to form a hexagon. In practice a node's `u` and `v` coordinates are both **even**, so the nearest another node can sit is two mesh edges away, with at least one corner between them. `u` moves horizontally and `v` moves down one triangle row. The start node uses `0,0`. Positions are only the starting layout — drag any node to snap it live to another anchor, swapping places with any node already there.

Each node is a small shape with its label underneath, like a flowchart node: lesson nodes are circles and quiz nodes (`"type": "quiz"`) are diamonds. Nodes without a `type` default to `"lesson"`. Idle nodes use a faded tint of their branch colour for the fill with a matching solid border; mastered nodes switch to a darker shade of the branch colour with a matching halo ring and light text. Connectors are routed along the triangle edges between each node and its prerequisites, and are recomputed whenever a node changes anchor. Locked connectors remain visible as a faded, static outline so the whole network stays readable.

For easy editing, copy a node's `u,v` and move by one anchor step (two mesh edges):

| Direction | `u` change | `v` change |
| --- | --- | --- |
| Right / left | ±2 | 0 |
| Down-right / up-left | 0 | ±2 |
| Up-right / down-left | ±2 | ∓2 |

`requires` can point at any node — it does not have to be the nearest one. Connectors route around the mesh and bend at triangle corners rather than cutting across the background. Validation requires every anchor to be unique, every `u` and `v` to be even, and every prerequisite chain to be reachable.

The current maps use three arms that start from the start node and converge on a final capstone, but the geometry is free-form: add, branch, or reconnect nodes wherever there is a free anchor.

### Add a branch

Add `{ "id": "...", "name": "...", "color": "#rrggbb" }` to the subject's `branches`. The colour drives the node border, mastered fill, connector, and legend chip.

### Add a subject

Copy a subject object, give it a unique `id`, and fill in branches and a set of hex-anchor nodes with exactly one `"start": true` node. The header dropdown, legend, connector lines, and progress counter build themselves from this array.

### Rules enforced by `npm run validate`

- Unique subject, branch, and node ids.
- Exactly one start node, with no prerequisites.
- Every non-start node has at least one prerequisite.
- Every prerequisite exists and is not the node itself.
- Every `u,v` pair is an even-even hex anchor.
- `type`, when present, is either `"lesson"` or `"quiz"`.
- No two nodes share the same anchor.
- Every node can eventually be unlocked from the start.
- Legacy `role`, `stage`, `tier`, and `lane` fields are reported so old data can be cleaned up.

The app runs the same checks on load and shows a readable error screen if the JSON is invalid.

## Interactions

| Action | Result |
| --- | --- |
| Drag canvas | Pan the tree |
| Drag a node | Snaps live to the nearest hex anchor and previews the move with translucent ghosts at both anchors — swapping if the target is taken — then commits on drop |
| Scroll / pinch | Zoom toward the cursor |
| Click a node | Open the detail panel |
| Click outside the panel | Close the detail panel |
| Double-click a node | Master / unmaster a node |
| Select a node | Marching-ants outline around its shape |
| Next available edges | Marching dashes animate from mastered nodes to the next unmastered nodes |
| Right-click a mastered node | Remove it and every node that depends on it |
| Start node | Master it to open the three connected arms |
| Branch chip | Dim everything outside that branch |
| Subject dropdown | Switch subjects (progress is kept per subject) |
| Reset | Clear mastered skills for the current subject |

Connectors route along the triangle mesh between node anchors and are recomputed whenever a node is moved. Master a node to open every node that requires it, and the next available edges march in their branch colour. Progress is saved in `localStorage` under `upcat-skill-tree:progress:v1`. A shareable URL is written as `?subject=<id>`, so `?subject=science` opens Science directly.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which validates the JSON, builds the site, and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** once for a new repository.

## Credits

The visual theme is inspired by [Primary](https://github.com/primary-theme/obsidian) for Obsidian by Cecilia May ([Ko-fi](https://ko-fi.com/ceciliamay)).
