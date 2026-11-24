import { useMemo } from 'react'
import RoutedEdges from './canvas/RoutedEdges'
import SkillNodeView from './canvas/SkillNodeView'
import TriangleLattice from './canvas/TriangleLattice'
import ZoomControls from './canvas/ZoomControls'
import { useCanvasCamera } from '../hooks/useCanvasCamera'
import { branchMap, nodeState } from '../lib/tree'
import type { SkillNode, Subject, SubjectLayout } from '../types'

interface SkillCanvasProps {
  subject: Subject
  layout: SubjectLayout
  mastered: Set<string>
  selectedId: string | null
  branchFilter: string | null
  onSelect: (nodeId: string) => void
  onToggle: (node: SkillNode) => void
}

export default function SkillCanvas({
  subject,
  layout,
  mastered,
  selectedId,
  branchFilter,
  onSelect,
  onToggle,
}: SkillCanvasProps) {
  const branches = useMemo(() => branchMap(subject), [subject])
  const startNode = subject.nodes.find((node) => node.start) ?? subject.nodes[0]
  const camera = useCanvasCamera({
    width: layout.width,
    height: layout.height,
    start: layout.positions[startNode.id],
    subjectId: subject.id,
  })

  return (
    <div
      className={`canvas${camera.panning ? ' is-panning' : ''}`}
      ref={camera.viewportRef}
      onPointerDown={camera.onPointerDown}
      onPointerMove={camera.onPointerMove}
      onPointerUp={camera.onPointerUp}
      onPointerCancel={camera.onPointerCancel}
      onClick={camera.clearSuppressClick}
    >
      <div
        className="canvas__world"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate3d(${camera.view.x}px, ${camera.view.y}px, 0) scale(${camera.view.k})`,
          opacity: camera.fitted ? 1 : 0,
        }}
      >
        <TriangleLattice layout={layout} />
        <RoutedEdges
          subject={subject}
          layout={layout}
          mastered={mastered}
          selectedId={selectedId}
          branchFilter={branchFilter}
        />

        {subject.nodes.map((node) => {
          const position = layout.positions[node.id]
          if (!position) return null
          const branch = branches[node.branch] ?? subject.branches[0]
          return (
            <SkillNodeView
              key={node.id}
              node={node}
              position={position}
              state={nodeState(node, mastered)}
              selected={selectedId === node.id}
              dim={branchFilter !== null && node.branch !== branchFilter}
              color={node.start ? subject.accent : branch.color}
              onClick={() => {
                if (!camera.suppressClickRef.current) onSelect(node.id)
              }}
              onToggle={onToggle}
            />
          )
        })}
      </div>

      <ZoomControls
        zoom={camera.view.k}
        onZoomIn={camera.zoomIn}
        onZoomOut={camera.zoomOut}
        onFit={camera.frameAll}
      />
    </div>
  )
}
