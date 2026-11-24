import type {
  Branch,
  HexCell,
  NodeState,
  SkillNode,
  StageGroup,
  Subject,
  SubjectLayout,
  SubjectStructure,
  TreeData,
} from '../types'

/* -------------------------------------------------------------------------- */
/*  Hex geometry                                                               */
/* -------------------------------------------------------------------------- */

/** Circumradius of one grid cell. Node centres sit exactly on cell centres. */
export const HEX_R = 108
export const HEX_W = Math.sqrt(3) * HEX_R
export const HEX_V = 1.5 * HEX_R

/** Milestones sit two cells apart, leaving a free cell for the spine edge. */
const STAGE_STEP_Q = 2
const START_Q = -1

const SLOT_OFFSETS = {
  NW: { x: -HEX_W / 2, y: -HEX_V },
  NE: { x: HEX_W / 2, y: -HEX_V },
  E: { x: HEX_W, y: 0 },
  SE: { x: HEX_W / 2, y: HEX_V },
  SW: { x: -HEX_W / 2, y: HEX_V },
} as const

const SLOT_ORDERS: Record<number, Array<keyof typeof SLOT_OFFSETS>> = {
  1: ['NE'],
  2: ['NW', 'SE'],
  3: ['NW', 'NE', 'SE'],
  4: ['NW', 'NE', 'SE', 'SW'],
  5: ['NW', 'NE', 'SE', 'SW', 'E'],
}

const PAD_X = 90
const PAD_Y = 90
const STAGE_HEADER_GAP = 272

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

/* -------------------------------------------------------------------------- */
/*  Structure                                                                  */
/* -------------------------------------------------------------------------- */

export function buildStructure(subject: Subject): SubjectStructure {
  const start = subject.nodes.find((node) => node.role === 'start')
  if (!start) throw new Error(`${subject.name} has no start node.`)

  const mains = subject.nodes
    .filter((node) => node.role === 'main')
    .sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0))

  const groups: StageGroup[] = mains.map((main) => ({
    stage: main.stage ?? 0,
    main,
    subs: subject.nodes.filter((node) => node.role === 'sub' && node.stage === main.stage),
  }))

  const groupByNode = new Map<string, StageGroup>()
  for (const group of groups) {
    groupByNode.set(group.main.id, group)
    for (const sub of group.subs) groupByNode.set(sub.id, group)
  }

  return { start, groups, groupByNode }
}

export function gateForGroup(structure: SubjectStructure, group: StageGroup): SkillNode {
  return group.stage === 0
    ? structure.start
    : structure.groups[group.stage - 1].main
}

export function nextGroup(structure: SubjectStructure, stage: number): StageGroup | null {
  return structure.groups.find((group) => group.stage === stage + 1) ?? null
}

export function milestoneProgress(group: StageGroup, mastered: Set<string>): { done: number; total: number } {
  return {
    done: group.subs.filter((sub) => mastered.has(sub.id)).length,
    total: group.subs.length,
  }
}

/* -------------------------------------------------------------------------- */
/*  Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function layoutSubject(subject: Subject, structure: SubjectStructure): SubjectLayout {
  const raw = new Map<string, { x: number; y: number }>()

  raw.set(structure.start.id, { x: START_Q * HEX_W, y: 0 })

  for (const group of structure.groups) {
    const mainX = group.stage * STAGE_STEP_Q * HEX_W
    raw.set(group.main.id, { x: mainX, y: 0 })

    const slots = SLOT_ORDERS[group.subs.length] ?? SLOT_ORDERS[5]
    group.subs.forEach((sub, index) => {
      const slot = slots[index] ?? 'NE'
      const offset = SLOT_OFFSETS[slot]
      raw.set(sub.id, { x: mainX + offset.x, y: offset.y })
    })
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const include = (x: number, y: number, halfWidth: number, top: number, bottom: number) => {
    minX = Math.min(minX, x - halfWidth)
    maxX = Math.max(maxX, x + halfWidth)
    minY = Math.min(minY, y - top)
    maxY = Math.max(maxY, y + bottom)
  }

  for (const node of subject.nodes) {
    const point = raw.get(node.id)
    if (!point) continue
    if (node.role === 'main') include(point.x, point.y, 100, 52, 112)
    else if (node.role === 'start') include(point.x, point.y, 90, 40, 96)
    else include(point.x, point.y, 82, 36, 90)
  }

  for (const group of structure.groups) {
    const point = raw.get(group.main.id)
    if (!point) continue
    include(point.x, point.y - STAGE_HEADER_GAP, 136, 0, 50)
  }

  const offsetX = -minX + PAD_X
  const offsetY = -minY + PAD_Y
  const width = maxX - minX + PAD_X * 2
  const height = maxY - minY + PAD_Y * 2

  const positions: Record<string, { x: number; y: number }> = {}
  for (const [id, point] of raw) {
    positions[id] = { x: point.x + offsetX, y: point.y + offsetY }
  }

  const stageHeaders = structure.groups.map((group) => {
    const point = raw.get(group.main.id) ?? { x: 0, y: 0 }
    return {
      stage: group.stage,
      x: point.x + offsetX,
      y: point.y - STAGE_HEADER_GAP + offsetY,
    }
  })

  const occupied = new Set<string>()
  for (const point of raw.values()) {
    occupied.add(`${Math.round(point.x)}:${Math.round(point.y)}`)
  }

  const maxQ = STAGE_STEP_Q * (structure.groups.length - 1)
  const hexCells: HexCell[] = []
  for (let r = -3; r <= 3; r += 1) {
    for (let q = START_Q - 4; q <= maxQ + 4; q += 1) {
      const x = HEX_W * (q + r / 2)
      const y = HEX_V * r
      hexCells.push({
        x: x + offsetX,
        y: y + offsetY,
        occupied: occupied.has(`${Math.round(x)}:${Math.round(y)}`),
      })
    }
  }

  return { positions, width, height, stageHeaders, hexCells }
}

/* -------------------------------------------------------------------------- */
/*  Progression                                                                */
/* -------------------------------------------------------------------------- */

export function nodeState(node: SkillNode, structure: SubjectStructure, mastered: Set<string>): NodeState {
  if (mastered.has(node.id)) return 'mastered'
  if (node.role === 'start') return 'available'

  const group = structure.groupByNode.get(node.id)
  if (!group) return 'locked'
  const gate = gateForGroup(structure, group)
  if (!mastered.has(gate.id)) return 'locked'

  if (node.role === 'sub') return 'available'

  return group.subs.every((sub) => mastered.has(sub.id)) ? 'ready' : 'inprogress'
}

export function stateLabel(state: NodeState): string {
  switch (state) {
    case 'mastered':
      return 'Mastered'
    case 'ready':
      return 'Milestone ready'
    case 'inprogress':
      return 'In progress'
    case 'available':
      return 'Ready to learn'
    default:
      return 'Locked'
  }
}

/**
 * Removing a milestone clears its whole ring and every later stage.
 * Removing a subskill clears the milestone only if that milestone had been claimed.
 */
export function collectRemoval(
  subject: Subject,
  node: SkillNode,
  structure: SubjectStructure,
  mastered: Set<string>,
): string[] {
  if (node.role === 'start') return subject.nodes.map((entry) => entry.id)

  const group = structure.groupByNode.get(node.id)
  if (!group) return [node.id]

  if (node.role === 'sub' && !mastered.has(group.main.id)) return [node.id]

  const ids = new Set<string>()
  for (const entry of structure.groups) {
    if (entry.stage < group.stage) continue
    ids.add(entry.main.id)
    for (const sub of entry.subs) ids.add(sub.id)
  }
  return [...ids]
}

/**
 * Rebuilds a consistent mastery set for a subject. Old saves (or hand-edited
 * storage) can contain a milestone without its ring or a stage without its
 * gate; those entries are dropped so the canvas and counters always agree.
 */
export function sanitizeMastered(structure: SubjectStructure, stored: Set<string>): Set<string> {
  const valid = new Set<string>()
  if (!stored.has(structure.start.id)) return valid
  valid.add(structure.start.id)

  for (const group of structure.groups) {
    for (const sub of group.subs) {
      if (stored.has(sub.id)) valid.add(sub.id)
    }
    const ringDone = group.subs.every((sub) => valid.has(sub.id))
    if (!ringDone || !stored.has(group.main.id)) break
    valid.add(group.main.id)
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

function readInt(value: unknown, where: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    fail(`${where} must be a whole number >= ${min}.`)
  }
  return value
}

export function normalizeData(raw: unknown): TreeData {
  if (!isRecord(raw)) fail('The data file must contain a JSON object.')

  const title = readString(raw.title, 'title')
  const subtitle = readString(raw.subtitle, 'subtitle')
  const version = readInt(raw.version ?? 2, 'version', 1)

  if (!Array.isArray(raw.stages) || raw.stages.length === 0) {
    fail('stages must be a non-empty array.')
  }
  const stages = raw.stages.map((entry, index) => {
    if (!isRecord(entry)) fail(`stages[${index}] must be an object.`)
    return {
      label: readString(entry.label, `stages[${index}].label`),
      note: readString(entry.note, `stages[${index}].note`),
    }
  })

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

      const role = node.role
      if (role !== 'start' && role !== 'main' && role !== 'sub') {
        fail(`${where}.${nodeId}.role must be "start", "main", or "sub".`)
      }

      let stage: number | undefined
      if (role === 'start') {
        if (node.stage !== undefined) fail(`${where}.${nodeId}: start nodes do not use a stage.`)
      } else {
        stage = readInt(node.stage, `${where}.${nodeId}.stage`)
        if (stage >= stages.length) {
          fail(`${where}.${nodeId}: stage ${stage} has no entry in the stages array.`)
        }
      }

      return {
        id: nodeId,
        title: readString(node.title, `${where}.${nodeId}.title`),
        code: readString(node.code, `${where}.${nodeId}.code`),
        branch,
        role,
        stage,
        description: readString(node.description, `${where}.${nodeId}.description`),
        tip: typeof node.tip === 'string' ? node.tip : '',
      }
    })

    const starts = nodes.filter((node) => node.role === 'start')
    if (starts.length !== 1) {
      fail(`${where}: exactly one start node is required (found ${starts.length}).`)
    }

    const stageNumbers = [...new Set(nodes.filter((node) => node.stage !== undefined).map((node) => node.stage as number))].sort(
      (a, b) => a - b,
    )
    if (stageNumbers.length === 0) fail(`${where}: no milestone stages found.`)
    stageNumbers.forEach((stage, index) => {
      if (stage !== index) fail(`${where}: stages must be numbered contiguously from 0 (missing stage ${index}).`)
    })

    for (const stage of stageNumbers) {
      const mains = nodes.filter((node) => node.role === 'main' && node.stage === stage)
      if (mains.length !== 1) {
        fail(`${where}: stage ${stage} must have exactly one main node (found ${mains.length}).`)
      }
      const subs = nodes.filter((node) => node.role === 'sub' && node.stage === stage)
      if (subs.length === 0) fail(`${where}: stage ${stage} needs at least one surrounding subskill.`)
      if (subs.length > 5) {
        fail(`${where}: stage ${stage} has ${subs.length} subskills; the hex ring supports at most 5.`)
      }
    }

    const firstStageIndex = nodes.findIndex((node) => node.role === 'start')
    if (firstStageIndex !== 0) {
      // Order only affects ring slot assignment, not correctness, so this is just a nudge.
      console.warn(`${where}: placing the start node first keeps the file easier to read.`)
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

  return { version, title, subtitle, stages, subjects }
}
