import type {
  Branch,
  TriangleCell,
  NodeState,
  Point,
  RoutedEdge,
  SkillNode,
  Subject,
  SubjectLayout,
  TreeData,
} from '../types'

/* -------------------------------------------------------------------------- */
/*  Triangle geometry                                                          */
/* -------------------------------------------------------------------------- */

/** Equilateral triangle side, and the height of one row of triangles. */
export const TRI_S = 92
export const TRI_H = (TRI_S * Math.sqrt(3)) / 2

/** Every corner of the triangular lattice. */
export function vertexPoint(u: number, v: number): Point {
  return { x: (u + v / 2) * TRI_S, y: v * TRI_H }
}

const TRI_NEIGHBORS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
]

const PAD = 84
const NODE_HALF_W = 84
const NODE_TOP = 58
const NODE_BOTTOM = 102

function buildGraph(minU: number, maxU: number, minV: number, maxV: number) {
  const verts = new Set<string>()
  for (let v = minV; v <= maxV; v += 1) {
    for (let u = minU; u <= maxU; u += 1) verts.add(`${u},${v}`)
  }

  const neighbors = new Map<string, string[]>()
  for (const key of verts) {
    const [u, v] = key.split(',').map(Number)
    const list: string[] = []
    for (const [du, dv] of TRI_NEIGHBORS) {
      const nk = `${u + du},${v + dv}`
      if (verts.has(nk)) list.push(nk)
    }
    neighbors.set(key, list)
  }
  return { verts, neighbors }
}

/** Shortest route across triangle edges, preferring fewer bends. */
function routeEdge(
  graph: ReturnType<typeof buildGraph>,
  from: string,
  to: string,
  blocked: Set<string>,
): Array<[number, number]> | null {
  if (!graph.verts.has(from) || !graph.verts.has(to)) return null

  interface State {
    key: string
    dir: number
    cost: number
    path: string[]
  }

  const dirIndex = new Map<string, number>()
  TRI_NEIGHBORS.forEach((step, index) => dirIndex.set(`${step[0]},${step[1]}`, index))

  const queue: State[] = [{ key: from, dir: -1, cost: 0, path: [from] }]
  const best = new Map<string, number>([[`${from}|-1`, 0]])

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift() as State
    const currentBest = best.get(`${current.key}|${current.dir}`)
    if (currentBest !== undefined && current.cost > currentBest) continue

    if (current.key === to) {
      return current.path.map((key) => {
        const [u, v] = key.split(',').map(Number)
        return [u, v] as [number, number]
      })
    }

    const [cu, cv] = current.key.split(',').map(Number)
    for (const nextKey of graph.neighbors.get(current.key) ?? []) {
      if (blocked.has(nextKey) && nextKey !== to) continue
      const [nu, nv] = nextKey.split(',').map(Number)
      const dir = dirIndex.get(`${nu - cu},${nv - cv}`) ?? -1
      if (dir === -1) continue
      const turn = current.dir === -1 || current.dir === dir ? 0 : 0.3
      const cost = current.cost + 1 + turn
      const stateKey = `${nextKey}|${dir}`
      const known = best.get(stateKey)
      if (known !== undefined && known <= cost) continue
      best.set(stateKey, cost)
      queue.push({ key: nextKey, dir, cost, path: [...current.path, nextKey] })
    }
  }
  return null
}

function simplify(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 2) return points
  const result: Array<[number, number]> = [points[0]]
  for (let i = 1; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    const [cx, cy] = points[i + 1]
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    if (cross !== 0) result.push(points[i])
  }
  result.push(points[points.length - 1])
  return result
}

export function layoutSubject(subject: Subject): SubjectLayout {
  const raw = new Map<string, Point>()
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const node of subject.nodes) {
    const point = vertexPoint(node.u, node.v)
    raw.set(node.id, point)
    minU = Math.min(minU, node.u)
    maxU = Math.max(maxU, node.u)
    minV = Math.min(minV, node.v)
    maxV = Math.max(maxV, node.v)
    minX = Math.min(minX, point.x - NODE_HALF_W)
    maxX = Math.max(maxX, point.x + NODE_HALF_W)
    minY = Math.min(minY, point.y - NODE_TOP)
    maxY = Math.max(maxY, point.y + NODE_BOTTOM)
  }

  const offsetX = PAD - minX
  const offsetY = PAD - minY

  const positions: Record<string, Point> = {}
  for (const [id, point] of raw) {
    positions[id] = { x: point.x + offsetX, y: point.y + offsetY }
  }

  /* Background triangle tessellation ------------------------------------- */
  const triangles: TriangleCell[] = []
  const vStart = minV - 5
  const vEnd = maxV + 5
  const uStart = minU - 6
  const uEnd = maxU + 6
  const at = (u: number, v: number): Point => {
    const point = vertexPoint(u, v)
    return { x: point.x + offsetX, y: point.y + offsetY }
  }

  for (let v = vStart; v <= vEnd; v += 1) {
    for (let u = uStart; u <= uEnd; u += 1) {
      const alt = (u + v) % 2 === 0
      const tl = at(u, v)
      const tr = at(u + 1, v)
      const ml = at(u, v + 1)
      const mr = at(u + 1, v + 1)
      triangles.push({ points: [tl, tr, ml], alt })
      triangles.push({ points: [tr, mr, ml], alt: !alt })
    }
  }

  /* Route prerequisites along triangle edges ----------------------------- */
  const graph = buildGraph(minU - 10, maxU + 11, minV - 10, maxV + 10)
  const blocked = new Set(subject.nodes.map((node) => `${node.u},${node.v}`))
  const edgePaths: RoutedEdge[] = []

  for (const node of subject.nodes) {
    for (const requirementId of node.requires) {
      const requirement = subject.nodes.find((entry) => entry.id === requirementId)
      if (!requirement) continue
      const fromKey = `${requirement.u},${requirement.v}`
      const toKey = `${node.u},${node.v}`
      let route = routeEdge(graph, fromKey, toKey, blocked)
      if (!route) route = routeEdge(graph, fromKey, toKey, new Set())

      const points = (route ?? [[requirement.u, requirement.v], [node.u, node.v]]).map(([u, v]) => {
        const point = vertexPoint(u, v)
        return { x: point.x + offsetX, y: point.y + offsetY }
      })
      const simplified = simplify(points.map((point) => [point.x, point.y] as [number, number])).map(
        ([x, y]) => ({ x, y }),
      )

      edgePaths.push({
        key: `${requirementId}->${node.id}`,
        from: requirementId,
        to: node.id,
        points: simplified,
      })
    }
  }

  return {
    positions,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
    triangles,
    edgePaths,
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
  const version = readInt(raw.version ?? 4, 'version')

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
    const seenVertices = new Map<string, string>()
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

      const u = readInt(node.u, `${where}.${nodeId}.u`)
      const v = readInt(node.v, `${where}.${nodeId}.v`)
      const cell = `${u}:${v}`
      if (seenVertices.has(cell)) {
        fail(`${where}.${nodeId} shares corner ${cell} with "${seenVertices.get(cell)}".`)
      }
      seenVertices.set(cell, nodeId)

      for (const legacy of ['role', 'stage', 'tier', 'lane', 'q', 'r']) {
        if (node[legacy] !== undefined) {
          console.warn(`${where}.${nodeId}: "${legacy}" is no longer used.`)
        }
      }

      return {
        id: nodeId,
        title: readString(node.title, `${where}.${nodeId}.title`),
        code: readString(node.code, `${where}.${nodeId}.code`),
        branch,
        u,
        v,
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
        if (!byId.has(requirementId)) {
          fail(`${where}.${node.id}: unknown prerequisite "${requirementId}".`)
        }
      }
    }

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
