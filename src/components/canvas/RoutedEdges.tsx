import { useMemo, type CSSProperties } from 'react'
import { branchMap, nodeState } from '../../lib/tree'
import type { RoutedPath, SkillNode, Subject, SubjectLayout } from '../../types'

interface RoutedEdgesProps {
  subject: Subject
  layout: SubjectLayout
  paths: RoutedPath[]
  mastered: Set<string>
  selectedId: string | null
}

export default function RoutedEdges({
  subject,
  layout,
  paths,
  mastered,
  selectedId,
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
      {paths.map((edge) => {
        const target = nodeById.get(edge.to)
        if (!target || edge.points.length < 2) return null

        const state = nodeState(target, mastered)
        const edgeState =
          state === 'mastered' ? 'mastered' : state === 'locked' ? 'locked' : 'available'
        const color = branches[target.branch]?.color ?? subject.accent
        const isSelected = selectedId === edge.from || selectedId === edge.to
        const classes = [
          'edge',
          'edge--route',
          `edge--${edgeState}`,
          isSelected ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const d = edge.points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
          .join(' ')

        return (
          <path
            key={edge.key}
            d={d}
            className={classes}
            style={{ '--edge-color': color } as CSSProperties}
          />
        )
      })}
    </svg>
  )
}
