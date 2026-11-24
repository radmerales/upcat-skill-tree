#!/usr/bin/env node
/**
 * Validates public/data/upcat-skill-tree.json before shipping.
 * Run with: npm run validate
 */
import { readFile } from 'node:fs/promises'

const DATA_FILE = new URL('../public/data/upcat-skill-tree.json', import.meta.url)
const errors = []
const warnings = []

const fail = (message) => errors.push(message)
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value) => typeof value === 'string' && value.trim().length > 0
const isInt = (value) => Number.isInteger(value)

let raw
try {
  raw = JSON.parse(await readFile(DATA_FILE, 'utf8'))
} catch (error) {
  console.error('✗ Could not read or parse public/data/upcat-skill-tree.json')
  console.error(`  ${error.message}`)
  process.exit(1)
}

if (!isObject(raw)) {
  console.error('✗ The root of the file must be a JSON object.')
  process.exit(1)
}

if (!isText(raw.title)) fail('title must be a non-empty string.')
if (!isText(raw.subtitle)) fail('subtitle must be a non-empty string.')
for (const legacy of ['stages', 'tiers']) {
  if (raw[legacy] !== undefined) warnings.push(`"${legacy}" is no longer used.`)
}

const subjects = Array.isArray(raw.subjects) ? raw.subjects : []
if (subjects.length === 0) fail('subjects must be a non-empty array.')

const seenSubjects = new Set()
let totalNodes = 0

subjects.forEach((subject, subjectIndex) => {
  const where = `subjects[${subjectIndex}]`
  if (!isObject(subject)) return fail(`${where} must be an object.`)

  if (!isText(subject.id)) return fail(`${where}.id must be a non-empty string.`)
  if (seenSubjects.has(subject.id)) fail(`Duplicate subject id "${subject.id}".`)
  seenSubjects.add(subject.id)

  for (const field of ['name', 'kicker', 'blurb', 'accent']) {
    if (!isText(subject[field])) fail(`${where}.${field} must be a non-empty string.`)
  }

  const branches = Array.isArray(subject.branches) ? subject.branches : []
  if (branches.length === 0) fail(`${where}.branches must be a non-empty array.`)
  const branchIds = new Set()
  branches.forEach((branch, branchIndex) => {
    const branchWhere = `${where}.branches[${branchIndex}]`
    if (!isObject(branch)) return fail(`${branchWhere} must be an object.`)
    if (!isText(branch.id)) return fail(`${branchWhere}.id must be a non-empty string.`)
    if (branchIds.has(branch.id)) fail(`${where}: duplicate branch id "${branch.id}".`)
    branchIds.add(branch.id)
    if (!isText(branch.name)) fail(`${branchWhere}.name must be a non-empty string.`)
    if (!isText(branch.color)) fail(`${branchWhere}.color must be a non-empty string.`)
  })

  const nodes = Array.isArray(subject.nodes) ? subject.nodes : []
  if (nodes.length === 0) fail(`${where}.nodes must be a non-empty array.`)
  totalNodes += nodes.length

  const nodeIds = new Set()
  const corners = new Map()

  nodes.forEach((node, nodeIndex) => {
    if (!isObject(node)) return fail(`${where}.nodes[${nodeIndex}] must be an object.`)
    const label = `${where}.${node.id ?? `nodes[${nodeIndex}]`}`

    if (!isText(node.id)) return fail(`${label}.id must be a non-empty string.`)
    if (nodeIds.has(node.id)) fail(`${where}: duplicate node id "${node.id}".`)
    nodeIds.add(node.id)

    for (const field of ['title', 'code', 'description']) {
      if (!isText(node[field])) fail(`${label}.${field} must be a non-empty string.`)
    }
    if (node.tip !== undefined && typeof node.tip !== 'string') {
      fail(`${label}.tip must be a string when provided.`)
    }
    if (!isText(node.branch) || !branchIds.has(node.branch)) {
      fail(`${label}.branch must reference a declared branch (got ${JSON.stringify(node.branch)}).`)
    }
    if (!isInt(node.u)) fail(`${label}.u must be a whole number.`)
    if (!isInt(node.v)) fail(`${label}.v must be a whole number.`)
    if (node.start !== undefined && typeof node.start !== 'boolean') {
      fail(`${label}.start must be true when present.`)
    }
    if (!Array.isArray(node.requires) || node.requires.some((id) => !isText(id))) {
      fail(`${label}.requires must be an array of node ids.`)
      return
    }
    for (const legacy of ['role', 'stage', 'tier', 'lane', 'q', 'r']) {
      if (node[legacy] !== undefined) warnings.push(`${where}.${node.id}: "${legacy}" is no longer used.`)
    }

    if (isInt(node.u) && isInt(node.v)) {
      const corner = `${node.u}:${node.v}`
      if (corners.has(corner)) fail(`${label} shares corner ${corner} with "${corners.get(corner)}".`)
      corners.set(corner, node.id)
    }
  })

  const byId = new Map(nodes.filter(isObject).map((node) => [node.id, node]))
  const starts = nodes.filter((node) => node.start === true)
  if (starts.length !== 1) {
    fail(`${where}: exactly one node must have "start": true (found ${starts.length}).`)
    return
  }
  const start = starts[0]
  if (Array.isArray(start.requires) && start.requires.length > 0) {
    fail(`${where}.${start.id}: the start node must not require anything.`)
  }

  nodes.forEach((node) => {
    if (!isObject(node) || !Array.isArray(node.requires)) return
    if (!node.start && node.requires.length === 0) {
      fail(`${where}.${node.id}: every non-start node needs at least one prerequisite.`)
    }
    for (const requirementId of node.requires) {
      if (requirementId === node.id) fail(`${where}.${node.id} requires itself.`)
      if (!byId.has(requirementId)) fail(`${where}.${node.id}: unknown prerequisite "${requirementId}".`)
    }
  })

  const reachable = new Set([start.id])
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      if (!isObject(node) || reachable.has(node.id)) continue
      const requires = Array.isArray(node.requires) ? node.requires : []
      if (requires.every((id) => reachable.has(id))) {
        reachable.add(node.id)
        changed = true
      }
    }
  }
  for (const id of byId.keys()) {
    if (!reachable.has(id)) fail(`${where}.${id} can never unlock (cycle or orphaned requirement chain).`)
  }

  const us = nodes.filter(isObject).map((node) => node.u)
  const vs = nodes.filter(isObject).map((node) => node.v)
  const links = nodes.reduce((sum, node) => sum + (Array.isArray(node.requires) ? node.requires.length : 0), 0)
  console.log(
    `  ${subject.name.padEnd(22)} ${String(nodes.length).padStart(2)} corners · ` +
      `u ${Math.min(...us)}..${Math.max(...us)} · v ${Math.min(...vs)}..${Math.max(...vs)} · ${links} routed links`,
  )
})

console.log('')
if (warnings.length) {
  console.log('Warnings')
  for (const warning of warnings) console.log(`  ⚠ ${warning}`)
  console.log('')
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} found`)
  for (const error of errors) console.error(`  • ${error}`)
  process.exit(1)
}

console.log(`✓ Triangle flowchart valid — ${subjects.length} subjects, ${totalNodes} corner nodes.`)
