import type {
  AnchorPoint,
  LayoutEdge,
  Point,
  RoutedPath,
  Subject,
  SubjectLayout,
  TriangleCell,
} from '../types'
import { vertexPoint } from './geometry'
import { buildGraph, routeEdge, simplify } from './routing'

const PAD = 84
const NODE_HALF_W = 84
const NODE_TOP = 58
const NODE_BOTTOM = 102

/**
 * Nodes are only allowed on "hex centres" — alternating corners of the
 * triangle mesh, so every neighbouring anchor has at least one corner
 * between it and the next.
 */
export function isAnchorCorner(u: number, v: number): boolean {
  return u % 2 === 0 && v % 2 === 0
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

  const positions: Record<string, AnchorPoint> = {}
  for (const node of subject.nodes) {
    const point = raw.get(node.id) as Point
    positions[node.id] = {
      x: point.x + offsetX,
      y: point.y + offsetY,
      u: node.u,
      v: node.v,
    }
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
      const tl = at(u, v)
      const tr = at(u + 1, v)
      const ml = at(u, v + 1)
      const mr = at(u + 1, v + 1)
      triangles.push({ points: [tl, tr, ml] })
      triangles.push({ points: [tr, mr, ml] })
    }
  }

  /* Hex-centre anchors ---------------------------------------------------- */
  const anchors: AnchorPoint[] = []
  const anchorUStart = Math.ceil(uStart / 2) * 2
  const anchorUEnd = Math.floor(uEnd / 2) * 2
  const anchorVStart = Math.ceil(vStart / 2) * 2
  const anchorVEnd = Math.floor(vEnd / 2) * 2
  for (let v = anchorVStart; v <= anchorVEnd; v += 2) {
    for (let u = anchorUStart; u <= anchorUEnd; u += 2) {
      const point = at(u, v)
      anchors.push({ u, v, x: point.x, y: point.y })
    }
  }

  /* Prerequisite links ----------------------------------------------------- */
  const nodeIds = new Set(subject.nodes.map((node) => node.id))
  const edges: LayoutEdge[] = []

  for (const node of subject.nodes) {
    for (const requirementId of node.requires) {
      if (!nodeIds.has(requirementId)) continue
      edges.push({
        key: `${requirementId}->${node.id}`,
        from: requirementId,
        to: node.id,
      })
    }
  }

  return {
    positions,
    anchors,
    offset: { x: offsetX, y: offsetY },
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
    triangles,
    edges,
  }
}

/* Connectors -------------------------------------------------------------- */

/** Route every prerequisite link along the triangle mesh between its anchors. */
export function routeEdges(
  layout: SubjectLayout,
  positions: Record<string, AnchorPoint>,
): RoutedPath[] {
  const placed = Object.values(positions)
  if (placed.length === 0) return layout.edges.map((edge) => ({ ...edge, points: [] }))

  const us = placed.map((point) => point.u)
  const vs = placed.map((point) => point.v)
  const graph = buildGraph(
    Math.min(...us) - 10,
    Math.max(...us) + 10,
    Math.min(...vs) - 10,
    Math.max(...vs) + 10,
  )

  const toPoint = (u: number, v: number): Point => {
    const point = vertexPoint(u, v)
    return { x: point.x + layout.offset.x, y: point.y + layout.offset.y }
  }

  return layout.edges.map((edge) => {
    const from = positions[edge.from]
    const to = positions[edge.to]
    if (!from || !to) return { ...edge, points: [] }

    const fromKey = `${from.u},${from.v}`
    const toKey = `${to.u},${to.v}`
    const blocked = new Set(
      placed
        .filter((point) => point !== from && point !== to)
        .map((point) => `${point.u},${point.v}`),
    )

    let route = routeEdge(graph, fromKey, toKey, blocked)
    if (!route) route = routeEdge(graph, fromKey, toKey, new Set())
    if (!route) return { ...edge, points: [] }

    const points = simplify(
      route.map(([u, v]) => {
        const point = toPoint(u, v)
        return [point.x, point.y] as [number, number]
      }),
    ).map(([x, y]) => ({ x, y }))

    return { ...edge, points }
  })
}
