interface BootScreenProps {
  error: string | null
}

export default function BootScreen({ error }: BootScreenProps) {
  if (error) {
    return (
      <div className="boot boot--error">
        <div className="boot__card">
          <span className="boot__kicker">Data error</span>
          <h1>Could not load the skill tree</h1>
          <p>{error}</p>
          <p className="boot__hint">
            Check <code>public/data/upcat-skill-tree.json</code>, then run{' '}
            <code>npm run validate</code> and reload.
          </p>
          <button type="button" className="action action--primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="boot">
      <div className="boot__loader" aria-hidden="true" />
      <span className="boot__kicker">Loading</span>
      <p>Assembling skill tree…</p>
    </div>
  )
}
