import type { Branch, NodeType, SkillNode, Subject, TreeData } from '../types'

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

function readNodeType(value: unknown, where: string): NodeType {
  if (value === undefined) return 'lesson'
  if (value === 'lesson' || value === 'quiz') return value
  fail(`${where} must be "lesson" or "quiz".`)
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
        type: readNodeType(node.type, `${where}.${nodeId}.type`),
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
