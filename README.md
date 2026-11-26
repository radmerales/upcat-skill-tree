# UPCAT Skill Tree

An interactive flowchart-style study map for the UPCAT (University of the Philippines College Admission Test). Pick a subject from the top dropdown and work from the start node through skills placed on hex anchors of a triangular lattice.

A warm, Primary-inspired study map: cream paper surfaces, rounded cards and pill chips, soft warm borders, green completion checks, and playful yellow, red, and blue accents. Every node starts on a hex anchor — lessons are circles, quizzes are diamonds, and checkpoint exams are hexagons — and warm connectors run along the triangle mesh, re-routing as you drag nodes between anchors.

The map is split into four subtests: Mathematics, Science, Language Proficiency, and Reading Comprehension. Each subject is its own JSON file and each subject has three checkpoint exams. A checkpoint covers a group of topics and must be passed at its configured score before the next group unlocks.

## Stack

- React 18 + TypeScript + Vite
- No UI framework — hand-written CSS and SVG
- One JSON file per subject plus a small root manifest
- Deployed to GitHub Pages via GitHub Actions

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run validate   # check every subject file before committing
npm run build      # type-check + production build
npm run preview    # preview the production build
```

## Data layout

```text
public/data/
├── upcat-skill-tree.json     # manifest: title, subtitle, list of subject files
└── subjects/
    ├── math.json
    ├── science.json
    ├── language.json
    └── reading.json
```

The app fetches the manifest at runtime, then fetches every subject file. Editing a subject JSON and refreshing the page is enough — no rebuild needed in dev.

### Root manifest

```jsonc
{
  "version": 6,
  "title": "UPCAT Skill Tree",
  "subtitle": "…",
  "subjectFiles": [
    "subjects/math.json",
    "subjects/science.json",
    "subjects/language.json",
    "subjects/reading.json"
  ]
}
```

Subject file paths are resolved relative to `public/data/`.

### Subject file

```jsonc
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
      "branch": "algebra",
      "type": "quiz",             // "lesson" (circle, default), "quiz" (diamond), or "exam" (hexagon)
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
      "requires": ["math-start"]
    }
  ]
}
```

### Checkpoint exams

A node with `"type": "exam"` must include an `exam` object:

```jsonc
{
  "id": "math-exam-1",
  "type": "exam",
  "title": "Foundations Exam",
  "code": "EX1",
  "branch": "checkpoints",
  "u": 8,
  "v": 0,
  "description": "…",
  "tip": "…",
  "requires": ["math-ratios", "math-inequalities", "math-coord", "math-displays"],
  "exam": {
    "passScore": 80,              // percentage required to master the node
    "questions": [
      {
        "prompt": "Simplify: 8 + 2 × (5 − 3)²",
        "choices": ["16", "20", "40", "12"],
        "answer": 0,              // index into choices
        "explanation": "…"        // shown in the result review
      }
    ]
  }
}
```

Exams are real gates. Clicking an available exam node opens the exam instead of mastering it, and the node is only added to mastered progress when the score reaches `passScore`. Because the next group's first nodes list the exam in `requires`, passing the exam is what unlocks the next group. A failed attempt still records the best score so the detail panel can show progress. Scores are saved separately from mastery in `localStorage` under `upcat-skill-tree:exams:v1`.

The current data gives each subject three checkpoint exams. To add a fourth, create an exam node after the last topic of a group and make the next group's first nodes require it.

### Hex anchors and connectors

The background is an equilateral **triangle mesh**. Nodes are only allowed on **hex centres** — alternating corners of the mesh, where six triangles meet to form a hexagon. In practice a node's `u` and `v` coordinates are both **even**, so the nearest another node can sit is two mesh edges away, with at least one corner between them. `u` moves horizontally and `v` moves down one triangle row. The start node uses `0,0`. Positions are only the starting layout — drag any node to snap it live to another anchor, swapping places with any node already there.

Each node is a small shape with its label underneath, like a flowchart node: lesson nodes are circles, quiz nodes (`"type": "quiz"`) are diamonds, and exam nodes (`"type": "exam"`) are hexagons. Nodes without a `type` default to `"lesson"`. Idle nodes use a faded tint of their branch colour for the fill with a matching solid border; mastered nodes switch to the solid branch colour with a matching halo ring and white labels. Connectors are routed along the triangle edges between each node and its prerequisites, and are recomputed whenever a node changes anchor. Locked connectors remain visible as a faded, static outline so the whole network stays readable.

For easy editing, copy a node's `u,v` and move by one anchor step (two mesh edges):

| Direction | `u` change | `v` change |
| --- | --- | --- |
| Right / left | ±2 | 0 |
| Down-right / up-left | 0 | ±2 |
| Up-right / down-left | ±2 | ∓2 |

`requires` can point at any node — it does not have to be the nearest one. Connectors route around the mesh and bend at triangle corners rather than cutting across the background. Validation requires every anchor to be unique, every `u` and `v` to be even, and every prerequisite chain to be reachable.

The maps use left-to-right groups that fan out across branches, converge on a checkpoint exam, then fan out again for the next group. The geometry is free-form: add, branch, or reconnect nodes wherever there is a free anchor.

### Add a branch

Add `{ "id": "...", "name": "...", "color": "#rrggbb" }` to the subject's `branches`. The colour drives the node border, mastered fill, connector, and legend chip.

### Add a subject

Create `public/data/subjects/<id>.json` with a unique `id`, branches, and a set of hex-anchor nodes with exactly one `"start": true` node. Then add the file path to `subjectFiles` in the root manifest. The header dropdown, legend, connector lines, and progress counter build themselves from the loaded subjects.

### Rules enforced by `npm run validate`

- Unique subject, branch, and node ids.
- Exactly one start node, with no prerequisites.
- Every non-start node has at least one prerequisite.
- Every prerequisite exists and is not the node itself.
- Every `u,v` pair is an even-even hex anchor.
- `type`, when present, is `"lesson"`, `"quiz"`, or `"exam"`.
- `exam` nodes define an `exam` object; non-exam nodes do not.
- Every exam has a `passScore` from 1 to 100, at least one question, valid choice indexes, and an explanation.
- No two nodes share the same anchor.
- Every node can eventually be unlocked from the start.
- Legacy `role`, `stage`, `tier`, and `lane` fields are reported so old data can be cleaned up.

The app runs the same checks on load and shows a readable error screen if a subject file is invalid.

## Interactions

| Action | Result |
| --- | --- |
| Drag canvas | Pan the tree |
| Drag a node | Snaps live to the nearest hex anchor and previews the move with translucent ghosts at both anchors — swapping if the target is taken — then commits on drop |
| Scroll / pinch | Zoom toward the cursor |
| Click a node | Open the detail panel |
| Click outside the panel | Close the detail panel |
| Double-click a lesson or quiz node | Master / unmaster a node |
| Double-click an available exam node | Open its checkpoint exam |
| Pass an exam | Master the exam node and unlock the next group at the required score |
| Fail an exam | Keep the best attempt score; the node stays available for a retry |
| Select a node | Marching-ants outline around its shape |
| Next available edges | Marching dashes animate from mastered nodes to the next unmastered nodes |
| Right-click a mastered node | Remove it and every node that depends on it |
| Start node | Master it to open the first group |
| Branch chip | Dim everything outside that branch |
| Subject dropdown | Switch subjects (progress is kept per subject) |
| Reset | Clear mastered skills and exam scores for the current subject |

Connectors route along the triangle mesh between node anchors and are recomputed whenever a node is moved. Master a node to open every node that requires it, and the next available edges march in their branch colour. Progress is saved in `localStorage` under `upcat-skill-tree:progress:v1`. Exam best scores are saved under `upcat-skill-tree:exams:v1`. A shareable URL is written as `?subject=<id>`, so `?subject=science` opens Science directly.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which validates every subject file, builds the site, and publishes `dist/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** once for a new repository.

## Credits

The visual theme is inspired by [Primary](https://github.com/primary-theme/obsidian) for Obsidian by Cecilia May ([Ko-fi](https://ko-fi.com/ceciliamay)).
