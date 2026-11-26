import type {
  Branch,
  ExamQuestion,
  NodeExam,
  NodeType,
  SkillNode,
  Subject,
  SubjectManifest,
  TreeData,
} from '../types'

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
  if (value === 'lesson' || value === 'quiz' || value === 'exam') return value
  fail(`${where} must be "lesson", "quiz", or "exam".`)
}

function readExam(value: unknown, where: string): NodeExam {
  if (!isRecord(value)) fail(`${where} must be an object.`)

  const passScore = readInt(value.passScore, `${where}.passScore`)
  if (passScore < 1 || passScore > 100) {
    fail(`${where}.passScore must be between 1 and 100.`)
  }

  if (!Array.isArray(value.questions) || value.questions.length === 0) {
    fail(`${where}.questions must be a non-empty array.`)
  }

  const questions: ExamQuestion[] = value.questions.map((question, questionIndex) => {
    const questionWhere = `${where}.questions[${questionIndex}]`
    if (!isRecord(question)) fail(`${questionWhere} must be an object.`)

    if (!Array.isArray(question.choices) || question.choices.length < 2) {
      fail(`${questionWhere}.choices must contain at least two options.`)
    }
    const choices = question.choices.map((choice, choiceIndex) =>
      readString(choice, `${questionWhere}.choices[${choiceIndex}]`),
    )

    const answer = readInt(question.answer, `${questionWhere}.answer`)
    if (answer < 0 || answer >= choices.length) {
      fail(`${questionWhere}.answer must point at one of its choices.`)
    }

    return {
      prompt: readString(question.prompt, `${questionWhere}.prompt`),
      choices,
      answer,
      explanation: readString(question.explanation, `${questionWhere}.explanation`),
    }
  })

  return { passScore, questions }
}

/*  Root manifest                                                             */
/* -------------------------------------------------------------------------- */

export function normalizeManifest(raw: unknown): SubjectManifest {
  if (!isRecord(raw)) fail('The data manifest must contain a JSON object.')

  if (!Array.isArray(raw.subjectFiles) || raw.subjectFiles.length === 0) {
    fail('subjectFiles must be a non-empty array of file paths.')
  }

  const subjectFiles = raw.subjectFiles.map((file, index) =>
    readString(file, `subjectFiles[${index}]`),
  )

  return {
    version: readInt(raw.version ?? 6, 'version'),
    title: readString(raw.title, 'title'),
    subtitle: readString(raw.subtitle, 'subtitle'),
    subjectFiles,
  }
}

/*  One subject file                                                          */
/* -------------------------------------------------------------------------- */

export function normalizeSubject(raw: unknown, where = 'subject'): Subject {
  if (!isRecord(raw)) fail(`${where} must be an object.`)

  const id = readString(raw.id, `${where}.id`)

  if (!Array.isArray(raw.branches) || raw.branches.length === 0) {
    fail(`${where}.branches must be a non-empty array.`)
  }
  const seenBranches = new Set<string>()
  const branches: Branch[] = raw.branches.map((branch, branchIndex) => {
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

  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    fail(`${where}.nodes must be a non-empty array.`)
  }

  const seenNodes = new Set<string>()
  const seenVertices = new Map<string, string>()
  const nodes: SkillNode[] = raw.nodes.map((node, nodeIndex) => {
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
    if (u % 2 !== 1 || v % 2 !== 0) {
      fail(
        `${where}.${nodeId}: nodes must sit on a hex corner (odd u, even v), got ${u},${v}.`,
      )
    }
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

    const type = readNodeType(node.type, `${where}.${nodeId}.type`)
    const exam = node.exam === undefined ? undefined : readExam(node.exam, `${where}.${nodeId}.exam`)
    if (type === 'exam' && !exam) {
      fail(`${where}.${nodeId}: exam nodes must define an "exam" object.`)
    }
    if (type !== 'exam' && exam) {
      fail(`${where}.${nodeId}: only "exam" nodes may define an "exam" object.`)
    }

    return {
      id: nodeId,
      title: readString(node.title, `${where}.${nodeId}.title`),
      code: readString(node.code, `${where}.${nodeId}.code`),
      branch,
      type,
      u,
      v,
      start: node.start === true ? true : undefined,
      description: readString(node.description, `${where}.${nodeId}.description`),
      tip: typeof node.tip === 'string' ? node.tip : '',
      requires: readStringArray(node.requires ?? [], `${where}.${nodeId}.requires`),
      exam,
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
      if (node.requires.every((requirementId) => reachable.has(requirementId))) {
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
    name: readString(raw.name, `${where}.name`),
    kicker: readString(raw.kicker, `${where}.kicker`),
    blurb: readString(raw.blurb, `${where}.blurb`),
    accent: readString(raw.accent, `${where}.accent`),
    branches,
    nodes,
  }
}

/*  Manifest + subject files -> app data                                      */
/* -------------------------------------------------------------------------- */

export function assembleTreeData(manifest: SubjectManifest, subjectRaws: unknown[]): TreeData {
  if (subjectRaws.length !== manifest.subjectFiles.length) {
    fail('The number of loaded subject files does not match the manifest.')
  }

  const seenSubjects = new Set<string>()
  const subjects = subjectRaws.map((raw, index) => {
    const subject = normalizeSubject(raw, `subjects[${index}]`)
    if (seenSubjects.has(subject.id)) fail(`Duplicate subject id "${subject.id}".`)
    seenSubjects.add(subject.id)
    return subject
  })

  return {
    version: manifest.version,
    title: manifest.title,
    subtitle: manifest.subtitle,
    subjects,
  }
}
