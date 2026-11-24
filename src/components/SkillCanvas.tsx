import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  branchMap,
  cellPolygon,
  clamp,
  HEX_R,
  HEX_W,
  hexPoints,
  nodeState,
  sharedEdge,
  stateLabel,
} from '../lib/tree'
import type { SkillNode, Subject, SubjectLayout } from '../types'
import { Fit, Minus, Plus } from './Icons'

interface SkillCanvasProps {
  subject: Subject
  layout: SubjectLayout
  mastered: Set<string>
  selectedId: string | null
  branchFilter: string | null
  onSelect: (nodeId: string) => void
  onToggle: (node: SkillNode) => void
}

interface View {
  x: number
  y: number
  k: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

const CELL_H = HEX_R * 2
const FACE = cellPolygon(0.06)
const RING = cellPolygon(0.012)
const INNER = cellPolygon(0.11)

export default function SkillCanvas({
  subject,
  layout,
  mastered,
  selectedId,
  branchFilter,
  onSelect,
  onToggle,
}: SkillCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [panning, setPanning] = useState(false)
  const [fitted, setFitted] = useState(false)

  viewRef.current = view

  const branches = useMemo(() => branchMap(subject), [subject])
  const nodeById = useMemo(() => new Map(subject.nodes.map((node) => [node.id, node])), [subject])

  /* Resize observer ------------------------------------------------------- */
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /* Fit to view ----------------------------------------------------------- */
  const frameAll = useCallback(() => {
    if (!size.width || !size.height) return
    const paddingX = size.width < 720 ? 18 : 34
    const paddingY = size.height < 560 ? 18 : 32
    const k = clamp(
      Math.min(
        (size.width - paddingX * 2) / layout.width,
        (size.height - paddingY * 2) / layout.height,
      ),
      0.22,
      1.2,
    )
    setView({
      k,
      x: (size.width - layout.width * k) / 2,
      y: (size.height - layout.height * k) / 2 + 6,
    })
    setFitted(true)
  }, [layout.height, layout.width, size.height, size.width])

  const frameStart = useCallback(() => {
    if (!size.width || !size.height) return

    if (size.width < 720) {
      const k = 0.68
      const start = layout.positions[subject.nodes.find((node) => node.start)?.id ?? subject.nodes[0].id]
      setView({
        k,
        x: 78 - start.x * k,
        y: Math.max(30, size.height * 0.42 - start.y * k),
      })
      setFitted(true)
      return
    }

    const paddingX = 30
    const paddingY = 26
    const fit = Math.min(
      (size.width - paddingX * 2) / layout.width,
      (size.height - paddingY * 2) / layout.height,
    )
    const k = clamp(fit * 1.04, 0.66, 1.05)
    setView({
      k,
      x: Math.max(24, (size.width - layout.width * k) / 2),
      y: Math.max(8, (size.height - layout.height * k) / 2),
    })
    setFitted(true)
  }, [layout, size.height, size.width, subject.nodes])

  useEffect(() => {
    setFitted(false)
  }, [subject.id])

  useEffect(() => {
    frameStart()
  }, [frameStart, subject.id])

  /* Wheel zoom ------------------------------------------------------------ */
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const current = viewRef.current
      const factor = Math.exp(-event.deltaY * 0.0016)
      const k = clamp(current.k * factor, 0.22, 2.1)
      const ratio = k / current.k
      setView({
        k,
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio,
      })
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  /* Pan ------------------------------------------------------------------- */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.hexnode')) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true
    if (!drag.moved) return
    setView((current) => ({ ...current, x: drag.originX + dx, y: drag.originY + dy }))
  }

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    dragRef.current = null
    setPanning(false)
  }

  const zoomBy = (factor: number) => {
    const current = viewRef.current
    const k = clamp(current.k * factor, 0.22, 2.1)
    const ratio = k / current.k
    const centerX = size.width / 2
    const centerY = size.height / 2
    setView({
      k,
      x: centerX - (centerX - current.x) * ratio,
      y: centerY - (centerY - current.y) * ratio,
    })
  }

  const handleNodeClick = (node: SkillNode) => {
    if (suppressClickRef.current) return
    onSelect(node.id)
  }

  const handleContextMenu = (event: ReactMouseEvent, node: SkillNode) => {
    event.preventDefault()
    if (nodeState(node, mastered) === 'mastered') onToggle(node)
  }

  const edges = useMemo(
    () =>
      subject.nodes.flatMap((node) =>
        node.requires.map((requirementId) => {
          const fromNode = nodeById.get(requirementId)
          if (!fromNode) return null
          const from = layout.positions[fromNode.id]
          const to = layout.positions[node.id]
          if (!from || !to) return null
          return { key: `${requirementId}->${node.id}`, fromNode, toNode: node, from, to, ...sharedEdge(from, to) }
        }),
      ),
    [layout.positions, nodeById, subject.nodes],
  )

  return (
    <div
      className={`canvas${panning ? ' is-panning' : ''}`}
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onClick={() => {
        suppressClickRef.current = false
      }}
    >
      <div
        className="canvas__world"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`,
          opacity: fitted ? 1 : 0,
        }}
      >
        <svg
          className="hex-grid"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          {layout.hexCells.map((cell, index) => (
            <polygon
              key={`hex-${index}`}
              points={hexPoints(cell.x, cell.y)}
              className={`hex-cell${cell.occupied ? ' is-occupied' : ''}`}
            />
          ))}
        </svg>

        <svg
          className="edges"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          {edges.map((edge) => {
            if (!edge) return null
            const state = nodeState(edge.toNode, mastered)
            const edgeState = state === 'mastered' ? 'mastered' : state === 'locked' ? 'locked' : 'available'
            const color = branches[edge.toNode.branch]?.color ?? subject.accent
            const isSelected = selectedId === edge.fromNode.id || selectedId === edge.toNode.id
            const isDim = branchFilter !== null && edge.toNode.branch !== branchFilter
            const classes = [
              'edge',
              'edge--shared',
              `edge--${edgeState}`,
              isSelected ? 'is-selected' : '',
              isDim ? 'is-dim' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <line
                key={edge.key}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                className={classes}
                style={{ stroke: color, '--edge-color': color } as CSSProperties}
              />
            )
          })}
        </svg>

        {subject.nodes.map((node) => {
          const position = layout.positions[node.id]
          if (!position) return null
          const branch = branches[node.branch] ?? subject.branches[0]
          const state = nodeState(node, mastered)
          const isSelected = selectedId === node.id
          const isDim = branchFilter !== null && node.branch !== branchFilter
          const classes = [
            'hexnode',
            `hexnode--${state}`,
            node.start ? 'hexnode--start' : '',
            isSelected ? 'is-selected' : '',
            isDim ? 'is-dim' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={node.id}
              type="button"
              className={classes}
              style={
                {
                  left: position.x,
                  top: position.y,
                  width: HEX_W,
                  height: CELL_H,
                  '--branch': node.start ? subject.accent : branch.color,
                } as CSSProperties
              }
              aria-label={`${node.title} — ${stateLabel(state)}`}
              aria-pressed={state === 'mastered'}
              onClick={() => handleNodeClick(node)}
              onDoubleClick={() => onToggle(node)}
              onContextMenu={(event) => handleContextMenu(event, node)}
            >
              <svg
                className="hexnode__shape"
                viewBox={`0 0 ${HEX_W} ${CELL_H}`}
                aria-hidden="true"
              >
                <polygon points={FACE} className="hexnode__face" />
                <polygon points={INNER} className="hexnode__inner" />
                <polygon points={RING} className={`hexnode__ring${isSelected ? ' is-selected' : ''}`} />
              </svg>
              <span className="hexnode__body">
                {node.start && <span className="hexnode__tag">START</span>}
                <span className={`hexnode__code${node.code.length > 3 ? ' is-long' : ''}`}>{node.code}</span>
                <span className="hexnode__title">{node.title}</span>
              </span>
              {state === 'mastered' && (
                <span className="hexnode__badge" aria-hidden="true">
                  <CheckMark />
                </span>
              )}
              {state === 'locked' && (
                <span className="hexnode__lock" aria-hidden="true">
                  <LockMark />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="zoom-controls">
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in">
          <Plus size={15} />
        </button>
        <span className="zoom-controls__value">{Math.round(view.k * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out">
          <Minus size={15} />
        </button>
        <button type="button" onClick={frameAll} aria-label="Fit tree to screen" title="Fit to screen">
          <Fit size={15} />
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5l5.5 5.5L20 6.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockMark() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
