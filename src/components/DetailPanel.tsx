import type { CSSProperties } from 'react'
import { collectSubtree, dependentsOf, missingRequirements, nodeState } from '../lib/tree'
import type { SkillNode, Subject, Tier } from '../types'
import { Check, Close, Lock } from './Icons'

interface DetailPanelProps {
  subject: Subject
  node: SkillNode
  tiers: Tier[]
  mastered: Set<string>
  onClose: () => void
  onSelect: (nodeId: string) => void
  onToggle: (node: SkillNode) => void
}

export default function DetailPanel({
  subject,
  node,
  tiers,
  mastered,
  onClose,
  onSelect,
  onToggle,
}: DetailPanelProps) {
  const branch = subject.branches.find((entry) => entry.id === node.branch) ?? subject.branches[0]
  const state = nodeState(node, mastered)
  const missing = missingRequirements(node, mastered)
  const unlocks = dependentsOf(subject, node.id)
  const subtree = collectSubtree(subject, node.id)
  const extraRemovals = subtree.length - 1
  const nodeIndex = subject.nodes.findIndex((entry) => entry.id === node.id) + 1

  return (
    <aside className="panel" aria-label="Skill details">
      <div className="panel__head">
        <div className="panel__head-copy">
          <span className="panel__eyebrow">
            Node {String(nodeIndex).padStart(2, '0')} / {String(subject.nodes.length).padStart(2, '0')}
          </span>
          <span className="panel__head-subject">{subject.name}</span>
        </div>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Close details">
          <Close size={16} />
        </button>
      </div>

      <div className="panel__scroll">
        <div className="panel__meta">
          <span
            className="branch-chip"
            style={{ '--chip-color': branch.color } as CSSProperties}
          >
            <span className="branch-chip__dot" />
            {branch.name}
          </span>
          <span className="tier-chip">Tier {node.tier + 1} · {tiers[node.tier]?.label ?? 'Skill'}</span>
        </div>

        <h2 className="panel__title">{node.title}</h2>

        <div className={`state-pill state-pill--${state}`}>
          {state === 'mastered' && <Check size={12} />}
          {state === 'locked' && <Lock size={12} />}
          <span>
            {state === 'mastered' ? 'Mastered' : state === 'available' ? 'Ready to learn' : 'Locked'}
          </span>
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
            <span>Prerequisites</span>
            <span>{node.requires.length || '—'}</span>
          </div>
          {node.requires.length === 0 ? (
            <p className="panel__empty">No prerequisites. This is a starting node.</p>
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
                      <span className="link-row__tier">T{requirement.tier + 1}</span>
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
            <span>{unlocks.length || '—'}</span>
          </div>
          {unlocks.length === 0 ? (
            <p className="panel__empty">End of this branch — nothing depends on it.</p>
          ) : (
            <ul className="link-list">
              {unlocks.map((unlock) => (
                <li key={unlock.id}>
                  <button type="button" className="link-row" onClick={() => onSelect(unlock.id)}>
                    <span className="link-row__status is-next">
                      <span className="link-row__diamond" />
                    </span>
                    <span className="link-row__title">{unlock.title}</span>
                    <span className="link-row__tier">T{unlock.tier + 1}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="panel__hint">
          Double-click a node to learn it. Right-click a mastered node to remove it and everything it unlocks.
        </p>
      </div>

      <div className="panel__foot">
        {state === 'available' && (
          <button type="button" className="action action--primary" onClick={() => onToggle(node)}>
            <Check size={15} />
            Mark as mastered
          </button>
        )}
        {state === 'mastered' && (
          <button type="button" className="action action--ghost" onClick={() => onToggle(node)}>
            Unlearn skill
            {extraRemovals > 0 && <span className="action__note">clears {extraRemovals} downstream</span>}
          </button>
        )}
        {state === 'locked' && (
          <>
            <button type="button" className="action action--locked" disabled>
              <Lock size={14} />
              Complete prerequisites first
            </button>
            <span className="panel__foot-note">
              {missing.length} prerequisite{missing.length === 1 ? '' : 's'} remaining
            </span>
          </>
        )}
      </div>
    </aside>
  )
}
