import type { Branch, NodeState, SkillNode, Subject, SubjectLayout, Tier, TreeData } from '../types'

/* -------------------------------------------------------------------------- */
/*  Layout                                                                     */
/* -------------------------------------------------------------------------- */

export const COL_GAP = 232
export const ROW_GAP = 144
export const ORIGIN_X = 168
export const ORIGIN_Y = 196
export const TIER_HEAD_Y = 92

export function layoutSubject(subject: Subject): SubjectLayout {
  const positions: Record<string, { x: number; y: number }> = {}
  let maxTier = 0
  let maxLane = 0

  for (const node of subject.nodes) {
    positions[node.id] = {
      x: ORIGIN_X + node.tier * COL_GAP,
      y: ORIGIN_Y + node.lane * ROW_GAP,
    }
    maxTier = Math.max(maxTier, node.tier)
    maxLane = Math.max(maxLane, node.lane)
  }

  return {
    positions,
    maxTier,
    maxLane,
    width: ORIGIN_X + maxTier * COL_GAP + 190,
    height: ORIGIN_Y + maxLane * ROW_GAP + 170,
  }
}

export function branchMap(subject: Subject): Record<string, Branch> {
  return Object.fromEntries(subject.branches.map((branch) => [branch.id, branch]))
}

/* -------------------------------------------------------------------------- */
/*  Progression                                                                */
/* -------------------------------------------------------------------------- */

export function nodeState(node: SkillNode, mastered: Set<string>): NodeState {
  if (mastered.has(node.id)) return 'mastered'
  return node.requires.every((id) => mastered.has(id)) ? 'available' : 'locked'
}

export function missingRequirements(node: SkillNode, mastered: Set<string>): string[] {
  return node.requires.filter((id) => !mastered.has(id))
}

/** Returns every node that depends on `nodeId`, directly or indirectly (inclusive). */
export function collectSubtree(subject: Subject, nodeId: string): string[] {
  const dependents = new Map<string, string[]>()
  for (const node of subject.nodes) {
    for (const req of node.requires) {
      const list = dependents.get(req) ?? []
      list.push(node.id)
      dependents.set(req, list)
    }
  }

  const result = new Set<string>([nodeId])
  const stack = [nodeId]
  while (stack.length) {
    const current = stack.pop() as string
    for (const next of dependents.get(current) ?? []) {
      if (!result.has(next)) {
        result.add(next)
        stack.push(next)
      }
    }
  }
  return [...result]
}

export function dependentsOf(subject: Subject, nodeId: string): SkillNode[] {
  return subject.nodes.filter((node) => node.requires.includes(nodeId))
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

function readStringArray(value: unknown, where: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${where} must be an array of node ids.`)
  }
  return value as string[]
}

export function normalizeData(raw: unknown): TreeData {
  if (!isRecord(raw)) fail('The data file must contain a JSON object.')

  const title = readString(raw.title, 'title')
  const subtitle = readString(raw.subtitle, 'subtitle')
  const version = readInt(raw.version ?? 1, 'version', 1)

  if (!Array.isArray(raw.tiers) || raw.tiers.length === 0) {
    fail('tiers must be a non-empty array.')
  }
  const tiers: Tier[] = raw.tiers.map((entry, index) => {
    if (!isRecord(entry)) fail(`tiers[${index}] must be an object.`)
    return {
      label: readString(entry.label, `tiers[${index}].label`),
      note: readString(entry.note, `tiers[${index}].note`),
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

      const tier = readInt(node.tier, `${where}.${nodeId}.tier`)
      if (tier >= tiers.length) {
        fail(`${where}.${nodeId}: tier ${tier} has no label (tiers has ${tiers.length} entries).`)
      }

      return {
        id: nodeId,
        title: readString(node.title, `${where}.${nodeId}.title`),
        code: readString(node.code, `${where}.${nodeId}.code`),
        branch,
        tier,
        lane: readInt(node.lane, `${where}.${nodeId}.lane`),
        description: readString(node.description, `${where}.${nodeId}.description`),
        tip: typeof node.tip === 'string' ? node.tip : '',
        requires: readStringArray(node.requires, `${where}.${nodeId}.requires`),
      }
    })

    const byId = new Map(nodes.map((node) => [node.id, node]))
    const cells = new Map<string, string>()
    for (const node of nodes) {
      const cell = `${node.tier}:${node.lane}`
      const occupant = cells.get(cell)
      if (occupant) {
        fail(
          `${where}.${node.id} overlaps "${occupant}" at tier ${node.tier}, lane ${node.lane}. ` +
            `Move one node to a free lane.`,
        )
      }
      cells.set(cell, node.id)
    }
    for (const node of nodes) {
      for (const req of node.requires) {
        if (req === node.id) fail(`${where}.${node.id}: a node cannot require itself.`)
        const parent = byId.get(req)
        if (!parent) fail(`${where}.${node.id}: unknown prerequisite "${req}".`)
        if (parent.tier >= node.tier) {
          fail(
            `${where}.${node.id}: prerequisite "${req}" must sit in an earlier tier ` +
              `(${parent.tier} >= ${node.tier}) so the tree always flows left to right.`,
          )
        }
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

  return { version, title, subtitle, tiers, subjects }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

