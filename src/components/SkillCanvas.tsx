import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import RoutedEdges from './canvas/RoutedEdges'
import SkillNodeView from './canvas/SkillNodeView'
import TriangleLattice from './canvas/TriangleLattice'
import ZoomControls from './canvas/ZoomControls'
import { useCanvasCamera } from '../hooks/useCanvasCamera'
import { branchMap, nodeState, routeEdges } from '../lib/tree'
import type { AnchorPoint, SkillNode, Subject, SubjectLayout } from '../types'

interface SkillCanvasProps {
  subject: Subject
  layout: SubjectLayout
  mastered: Set<string>
  selectedId: string | null
  branchFilter: string | null
  onSelect: (nodeId: string) => void
  onToggle: (node: SkillNode) => void
}

const DRAG_THRESHOLD = 4

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

  const [positionsBySubject, setPositionsBySubject] = useState<
    Record<string, Record<string, AnchorPoint>>
  >({})
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(
    null,
  )
  const dragPreviewRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const justDraggedRef = useRef(false)

  const positions = positionsBySubject[subject.id] ?? layout.positions
  const paths = useMemo(() => routeEdges(layout, positions), [layout, positions])

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: SkillNode,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const origin = positions[node.id]
    if (!origin) return

    event.stopPropagation()

    const scale = camera.view.k || 1
    const startX = event.clientX
    const startY = event.clientY
    let moved = false

    setDraggingId(node.id)

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      moved = true

      const preview = {
        id: node.id,
        x: origin.x + dx / scale,
        y: origin.y + dy / scale,
      }
      dragPreviewRef.current = preview
      setDragPreview(preview)
    }

    const finish = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)

      const preview = dragPreviewRef.current
      dragPreviewRef.current = null
      setDragPreview(null)
      setDraggingId(null)

      if (!moved || !preview) return

      let closest = Infinity
      let target = origin
      for (const anchor of layout.anchors) {
        const distance = (anchor.x - preview.x) ** 2 + (anchor.y - preview.y) ** 2
        if (distance < closest) {
          closest = distance
          target = anchor
        }
      }

      const occupant = Object.entries(positions).find(
        ([id, point]) =>
          id !== node.id && point.u === target.u && point.v === target.v,
      )

      setPositionsBySubject((current) => {
        const base = current[subject.id] ?? layout.positions
        const next = { ...base, [node.id]: target }
        if (occupant) next[occupant[0]] = origin
        return { ...current, [subject.id]: next }
      })

      justDraggedRef.current = true
      window.setTimeout(() => {
        justDraggedRef.current = false
      }, 80)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

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
          paths={paths}
          mastered={mastered}
          selectedId={selectedId}
          branchFilter={branchFilter}
          hiddenNodeId={draggingId}
        />

        {subject.nodes.map((node) => {
          const anchor = positions[node.id]
          if (!anchor) return null
          const preview = dragPreview?.id === node.id ? dragPreview : null
          const position = preview ? { x: preview.x, y: preview.y } : anchor
          const branch = branches[node.branch] ?? subject.branches[0]
          return (
            <SkillNodeView
              key={node.id}
              node={node}
              position={position}
              state={nodeState(node, mastered)}
              selected={selectedId === node.id}
              dim={branchFilter !== null && node.branch !== branchFilter}
              dragging={draggingId === node.id}
              color={node.start ? subject.accent : branch.color}
              onClick={() => {
                if (camera.suppressClickRef.current || justDraggedRef.current) return
                onSelect(node.id)
              }}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
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
