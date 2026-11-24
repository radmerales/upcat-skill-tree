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
const isInt = (value, min = 0) => Number.isInteger(value) && value >= min

let raw
try {
  raw = JSON.parse(await readFile(DATA_FILE, 'utf8'))
} catch (error) {
  console.error(`✗ Could not read or parse public/data/upcat-skill-tree.json`)
  console.error(`  ${error.message}`)
  process.exit(1)
}

if (!isObject(raw)) {
  console.error('✗ The root of the file must be a JSON object.')
  process.exit(1)
}

if (!isText(raw.title)) fail('title must be a non-empty string.')
if (!isText(raw.subtitle)) fail('subtitle must be a non-empty string.')
if (!Array.isArray(raw.tiers) || raw.tiers.length === 0) {
  fail('tiers must be a non-empty array.')
}
const tiers = Array.isArray(raw.tiers) ? raw.tiers : []
tiers.forEach((tier, index) => {
  if (!isObject(tier)) return fail(`tiers[${index}] must be an object.`)
  if (!isText(tier.label)) fail(`tiers[${index}].label must be a non-empty string.`)
  if (!isText(tier.note)) fail(`tiers[${index}].note must be a non-empty string.`)
})

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
  const cells = new Map()

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
    if (!isInt(node.tier) || node.tier >= tiers.length) {
      fail(`${label}.tier must be an integer from 0 to ${tiers.length - 1}.`)
    }
    if (!isInt(node.lane)) fail(`${label}.lane must be a whole number >= 0.`)

    if (isInt(node.tier) && isInt(node.lane)) {
      const cell = `${node.tier}:${node.lane}`
      if (cells.has(cell)) {
        fail(
          `${label} overlaps ${cells.get(cell)} at tier ${node.tier}, lane ${node.lane}. ` +
            `Move one node to a free lane.`,
        )
      }
      cells.set(cell, label)
    }

    if (node.requires !== undefined) {
      if (!Array.isArray(node.requires) || node.requires.some((id) => !isText(id))) {
        fail(`${label}.requires must be an array of node ids.`)
      }
    }
  })

  nodes.forEach((node) => {
    if (!isObject(node) || !Array.isArray(node.requires)) return
    for (const requirementId of node.requires) {
      if (requirementId === node.id) fail(`${where}.${node.id} requires itself.`)
      const requirement = nodes.find((candidate) => candidate?.id === requirementId)
      if (!requirement) {
        fail(`${where}.${node.id}: unknown prerequisite "${requirementId}".`)
        continue
      }
      if (isInt(node.tier) && isInt(requirement.tier) && requirement.tier >= node.tier) {
        fail(
          `${where}.${node.id}: prerequisite "${requirementId}" is in tier ${requirement.tier}; ` +
            `it must be in an earlier tier than ${node.tier} so the tree flows left to right.`,
        )
      }
    }
  })

  // Reachability check: every node should be masterable from the roots.
  const byId = new Map(nodes.filter(isObject).map((node) => [node.id, node]))
  const reachable = new Set(nodes.filter((node) => (node.requires ?? []).length === 0).map((node) => node.id))
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      if (reachable.has(node.id)) continue
      if ((node.requires ?? []).every((id) => reachable.has(id))) {
        reachable.add(node.id)
        changed = true
      }
    }
  }
  for (const id of byId.keys()) {
    if (!reachable.has(id)) fail(`${where}.${id} can never be unlocked (circular or missing prerequisites).`)
  }

  const tierCount = new Set(nodes.map((node) => node.tier).filter((tier) => isInt(tier))).size
  const maxLane = Math.max(...nodes.map((node) => (isInt(node.lane) ? node.lane : 0)), 0)
  const rootCount = nodes.filter((node) => (node.requires ?? []).length === 0).length
  console.log(
    `  ${subject.name.padEnd(22)} ${String(nodes.length).padStart(2)} nodes · ` +
      `${branches.length} branches · ${tierCount} tiers · ${maxLane + 1} lanes · ${rootCount} roots`,
  )

  if (rootCount === 0) warnings.push(`${where}: no root nodes — every node has a prerequisite.`)
  if (!tiers.every((_, index) => nodes.some((node) => node.tier === index))) {
    warnings.push(`${where}: at least one tier column is empty.`)
  }
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

console.log(`✓ Skill tree valid — ${subjects.length} subjects, ${totalNodes} nodes, ${tiers.length} tiers.`)
