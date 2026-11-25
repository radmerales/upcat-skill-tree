import type { CSSProperties } from 'react'
import { stateLabel } from '../../lib/tree'
import type { NodeState, Point, SkillNode } from '../../types'

const NODE_W = 69
const NODE_H = 69
const PLATE = '50,5 95,50 50,95 5,50'
const PLATE_INNER = '50,17 83,50 50,83 17,50'
const PLATE_RING = '50,1 99,50 50,99 1,50'

interface SkillNodeViewProps {
  node: SkillNode
  position: Point
  state: NodeState
  selected: boolean
  dim: boolean
  color: string
  onClick: () => void
  onToggle: (node: SkillNode) => void
}

export default function SkillNodeView({
  node,
  position,
  state,
  selected,
  dim,
  color,
  onClick,
  onToggle,
}: SkillNodeViewProps) {
  const classes = [
    'vnode',
    `vnode--${state}`,
    `vnode--${node.type}`,
    node.start ? 'vnode--start' : '',
    selected ? 'is-selected' : '',
    dim ? 'is-dim' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      style={
        {
          left: position.x,
          top: position.y,
          width: NODE_W,
          height: NODE_H,
          '--branch': color,
        } as CSSProperties
      }
      aria-label={`${node.title} — ${node.type} — ${stateLabel(state)}`}
      aria-pressed={state === 'mastered'}
      onClick={onClick}
      onDoubleClick={() => onToggle(node)}
      onContextMenu={(event) => {
        event.preventDefault()
        if (state === 'mastered') onToggle(node)
      }}
    >
      <span className="vnode__shape" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {node.type === 'quiz' ? (
            <>
              <polygon points={PLATE} className="vnode__face" />
              <polygon points={PLATE_INNER} className="vnode__inner" />
              <polygon points={PLATE_RING} className={`vnode__ring${selected ? ' is-selected' : ''}`} />
            </>
          ) : (
            <>
              <circle cx="50" cy="50" r="45" className="vnode__face" />
              <circle cx="50" cy="50" r="32" className="vnode__inner" />
              <circle cx="50" cy="50" r="49" className={`vnode__ring${selected ? ' is-selected' : ''}`} />
            </>
          )}
        </svg>
      </span>
      <span className="vnode__body">
        {node.start && <span className="vnode__tag">Start</span>}
        <span className={`vnode__code${node.code.length > 3 ? ' is-long' : ''}`}>{node.code}</span>
      </span>
      {state === 'mastered' && (
        <span className="vnode__badge" aria-hidden="true">
          <CheckMark />
        </span>
      )}
      {state === 'locked' && (
        <span className="vnode__lock" aria-hidden="true">
          <LockMark />
        </span>
      )}
      <span className="vnode__title">{node.title}</span>
    </button>
  )
}

function CheckMark() {
  return (
    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12.5l5.5 5.5L20 6.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockMark() {
  return (
    <svg width="6" height="6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M8 10.5V7.5a4 4 0 018 0v3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
