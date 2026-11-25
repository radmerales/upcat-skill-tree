import { useMemo, type CSSProperties } from 'react'
import { branchMap, nodeState } from '../../lib/tree'
import type { Point, SkillNode, Subject, SubjectLayout } from '../../types'

const ANCHOR = 38

interface RoutedEdgesProps {
  subject: Subject
  layout: SubjectLayout
  positions: Record<string, Point>
  mastered: Set<string>
  selectedId: string | null
  branchFilter: string | null
}

/** Curve from one node's edge to the other's, recomputed on every move. */
export function connectorPath(from: Point, to: Point): string {
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dx) < 28) {
    const dir = dy >= 0 ? 1 : -1
    const sy = from.y + dir * ANCHOR
    const ty = to.y - dir * ANCHOR
    const bend = Math.max(28, Math.abs(ty - sy) * 0.5)
    return `M ${from.x} ${sy} C ${from.x} ${sy + dir * bend}, ${to.x} ${ty - dir * bend}, ${to.x} ${ty}`
  }

  const dir = dx >= 0 ? 1 : -1
  const sx = from.x + dir * ANCHOR
  const tx = to.x - dir * ANCHOR
  const bend = Math.max(32, Math.abs(tx - sx) * 0.5)
  return `M ${sx} ${from.y} C ${sx + dir * bend} ${from.y}, ${tx - dir * bend} ${to.y}, ${tx} ${to.y}`
}

export default function RoutedEdges({
  subject,
  layout,
  positions,
  mastered,
  selectedId,
  branchFilter,
}: RoutedEdgesProps) {
  const branches = useMemo(() => branchMap(subject), [subject])
  const nodeById = useMemo(
    () => new Map<string, SkillNode>(subject.nodes.map((node) => [node.id, node])),
    [subject.nodes],
  )

  return (
    <svg
      className="edges"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
    >
      {layout.edges.map((edge) => {
        const target = nodeById.get(edge.to)
        const from = positions[edge.from]
        const to = positions[edge.to]
        if (!target || !from || !to) return null

        const state = nodeState(target, mastered)
        const edgeState =
          state === 'mastered' ? 'mastered' : state === 'locked' ? 'locked' : 'available'
        const color = branches[target.branch]?.color ?? subject.accent
        const isSelected = selectedId === edge.from || selectedId === edge.to
        const isDim = branchFilter !== null && target.branch !== branchFilter
        const classes = [
          'edge',
          'edge--route',
          `edge--${edgeState}`,
          isSelected ? 'is-selected' : '',
          isDim ? 'is-dim' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <path
            key={edge.key}
            d={connectorPath(from, to)}
            className={classes}
            style={{ '--edge-color': color } as CSSProperties}
          />
        )
      })}
    </svg>
  )
}
