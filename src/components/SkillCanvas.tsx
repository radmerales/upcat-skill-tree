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
  clamp,
  hexPoints,
  nodeState,
  stateLabel,
} from '../lib/tree'
import type { SkillNode, Stage, Subject, SubjectLayout, SubjectStructure } from '../types'
import { Fit, Minus, Plus } from './Icons'

interface SkillCanvasProps {
  subject: Subject
  stages: Stage[]
  structure: SubjectStructure
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

export default function SkillCanvas({
  subject,
  stages,
  structure,
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
    const paddingX = size.width < 720 ? 22 : 34
    const paddingY = size.height < 560 ? 22 : 32
    const k = clamp(
      Math.min(
        (size.width - paddingX * 2) / layout.width,
        (size.height - paddingY * 2) / layout.height,
      ),
      0.25,
      1.05,
    )
    setView({
      k,
      x: (size.width - layout.width * k) / 2,
      y: (size.height - layout.height * k) / 2 + 6,
    })
    setFitted(true)
  }, [layout.height, layout.width, size.height, size.width])

  /* Opening view: focused on phones, whole map on desktop. */
  const frameStart = useCallback(() => {
    if (!size.width || !size.height) return

    if (size.width < 720) {
      const k = 0.68
      const start = layout.positions[structure.start.id]
      setView({
        k,
        x: 48 - start.x * k,
        y: Math.max(14, size.height * 0.42 - start.y * k),
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
    const k = clamp(fit * 1.05, 0.5, 1.0)
    setView({
      k,
      x: (size.width - layout.width * k) / 2,
      y: Math.max(8, (size.height - layout.height * k) / 2),
    })
    setFitted(true)
  }, [layout, size.height, size.width, structure.start.id])

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
      const k = clamp(current.k * factor, 0.28, 1.9)
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
    if ((event.target as HTMLElement).closest('.node')) return
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
    const k = clamp(current.k * factor, 0.28, 1.9)
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
    if (nodeState(node, structure, mastered) === 'mastered') onToggle(node)
  }

  const edges = useMemo(() => {
    const list: Array<{ key: string; from: SkillNode; to: SkillNode }> = []
    structure.groups.forEach((group, index) => {
      const gate = index === 0 ? structure.start : structure.groups[index - 1].main
      list.push({ key: `spine-${group.stage}`, from: gate, to: group.main })
      for (const sub of group.subs) list.push({ key: `ring-${sub.id}`, from: group.main, to: sub })
    })
    return list
  }, [structure])

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

        {structure.groups.map((group) => {
          const header = layout.stageHeaders.find((entry) => entry.stage === group.stage)
          const meta = stages[group.stage]
          if (!header || !meta) return null
          return (
            <div
              key={`stage-${group.stage}`}
              className="stage-head"
              style={{ left: header.x, top: header.y }}
            >
              <span className="stage-head__index">
                STAGE {String(group.stage + 1).padStart(2, '0')}
              </span>
              <span className="stage-head__label">{meta.label}</span>
              <span className="stage-head__note">{meta.note}</span>
            </div>
          )
        })}

        <svg
          className="edges"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          aria-hidden="true"
        >
          {edges.map((edge) => {
            const from = layout.positions[edge.from.id]
            const to = layout.positions[edge.to.id]
            if (!from || !to) return null

            const state = nodeState(edge.to, structure, mastered)
            const edgeState = state === 'mastered' ? 'mastered' : state === 'locked' ? 'locked' : 'available'
            const color = branches[edge.to.branch]?.color ?? subject.accent
            const isSelected = selectedId === edge.from.id || selectedId === edge.to.id
            const isDim = branchFilter !== null && edge.to.branch !== branchFilter
            const classes = [
              'edge',
              `edge--${edgeState}`,
              `edge--${edge.from.role}-to-${edge.to.role}`,
              isSelected ? 'is-selected' : '',
              isDim ? 'is-dim' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <line
                key={edge.key}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
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
          const state = nodeState(node, structure, mastered)
          const group = structure.groupByNode.get(node.id)
          const isSelected = selectedId === node.id
          const isDim = branchFilter !== null && node.branch !== branchFilter
          const classes = [
            'node',
            `node--${state}`,
            `node--role-${node.role}`,
            isSelected ? 'is-selected' : '',
            isDim ? 'is-dim' : '',
          ]
            .filter(Boolean)
            .join(' ')

          const label =
            node.role === 'main' && group
              ? `${node.title} — ${stateLabel(state)}, ${group.subs.filter((sub) => mastered.has(sub.id)).length} of ${group.subs.length} subskills`
              : `${node.title} — ${stateLabel(state)}`

          return (
            <button
              key={node.id}
              type="button"
              className={classes}
              style={
                {
                  left: position.x,
                  top: position.y,
                  '--branch': node.role === 'start' ? subject.accent : branch.color,
                } as CSSProperties
              }
              aria-label={label}
              aria-pressed={state === 'mastered'}
              onClick={() => handleNodeClick(node)}
              onDoubleClick={() => onToggle(node)}
              onContextMenu={(event) => handleContextMenu(event, node)}
            >
              <span className="node__selection" aria-hidden="true" />
              {node.role === 'start' && <span className="node__tag">START</span>}
              <span className="node__diamond">
                <span className="node__inner" aria-hidden="true" />
                <span className={`node__code${node.code.length > 3 ? ' is-long' : ''}`}>{node.code}</span>
              </span>
              {state === 'mastered' && (
                <span className="node__badge node__badge--check" aria-hidden="true">
                  <CheckMark />
                </span>
              )}
              {state === 'locked' && (
                <span className="node__badge node__badge--lock" aria-hidden="true">
                  <LockMark />
                </span>
              )}
              {node.role === 'main' && group && (
                <span className={`node__pips${state === 'mastered' ? ' is-complete' : ''}`} aria-hidden="true">
                  {group.subs.map((sub) => (
                    <span key={sub.id} className={mastered.has(sub.id) ? 'is-filled' : ''} />
                  ))}
                </span>
              )}
              <span className="node__label">{node.title}</span>
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
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
