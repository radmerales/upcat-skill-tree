import type { Branch } from '../types'
import type { CSSProperties } from 'react'

interface LegendProps {
  branches: Branch[]
  active: string | null
  counts: Record<string, number>
  total: number
  onChange: (branchId: string | null) => void
}

const CHECKPOINT_BRANCH_ID = 'checkpoints'

export default function Legend({ branches, active, counts, total, onChange }: LegendProps) {
  const visibleBranches = branches.filter((branch) => branch.id !== CHECKPOINT_BRANCH_ID)

  return (
    <div className="legend" role="group" aria-label="Filter by branch">
      <span className="legend__label">Branch</span>
      <button
        type="button"
        className={`legend__chip${active === null ? ' is-active' : ''}`}
        onClick={() => onChange(null)}
      >
        <span className="legend__all-dot" />
        All
        <span className="legend__count">{total}</span>
      </button>
      {visibleBranches.map((branch) => (
        <button
          key={branch.id}
          type="button"
          className={`legend__chip${active === branch.id ? ' is-active' : ''}`}
          style={{ '--chip-color': branch.color } as CSSProperties}
          onClick={() => onChange(active === branch.id ? null : branch.id)}
        >
          <span className="legend__dot" />
          {branch.name}
          <span className="legend__count">{counts[branch.id] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}
