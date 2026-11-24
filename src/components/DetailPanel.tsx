import type { CSSProperties } from 'react'
import {
  collectRemoval,
  gateForGroup,
  milestoneProgress,
  nextGroup,
  nodeState,
  stateLabel,
} from '../lib/tree'
import type { SkillNode, Stage, Subject, SubjectStructure } from '../types'
import { Check, Close, Lock } from './Icons'

interface DetailPanelProps {
  subject: Subject
  node: SkillNode
  stages: Stage[]
  structure: SubjectStructure
  mastered: Set<string>
  onClose: () => void
  onSelect: (nodeId: string) => void
  onToggle: (node: SkillNode) => void
}

export default function DetailPanel({
  subject,
  node,
  stages,
  structure,
  mastered,
  onClose,
  onSelect,
  onToggle,
}: DetailPanelProps) {
  const branch = subject.branches.find((entry) => entry.id === node.branch) ?? subject.branches[0]
  const state = nodeState(node, structure, mastered)
  const group = structure.groupByNode.get(node.id) ?? null
  const gate = group ? gateForGroup(structure, group) : null
  const ring = group ? milestoneProgress(group, mastered) : null
  const upcoming = group ? nextGroup(structure, group.stage) : structure.groups[0] ?? null
  const removal = collectRemoval(subject, node, structure, mastered)
  const extraRemovals = removal.filter((id) => id !== node.id && mastered.has(id)).length
  const roleLabel = node.role === 'main' ? 'Milestone' : node.role === 'start' ? 'Start' : 'Subskill'
  const stageLabel = node.stage !== undefined ? stages[node.stage]?.label ?? '' : ''

  const nodeIndex = subject.nodes.findIndex((entry) => entry.id === node.id) + 1
  const percent = ring && ring.total > 0 ? (ring.done / ring.total) * 100 : 0

  const canClaim = state === 'available' || state === 'ready'
  const unlockTarget = node.role === 'sub' && group ? group.main : upcoming?.main ?? null
  const unlockKicker = node.role === 'sub' ? 'Milestone' : 'Next stage'

  return (
    <aside className="panel" aria-label="Node details">
      <div className="panel__head">
        <div className="panel__head-copy">
          <span className="panel__eyebrow">
            {node.role === 'main' ? 'Milestone' : node.role === 'start' ? 'Entry node' : 'Subskill'}{' '}
            {String(nodeIndex).padStart(2, '0')} / {String(subject.nodes.length).padStart(2, '0')}
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
          <span className={`role-chip role-chip--${node.role}`}>{roleLabel}</span>
          {stageLabel && (
            <span className="tier-chip">
              Stage {String((node.stage ?? 0) + 1).padStart(2, '0')} · {stageLabel}
            </span>
          )}
        </div>

        <h2 className="panel__title">{node.title}</h2>

        <div className={`state-pill state-pill--${state}`}>
          {state === 'mastered' && <Check size={12} />}
          {(state === 'locked' || state === 'inprogress') && <Lock size={12} />}
          <span>{stateLabel(state)}</span>
        </div>

        <p className="panel__description">{node.description}</p>

        {node.tip && (
          <div className="tip-card">
            <span className="tip-card__label">Study method</span>
            <p>{node.tip}</p>
          </div>
        )}

        {node.role === 'main' && group && ring && (
          <section className="panel__section">
            <div className="panel__section-head">
              <span>Milestone ring</span>
              <span>
                {ring.done}/{ring.total} subskills
              </span>
            </div>
            <div className="ring-meter" aria-hidden="true">
              <span
                className="ring-meter__fill"
                style={{ width: `${percent}%`, '--ring-color': branch.color } as CSSProperties}
              />
            </div>
            <ul className="link-list">
              {group.subs.map((sub) => {
                const done = mastered.has(sub.id)
                return (
                  <li key={sub.id}>
                    <button type="button" className="link-row" onClick={() => onSelect(sub.id)}>
                      <span className={`link-row__status${done ? ' is-done' : ''}`}>
                        {done ? <Check size={10} /> : <span className="link-row__diamond" />}
                      </span>
                      <span className="link-row__title">{sub.title}</span>
                      <span className="link-row__tier">
                        {done
                          ? 'DONE'
                          : nodeState(sub, structure, mastered) === 'available'
                            ? 'OPEN'
                            : 'LOCK'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {node.role === 'sub' && group && ring && (
          <section className="panel__section">
            <div className="panel__section-head">
              <span>Milestone ring</span>
              <span>
                {ring.done}/{ring.total} subskills
              </span>
            </div>
            <div className="ring-meter" aria-hidden="true">
              <span
                className="ring-meter__fill"
                style={
                  {
                    width: `${percent}%`,
                    '--ring-color':
                      subject.branches.find((entry) => entry.id === group.main.branch)?.color ?? subject.accent,
                  } as CSSProperties
                }
              />
            </div>
            <ul className="link-list">
              <li>
                <button type="button" className="link-row" onClick={() => onSelect(group.main.id)}>
                  <span className={`link-row__status${mastered.has(group.main.id) ? ' is-done' : ''}`}>
                    {mastered.has(group.main.id) ? <Check size={10} /> : <Lock size={10} />}
                  </span>
                  <span className="link-row__title">{group.main.title}</span>
                  <span className="link-row__tier">MAIN</span>
                </button>
              </li>
            </ul>
          </section>
        )}

        {node.role === 'start' && upcoming && (
          <section className="panel__section">
            <div className="panel__section-head">
              <span>Opens the path</span>
              <span>Stage 01</span>
            </div>
            <ul className="link-list">
              <li>
                <button type="button" className="link-row" onClick={() => onSelect(upcoming.main.id)}>
                  <span className="link-row__status is-next">
                    <span className="link-row__diamond" />
                  </span>
                  <span className="link-row__title">{upcoming.main.title}</span>
                  <span className="link-row__tier">MAIN</span>
                </button>
              </li>
            </ul>
          </section>
        )}

        <section className="panel__section">
          <div className="panel__section-head">
            <span>Unlocked by</span>
            <span>{gate ? `Stage ${String((group?.stage ?? 0) + 1).padStart(2, '0')}` : '—'}</span>
          </div>
          {gate && group ? (
            <ul className="link-list">
              <li>
                <button type="button" className="link-row" onClick={() => onSelect(gate.id)}>
                  <span className={`link-row__status${mastered.has(gate.id) ? ' is-done' : ''}`}>
                    {mastered.has(gate.id) ? <Check size={10} /> : <Lock size={10} />}
                  </span>
                  <span className="link-row__title">{gate.title}</span>
                  <span className="link-row__tier">{gate.role === 'start' ? 'START' : 'MAIN'}</span>
                </button>
              </li>
            </ul>
          ) : (
            <p className="panel__empty">This is the entry point. No prior node required.</p>
          )}
        </section>

        {node.role !== 'start' && (
          <section className="panel__section">
            <div className="panel__section-head">
              <span>Unlocks</span>
              <span>{unlockTarget ? unlockKicker : 'Final'}</span>
            </div>
            {unlockTarget ? (
              <ul className="link-list">
                <li>
                  <button type="button" className="link-row" onClick={() => onSelect(unlockTarget.id)}>
                    <span className="link-row__status is-next">
                      <span className="link-row__diamond" />
                    </span>
                    <span className="link-row__title">{unlockTarget.title}</span>
                    <span className="link-row__tier">MAIN</span>
                  </button>
                </li>
              </ul>
            ) : (
              <p className="panel__empty">Clearing this milestone completes the subject path.</p>
            )}
          </section>
        )}

        <p className="panel__hint">
          Subskills surround each milestone on the hex grid. Master every subskill in a ring to claim the
          milestone at its centre, then the next stage unlocks.
        </p>
      </div>

      <div className="panel__foot">
        {canClaim && (
          <button type="button" className="action action--primary" onClick={() => onToggle(node)}>
            <Check size={15} />
            {node.role === 'start'
              ? 'Start this subject'
              : node.role === 'main'
                ? 'Claim milestone'
                : 'Master subskill'}
          </button>
        )}

        {node.role === 'main' && state === 'inprogress' && ring && (
          <>
            <button type="button" className="action action--locked" disabled>
              <Lock size={14} />
              Master all subskills first ({ring.done}/{ring.total})
            </button>
            <span className="panel__foot-note">The ring gates this milestone</span>
          </>
        )}

        {state === 'locked' && gate && (
          <>
            <button type="button" className="action action--locked" disabled>
              <Lock size={14} />
              Clear the previous milestone
            </button>
            <span className="panel__foot-note">{gate.title} must be mastered first</span>
          </>
        )}

        {state === 'mastered' && (
          <button type="button" className="action action--ghost" onClick={() => onToggle(node)}>
            {node.role === 'start' ? 'Unlearn start' : node.role === 'main' ? 'Unlearn milestone' : 'Unlearn subskill'}
            {extraRemovals > 0 && <span className="action__note">clears {extraRemovals} downstream</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
