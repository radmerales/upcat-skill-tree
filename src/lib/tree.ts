import type { Branch, HexCell, NodeState, SkillNode, Subject, SubjectLayout, TreeData } from '../types'

/* -------------------------------------------------------------------------- */
/*  Hex geometry                                                               */
/* -------------------------------------------------------------------------- */

/** Circumradius of one grid cell. Nodes are rendered as the cell itself. */
export const HEX_R = 108
export const HEX_W = Math.sqrt(3) * HEX_R
export const HEX_V = 1.5 * HEX_R

const PAD = 96
const UNIT_STEPS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
]

export function areAdjacent(a: SkillNode, b: SkillNode): boolean {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return UNIT_STEPS.some(([eq, er]) => eq === dq && er === dr)
}

export function hexPoints(x: number, y: number): string {
  const hw = HEX_W / 2
  const hr = HEX_R / 2
  return [
    `${x},${y - HEX_R}`,
    `${x + hw},${y - hr}`,
    `${x + hw},${y + hr}`,
    `${x},${y + HEX_R}`,
    `${x - hw},${y + hr}`,
    `${x - hw},${y - hr}`,
  ].join(' ')
}

/** Polygon in a local cell box (0,0)-(HEX_W, 2*HEX_R). */
export function cellPolygon(inset = 0): string {
  const cx = HEX_W / 2
  const cy = HEX_R
  const scale = 1 - inset
  const points: Array<[number, number]> = [
    [cx, cy - HEX_R * scale],
    [cx + (HEX_W / 2) * scale, cy - (HEX_R / 2) * scale],
    [cx + (HEX_W / 2) * scale, cy + (HEX_R / 2) * scale],
    [cx, cy + HEX_R * scale],
    [cx - (HEX_W / 2) * scale, cy + (HEX_R / 2) * scale],
    [cx - (HEX_W / 2) * scale, cy - (HEX_R / 2) * scale],
  ]
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
}

/**
 * The visible connecting edge between two adjacent cells. It is the shared
 * side of the two background hexagons.
 */
export function sharedEdge(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const px = -dy / length
  const py = dx / length
  const half = HEX_R / 2
  return {
    x1: midX - px * half,
    y1: midY - py * half,
    x2: midX + px * half,
    y2: midY + py * half,
  }
}

/* -------------------------------------------------------------------------- */
/*  Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function layoutSubject(subject: Subject): SubjectLayout {
  const raw = new Map<string, { x: number; y: number }>()
  let minQ = Infinity
  let maxQ = -Infinity
  let minR = Infinity
  let maxR = -Infinity
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const node of subject.nodes) {
    const x = HEX_W * (node.q + node.r / 2)
    const y = HEX_V * node.r
    raw.set(node.id, { x, y })
    minQ = Math.min(minQ, node.q)
    maxQ = Math.max(maxQ, node.q)
    minR = Math.min(minR, node.r)
    maxR = Math.max(maxR, node.r)
    minX = Math.min(minX, x - HEX_W / 2)
    maxX = Math.max(maxX, x + HEX_W / 2)
    minY = Math.min(minY, y - HEX_R)
    maxY = Math.max(maxY, y + HEX_R)
  }

  const offsetX = PAD - minX
  const offsetY = PAD - minY

  const positions: Record<string, { x: number; y: number }> = {}
  for (const [id, point] of raw) {
    positions[id] = { x: point.x + offsetX, y: point.y + offsetY }
  }

  const occupied = new Set(subject.nodes.map((node) => `${node.q}:${node.r}`))
  const hexCells: HexCell[] = []
  for (let r = minR - 2; r <= maxR + 2; r += 1) {
    for (let q = minQ - 2; q <= maxQ + 2; q += 1) {
      hexCells.push({
        x: HEX_W * (q + r / 2) + offsetX,
        y: HEX_V * r + offsetY,
        occupied: occupied.has(`${q}:${r}`),
      })
    }
  }

  return {
    positions,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
    hexCells,
  }
}

/* -------------------------------------------------------------------------- */
/*  Progression                                                                */
/* -------------------------------------------------------------------------- */

export function nodeState(node: SkillNode, mastered: Set<string>): NodeState {
  if (mastered.has(node.id)) return 'mastered'
  return node.requires.every((id) => mastered.has(id)) ? 'available' : 'locked'
}

export function stateLabel(state: NodeState): string {
  return state === 'mastered' ? 'Mastered' : state === 'available' ? 'Ready to learn' : 'Locked'
}

export function missingRequirements(node: SkillNode, mastered: Set<string>): string[] {
  return node.requires.filter((id) => !mastered.has(id))
}

export function dependentsOf(subject: Subject, nodeId: string): SkillNode[] {
  return subject.nodes.filter((node) => node.requires.includes(nodeId))
}

/** A node plus everything that transitively depends on it. */
export function collectSubtree(subject: Subject, nodeId: string): string[] {
  const result = new Set<string>([nodeId])
  const stack = [nodeId]
  while (stack.length) {
    const current = stack.pop() as string
    for (const dependent of dependentsOf(subject, current)) {
      if (!result.has(dependent.id)) {
        result.add(dependent.id)
        stack.push(dependent.id)
      }
    }
  }
  return [...result]
}

/**
 * Drops saved nodes whose prerequisites are no longer mastered. Old stage-era
 * saves and hand-edited storage are cleaned up automatically on load.
 */
export function sanitizeMastered(subject: Subject, stored: Set<string>): Set<string> {
  const validIds = new Set(subject.nodes.map((node) => node.id))
  const valid = new Set([...stored].filter((id) => validIds.has(id)))

  let changed = true
  while (changed) {
    changed = false
    for (const node of subject.nodes) {
      if (!valid.has(node.id)) continue
      if (!node.requires.every((id) => valid.has(id))) {
        valid.delete(node.id)
        changed = true
      }
    }
  }
  return valid
}

export function branchMap(subject: Subject): Record<string, Branch> {
  return Object.fromEntries(subject.branches.map((branch) => [branch.id, branch]))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/* -------------------------------------------------------------------------- */
/*  Data validation                                                            */
/* -------------------------------------------------------------------------- */

class DataError extends Error {}

function fail(message: string): never {
  throw new DataError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${where} must be a non-empty string.`)
  }
  return value
}

function readInt(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${where} must be a whole number.`)
  }
  return value
}

function readStringArray(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${where} must be an array of node ids.`)
  }
  return value as string[]
}

export function normalizeData(raw: unknown): TreeData {
  if (!isRecord(raw)) fail('The data file must contain a JSON object.')

  const title = readString(raw.title, 'title')
  const subtitle = readString(raw.subtitle, 'subtitle')
  const version = readInt(raw.version ?? 3, 'version')

  if (!Array.isArray(raw.subjects) || raw.subjects.length === 0) {
    fail('subjects must be a non-empty array.')
  }

  const seenSubjects = new Set<string>()
  const subjects: Subject[] = raw.subjects.map((entry, subjectIndex) => {
    const where = `subjects[${subjectIndex}]`
    if (!isRecord(entry)) fail(`${where} must be an object.`)

    const id = readString(entry.id, `${where}.id`)
    if (seenSubjects.has(id)) fail(`Duplicate subject id "${id}".`)
    seenSubjects.add(id)

    if (!Array.isArray(entry.branches) || entry.branches.length === 0) {
      fail(`${where}.branches must be a non-empty array.`)
    }
    const seenBranches = new Set<string>()
    const branches: Branch[] = entry.branches.map((branch, branchIndex) => {
      const branchWhere = `${where}.branches[${branchIndex}]`
      if (!isRecord(branch)) fail(`${branchWhere} must be an object.`)
      const branchId = readString(branch.id, `${branchWhere}.id`)
      if (seenBranches.has(branchId)) fail(`${where}: duplicate branch id "${branchId}".`)
      seenBranches.add(branchId)
      return {
        id: branchId,
        name: readString(branch.name, `${branchWhere}.name`),
        color: readString(branch.color, `${branchWhere}.color`),
      }
    })

    if (!Array.isArray(entry.nodes) || entry.nodes.length === 0) {
      fail(`${where}.nodes must be a non-empty array.`)
    }

    const seenNodes = new Set<string>()
    const seenCells = new Map<string, string>()
    const nodes: SkillNode[] = entry.nodes.map((node, nodeIndex) => {
      const nodeWhere = `${where}.nodes[${nodeIndex}]`
      if (!isRecord(node)) fail(`${nodeWhere} must be an object.`)

      const nodeId = readString(node.id, `${nodeWhere}.id`)
      if (seenNodes.has(nodeId)) fail(`${where}: duplicate node id "${nodeId}".`)
      seenNodes.add(nodeId)

      const branch = readString(node.branch, `${where}.${nodeId}.branch`)
      if (!seenBranches.has(branch)) {
        fail(`${where}.${nodeId}: branch "${branch}" is not declared in branches.`)
      }

      const q = readInt(node.q, `${where}.${nodeId}.q`)
      const r = readInt(node.r, `${where}.${nodeId}.r`)
      const cell = `${q}:${r}`
      if (seenCells.has(cell)) {
        fail(`${where}.${nodeId} shares cell ${cell} with "${seenCells.get(cell)}".`)
      }
      seenCells.set(cell, nodeId)

      for (const legacy of ['role', 'stage', 'tier', 'lane']) {
        if (node[legacy] !== undefined) {
          console.warn(`${where}.${nodeId}: "${legacy}" is no longer used.`)
        }
      }

      return {
        id: nodeId,
        title: readString(node.title, `${where}.${nodeId}.title`),
        code: readString(node.code, `${where}.${nodeId}.code`),
        branch,
        q,
        r,
        start: node.start === true ? true : undefined,
        description: readString(node.description, `${where}.${nodeId}.description`),
        tip: typeof node.tip === 'string' ? node.tip : '',
        requires: readStringArray(node.requires ?? [], `${where}.${nodeId}.requires`),
      }
    })

    const starts = nodes.filter((node) => node.start)
    if (starts.length !== 1) {
      fail(`${where}: exactly one node must have "start": true (found ${starts.length}).`)
    }
    const startNode = starts[0]
    if (startNode.requires.length > 0) {
      fail(`${where}.${startNode.id}: the start node must not require anything.`)
    }

    const byId = new Map(nodes.map((node) => [node.id, node]))
    for (const node of nodes) {
      if (!node.start && node.requires.length === 0) {
        fail(`${where}.${node.id}: every non-start node needs at least one prerequisite.`)
      }
      for (const requirementId of node.requires) {
        if (requirementId === node.id) fail(`${where}.${node.id} requires itself.`)
        const requirement = byId.get(requirementId)
        if (!requirement) fail(`${where}.${node.id}: unknown prerequisite "${requirementId}".`)
        if (!areAdjacent(node, requirement)) {
          fail(
            `${where}.${node.id} requires "${requirementId}" but they do not share a hex edge ` +
              `(cell ${node.q}:${node.r} vs ${requirement.q}:${requirement.r}).`,
          )
        }
      }
    }

    // Every node must become reachable by mastering prerequisites in order.
    const reachable = new Set<string>([startNode.id])
    let changed = true
    while (changed) {
      changed = false
      for (const node of nodes) {
        if (reachable.has(node.id)) continue
        if (node.requires.every((id) => reachable.has(id))) {
          reachable.add(node.id)
          changed = true
        }
      }
    }
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        fail(`${where}.${node.id} can never unlock (cycle or unreachable prerequisite chain).`)
      }
    }

    return {
      id,
      name: readString(entry.name, `${where}.name`),
      kicker: readString(entry.kicker, `${where}.kicker`),
      blurb: readString(entry.blurb, `${where}.blurb`),
      accent: readString(entry.accent, `${where}.accent`),
      branches,
      nodes,
    }
  })

  return { version, title, subtitle, subjects }
}
