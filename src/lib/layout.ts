import type { LayoutEdge, Point, Subject, SubjectLayout, TriangleCell } from '../types'
import { vertexPoint } from './geometry'

const PAD = 84
const NODE_HALF_W = 84
const NODE_TOP = 58
const NODE_BOTTOM = 102


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
      const tl = at(u, v)
      const tr = at(u + 1, v)
      const ml = at(u, v + 1)
      const mr = at(u + 1, v + 1)
      triangles.push({ points: [tl, tr, ml] })
      triangles.push({ points: [tr, mr, ml] })
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
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
    triangles,
    edges,
  }
}

/* -------------------------------------------------------------------------- */
