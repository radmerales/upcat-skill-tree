import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ProgressMap } from '../lib/storage'
import type { Subject, TreeData } from '../types'
import { Check, ChevronDown, Reset, Share } from './Icons'

interface HeaderProps {
  data: TreeData
  subject: Subject
  progress: ProgressMap
  onSelectSubject: (subjectId: string) => void
  onShare: () => void
  onReset: () => void
}

function masteredCount(subject: Subject, progress: ProgressMap): number {
  const ids = new Set(progress[subject.id] ?? [])
  return subject.nodes.filter((node) => ids.has(node.id)).length
}

export default function Header({ data, subject, progress, onSelectSubject, onShare, onReset }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => setOpen(false), [subject.id])

  const done = masteredCount(subject, progress)
  const total = subject.nodes.length
  const percent = total ? Math.round((done / total) * 100) : 0
  const circumference = 2 * Math.PI * 15

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <span className="brand__mark-core" />
        </span>
        <div className="brand__text">
          <div className="brand__title">UPCAT Skill Tree</div>
          <div className="brand__sub">Study path builder</div>
        </div>
      </div>

      <div className="subject-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`subject-switch${open ? ' is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="subject-switch__badge">
            <span>{subject.kicker.replace(/\D/g, '')}</span>
          </span>
          <span className="subject-switch__copy">
            <span className="subject-switch__kicker">Now studying</span>
            <span className="subject-switch__name">{subject.name}</span>
          </span>
          <span className="subject-switch__count">
            {done}
            <span>/{total}</span>
          </span>
          <ChevronDown className="subject-switch__chevron" size={14} />
        </button>

        {open && (
          <div className="subject-menu" role="listbox" aria-label="Choose a subject">
            <div className="subject-menu__head">
              <span>Subject</span>
              <span>{data.subjects.length} subtests</span>
            </div>
            <p className="subject-menu__blurb">{subject.blurb}</p>
            <div className="subject-list">
              {data.subjects.map((entry) => {
                const entryDone = masteredCount(entry, progress)
                const active = entry.id === subject.id
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`subject-option${active ? ' is-active' : ''}`}
                    style={{ '--option-accent': entry.accent } as CSSProperties}
                    onClick={() => {
                      onSelectSubject(entry.id)
                      setOpen(false)
                    }}
                  >
                    <span className="subject-option__dot" />
                    <span className="subject-option__copy">
                      <span className="subject-option__kicker">{entry.kicker}</span>
                      <span className="subject-option__name">{entry.name}</span>
                    </span>
                    <span className="subject-option__count">
                      {entryDone}/{entry.nodes.length}
                    </span>
                    {active && (
                      <span className="subject-option__check">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="subject-menu__foot">Switch subjects any time — mastery and exam scores are saved per subject.</div>
          </div>
        )}
      </div>

      <div className="topbar__actions">
        <div className="progress" title={`${done} of ${total} skills mastered`}>
          <svg viewBox="0 0 36 36" className="progress__ring" aria-hidden="true">
            <circle cx="18" cy="18" r="15" className="progress__track" />
            <circle
              cx="18"
              cy="18"
              r="15"
              className="progress__fill"
              style={{
                stroke: 'var(--accent)',
                strokeDasharray: `${circumference}`,
                strokeDashoffset: `${circumference - (percent / 100) * circumference}`,
              }}
            />
          </svg>
          <div className="progress__copy">
            <span className="progress__value">{percent}%</span>
            <span className="progress__label">Mastered</span>
          </div>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={onShare}
          title="Copy a link to this subject"
          aria-label="Share this subject"
        >
          <Share size={15} />
          <span className="icon-button__label">Share</span>
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onReset}
          title="Reset progress for this subject"
          aria-label="Reset progress for this subject"
        >
          <Reset size={15} />
          <span className="icon-button__label">Reset</span>
        </button>
      </div>
    </header>
  )
}
