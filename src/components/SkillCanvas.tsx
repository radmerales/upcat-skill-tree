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

interface DragPreview {
  id: string
  origin: AnchorPoint
  target: AnchorPoint
  occupantId: string | null
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
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const dragPreviewRef = useRef<DragPreview | null>(null)
  const justDraggedRef = useRef(false)

  const positions = positionsBySubject[subject.id] ?? layout.positions

  /* Show the post-drop layout while dragging, including any swap. */
  const previewPositions = useMemo(() => {
    if (!dragPreview) return positions
    const next = { ...positions }
    next[dragPreview.id] = dragPreview.target
    if (dragPreview.occupantId) {
      next[dragPreview.occupantId] = dragPreview.origin
    }
    return next
  }, [positions, dragPreview])

  const paths = useMemo(
    () => routeEdges(layout, previewPositions),
    [layout, previewPositions],
  )

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

      const desiredX = origin.x + dx / scale
      const desiredY = origin.y + dy / scale

      let target = origin
      let closest = Infinity
      for (const anchor of layout.anchors) {
        const distance = (anchor.x - desiredX) ** 2 + (anchor.y - desiredY) ** 2
        if (distance < closest) {
          closest = distance
          target = anchor
        }
      }

      const occupant = Object.entries(positions).find(
        ([id, point]) => id !== node.id && point.u === target.u && point.v === target.v,
      )

      const previous = dragPreviewRef.current
      if (previous && previous.target.u === target.u && previous.target.v === target.v) {
        return
      }

      const preview: DragPreview = {
        id: node.id,
        origin,
        target,
        occupantId: occupant ? occupant[0] : null,
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

      const { target, occupantId } = preview
      if (target.u !== origin.u || target.v !== origin.v) {
        setPositionsBySubject((current) => {
          const base = current[subject.id] ?? layout.positions
          const next = { ...base, [node.id]: target }
          if (occupantId) next[occupantId] = origin
          return { ...current, [subject.id]: next }
        })
      }

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
        />

        {subject.nodes.map((node) => {
          const position = previewPositions[node.id]
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
              dragging={draggingId === node.id}
              swapPreview={dragPreview?.occupantId === node.id}
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
