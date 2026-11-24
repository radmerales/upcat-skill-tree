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

const stages = Array.isArray(raw.stages) ? raw.stages : []
if (stages.length === 0) fail('stages must be a non-empty array.')
stages.forEach((stage, index) => {
  if (!isObject(stage)) return fail(`stages[${index}] must be an object.`)
  if (!isText(stage.label)) fail(`stages[${index}].label must be a non-empty string.`)
  if (!isText(stage.note)) fail(`stages[${index}].note must be a non-empty string.`)
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
    if (node.role !== 'start' && node.role !== 'main' && node.role !== 'sub') {
      fail(`${label}.role must be "start", "main", or "sub".`)
      return
    }
    if (node.role === 'start' && node.stage !== undefined) {
      fail(`${label}: start nodes do not use a stage.`)
    }
    if (node.role !== 'start' && (!isInt(node.stage) || node.stage >= stages.length)) {
      fail(`${label}.stage must be an integer from 0 to ${stages.length - 1}.`)
    }
    for (const legacy of ['tier', 'lane', 'requires']) {
      if (node[legacy] !== undefined) {
        warnings.push(`${where}.${node.id}: "${legacy}" is no longer used by the hex layout.`)
      }
    }
  })

  const startNodes = nodes.filter((node) => node.role === 'start')
  if (startNodes.length !== 1) {
    fail(`${where}: exactly one start node is required (found ${startNodes.length}).`)
  } else if (nodes[0]?.id !== startNodes[0].id) {
    warnings.push(`${where}: put the start node first in the nodes array for readability.`)
  }

  const usedStages = [...new Set(nodes.filter((node) => isInt(node.stage)).map((node) => node.stage))].sort(
    (a, b) => a - b,
  )
  if (usedStages.length === 0) fail(`${where}: no milestone stages found.`)
  usedStages.forEach((stage, index) => {
    if (stage !== index) fail(`${where}: stages must be numbered contiguously from 0 (missing ${index}).`)
  })

  const stageSummary = []
  for (const stage of usedStages) {
    const mains = nodes.filter((node) => node.role === 'main' && node.stage === stage)
    const subs = nodes.filter((node) => node.role === 'sub' && node.stage === stage)
    if (mains.length !== 1) {
      fail(`${where}: stage ${stage} must have exactly one main node (found ${mains.length}).`)
    }
    if (subs.length === 0) fail(`${where}: stage ${stage} needs at least one subskill around its milestone.`)
    if (subs.length > 5) {
      fail(`${where}: stage ${stage} has ${subs.length} subskills; the hex ring supports at most 5.`)
    }
    stageSummary.push(`${subs.length} sub${subs.length === 1 ? '' : 's'}`)
  }

  console.log(
    `  ${subject.name.padEnd(22)} ${String(nodes.length).padStart(2)} nodes · ` +
      `${usedStages.length} stages (${stageSummary.join(' / ')}) · ${branches.length} branches`,
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

console.log(`✓ Hex skill tree valid — ${subjects.length} subjects, ${totalNodes} nodes, ${stages.length} stages.`)
