import type { CSSProperties } from 'react'
import {
  collectSubtree,
  dependentsOf,
  missingRequirements,
  nodeState,
  stateLabel,
} from '../lib/tree'
import type { SkillNode, Subject } from '../types'
import { Check, Close, Lock } from './Icons'

interface DetailPanelProps {
  subject: Subject
  node: SkillNode
  mastered: Set<string>
  onClose: () => void
  onSelect: (nodeId: string) => void
  onToggle: (node: SkillNode) => void
}

export default function DetailPanel({
  subject,
  node,
  mastered,
  onClose,
  onSelect,
  onToggle,
}: DetailPanelProps) {
  const branch = subject.branches.find((entry) => entry.id === node.branch) ?? subject.branches[0]
  const state = nodeState(node, mastered)
  const missing = missingRequirements(node, mastered)
  const unlocked = dependentsOf(subject, node.id)
  const subtree = collectSubtree(subject, node.id)
  const extraRemovals = subtree.filter((id) => id !== node.id && mastered.has(id)).length
  const nodeIndex = subject.nodes.findIndex((entry) => entry.id === node.id) + 1

  return (
    <aside className="panel" aria-label="Node details">
      <div className="panel__head">
        <div className="panel__head-copy">
          <span className="panel__eyebrow">
            {node.start ? 'Entry node' : 'Skill node'} {String(nodeIndex).padStart(2, '0')} /{' '}
            {String(subject.nodes.length).padStart(2, '0')}
          </span>
          <span className="panel__head-subject">{subject.name}</span>
        </div>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Close details">
          <Close size={16} />
        </button>
      </div>

      <div className="panel__scroll">
        <div className="panel__meta">
          <span className="branch-chip" style={{ '--chip-color': branch.color } as CSSProperties}>
            <span className="branch-chip__dot" />
            {branch.name}
          </span>
          {node.start && <span className="role-chip role-chip--start">Start</span>}
          <span className="tier-chip">Corner {node.u},{node.v}</span>
        </div>

        <h2 className="panel__title">{node.title}</h2>

        <div className={`state-pill state-pill--${state}`}>
          {state === 'mastered' && <Check size={12} />}
          {state === 'locked' && <Lock size={12} />}
          <span>{stateLabel(state)}</span>
        </div>

        <p className="panel__description">{node.description}</p>

        {node.tip && (
          <div className="tip-card">
            <span className="tip-card__label">Study method</span>
            <p>{node.tip}</p>
          </div>
        )}

        <section className="panel__section">
          <div className="panel__section-head">
            <span>Connected prerequisites</span>
            <span>{node.requires.length || '—'}</span>
          </div>
          {node.requires.length === 0 ? (
            <p className="panel__empty">Entry point. No prerequisite nodes.</p>
          ) : (
            <ul className="link-list">
              {node.requires.map((requirementId) => {
                const requirement = subject.nodes.find((entry) => entry.id === requirementId)
                if (!requirement) return null
                const done = mastered.has(requirementId)
                return (
                  <li key={requirementId}>
                    <button type="button" className="link-row" onClick={() => onSelect(requirementId)}>
                      <span className={`link-row__status${done ? ' is-done' : ''}`}>
                        {done ? <Check size={10} /> : <Lock size={10} />}
                      </span>
                      <span className="link-row__title">{requirement.title}</span>
                      <span className="link-row__tier">{done ? 'DONE' : 'OPEN'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="panel__section">
          <div className="panel__section-head">
            <span>Unlocks</span>
            <span>{unlocked.length || '—'}</span>
          </div>
          {unlocked.length === 0 ? (
            <p className="panel__empty">End of this path. Nothing is linked downstream.</p>
          ) : (
            <ul className="link-list">
              {unlocked.map((next) => (
                <li key={next.id}>
                  <button type="button" className="link-row" onClick={() => onSelect(next.id)}>
                    <span className={`link-row__status${mastered.has(next.id) ? ' is-done' : ' is-next'}`}>
                      {mastered.has(next.id) ? <Check size={10} /> : <span className="link-row__diamond" />}
                    </span>
                    <span className="link-row__title">{next.title}</span>
                    <span className="link-row__tier">{mastered.has(next.id) ? 'DONE' : 'NEXT'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="panel__hint">
          Prerequisite lines are routed along the triangle edges. Master connected nodes to open the
          next skills, and follow the mesh to the final capstone.
        </p>
      </div>

      <div className="panel__foot">
        {state === 'available' && (
          <button type="button" className="action action--primary" onClick={() => onToggle(node)}>
            <Check size={15} />
            {node.start ? 'Start this subject' : 'Master node'}
          </button>
        )}

        {state === 'locked' && (
          <>
            <button type="button" className="action action--locked" disabled>
              <Lock size={14} />
              Master prerequisites first
            </button>
            <span className="panel__foot-note">
              {missing.length} prerequisite{missing.length === 1 ? '' : 's'} remaining
            </span>
          </>
        )}

        {state === 'mastered' && (
          <button type="button" className="action action--ghost" onClick={() => onToggle(node)}>
            Unlearn node
            {extraRemovals > 0 && <span className="action__note">clears {extraRemovals} downstream</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
