interface ResetDialogProps {
  subjectName: string
  masteredCount: number
  onCancel: () => void
  onConfirm: () => void
}

export default function ResetDialog({
  subjectName,
  masteredCount,
  onCancel,
  onConfirm,
}: ResetDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="modal__kicker">Reset subject</span>
        <h2 id="reset-title">Clear {subjectName}?</h2>
        <p>
          This removes all {masteredCount} mastered skill{masteredCount === 1 ? '' : 's'} and every
          checkpoint exam score in this subject. Your progress in other subjects stays untouched.
        </p>
        <div className="modal__actions">
          <button type="button" className="action action--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="action action--danger" onClick={onConfirm}>
            Reset subject
          </button>
        </div>
      </div>
    </div>
  )
}
