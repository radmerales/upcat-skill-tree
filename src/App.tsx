import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import DetailPanel from './components/DetailPanel'
import Header from './components/Header'
import Legend from './components/Legend'
import SkillCanvas from './components/SkillCanvas'
import { collectSubtree, layoutSubject, normalizeData } from './lib/tree'
import { loadLastSubject, loadProgress, saveLastSubject, saveProgress, type ProgressMap } from './lib/storage'
import type { SkillNode, Subject, TreeData } from './types'

const DATA_URL = `${import.meta.env.BASE_URL}data/upcat-skill-tree.json`

interface Toast {
  id: number
  message: string
}

export default function App() {
  const [data, setData] = useState<TreeData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState<string>('')
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [branchFilter, setBranchFilter] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  /* Load the editable content file ---------------------------------------- */
  useEffect(() => {
    let cancelled = false
    fetch(DATA_URL, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${DATA_URL}`)
        return response.json() as Promise<unknown>
      })
      .then((raw) => {
        if (cancelled) return
        const tree = normalizeData(raw)
        const fromUrl = new URLSearchParams(window.location.search).get('subject')
        const stored = loadLastSubject()
        const preferred = [fromUrl, stored].find(
          (candidate): candidate is string =>
            typeof candidate === 'string' && tree.subjects.some((subject) => subject.id === candidate),
        )
        setData(tree)
        setSubjectId(preferred ?? tree.subjects[0].id)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Unknown error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* Persist + sync URL ---------------------------------------------------- */
  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    if (!subjectId) return
    saveLastSubject(subjectId)
    const url = new URL(window.location.href)
    url.searchParams.set('subject', subjectId)
    window.history.replaceState(null, '', url)
  }, [subjectId])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    setSelectedId(null)
    setBranchFilter(null)
  }, [subjectId])

  const subject = useMemo(
    () => data?.subjects.find((entry) => entry.id === subjectId) ?? data?.subjects[0] ?? null,
    [data, subjectId],
  )

  const layout = useMemo(() => (subject ? layoutSubject(subject) : null), [subject])

  const mastered = useMemo(() => {
    if (!subject) return new Set<string>()
    const valid = new Set(subject.nodes.map((node) => node.id))
    return new Set((progress[subject.id] ?? []).filter((id) => valid.has(id)))
  }, [progress, subject])

  const selectedNode = useMemo(
    () => subject?.nodes.find((node) => node.id === selectedId) ?? null,
    [selectedId, subject],
  )

  const branchCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!subject) return counts
    for (const node of subject.nodes) {
      if (mastered.has(node.id)) counts[node.branch] = (counts[node.branch] ?? 0) + 1
    }
    return counts
  }, [mastered, subject])

  useEffect(() => {
    if (!subject) return
    document.title = `${subject.name} · UPCAT Skill Tree`
  }, [subject])

  const updateProgress = useCallback((targetSubject: Subject, ids: string[]) => {
    setProgress((current) => ({ ...current, [targetSubject.id]: ids }))
  }, [])

  const toggleNode = useCallback(
    (node: SkillNode) => {
      if (!subject) return
      const ids = new Set(progress[subject.id] ?? [])

      if (ids.has(node.id)) {
        const removed = collectSubtree(subject, node.id)
        removed.forEach((id) => ids.delete(id))
        updateProgress(subject, [...ids])
        setSelectedId((current) => (current && removed.includes(current) ? null : current))
        setToast({
          id: Date.now(),
          message: removed.length > 1 ? `Removed ${removed.length} skills` : `Removed: ${node.title}`,
        })
        return
      }

      if (!node.requires.every((id) => ids.has(id))) {
        setToast({ id: Date.now(), message: 'Finish the prerequisites first' })
        return
      }

      ids.add(node.id)
      updateProgress(subject, [...ids])
      const remaining = subject.nodes.length - ids.size
      setToast({
        id: Date.now(),
        message:
          remaining === 0
            ? `${subject.name} complete — every skill mastered!`
            : `Mastered: ${node.title}`,
      })
    },
    [progress, subject, updateProgress],
  )

  const handleSelectSubject = useCallback((nextSubjectId: string) => {
    setSubjectId(nextSubjectId)
    setResetOpen(false)
    setToast(null)
  }, [])

  const handleShare = useCallback(async () => {
    if (!subject) return
    const url = new URL(window.location.href)
    url.searchParams.set('subject', subject.id)
    try {
      await navigator.clipboard.writeText(url.toString())
      setToast({ id: Date.now(), message: 'Link copied to clipboard' })
    } catch {
      window.prompt('Copy this link:', url.toString())
    }
  }, [subject])

  const confirmReset = useCallback(() => {
    if (!subject) return
    updateProgress(subject, [])
    setSelectedId(null)
    setResetOpen(false)
    setToast({ id: Date.now(), message: `${subject.name} progress reset` })
  }, [subject, updateProgress])

  if (loadError) {
    return (
      <div className="boot boot--error">
        <div className="boot__card">
          <span className="boot__kicker">Data error</span>
          <h1>Could not load the skill tree</h1>
          <p>{loadError}</p>
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

  if (!data || !subject || !layout) {
    return (
      <div className="boot">
        <div className="boot__loader" aria-hidden="true" />
        <span className="boot__kicker">Loading</span>
        <p>Assembling skill tree…</p>
      </div>
    )
  }

  return (
    <div className="app" style={{ '--accent': subject.accent } as CSSProperties}>
      <Header
        data={data}
        subject={subject}
        progress={progress}
        onSelectSubject={handleSelectSubject}
        onShare={handleShare}
        onReset={() => setResetOpen(true)}
      />

      <main className="stage">
        <SkillCanvas
          subject={subject}
          tiers={data.tiers}
          layout={layout}
          mastered={mastered}
          selectedId={selectedId}
          branchFilter={branchFilter}
          onSelect={setSelectedId}
          onToggle={toggleNode}
        />

        <div className="stage__vignette" aria-hidden="true" />

        <Legend
          branches={subject.branches}
          active={branchFilter}
          counts={branchCounts}
          total={subject.nodes.length}
          onChange={setBranchFilter}
        />

        <div className="hints" aria-hidden="true">
          <span>Drag to pan</span>
          <span>Scroll to zoom</span>
          <span>Click to inspect</span>
          <span>Double-click to master</span>
        </div>

        {selectedNode && (
          <DetailPanel
            key={selectedNode.id}
            subject={subject}
            node={selectedNode}
            tiers={data.tiers}
            mastered={mastered}
            onClose={() => setSelectedId(null)}
            onSelect={setSelectedId}
            onToggle={toggleNode}
          />
        )}

        {toast && (
          <div key={toast.id} className="toast" role="status">
            {toast.message}
          </div>
        )}

        {resetOpen && (
          <div className="modal-backdrop" role="presentation" onClick={() => setResetOpen(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="modal__kicker">Reset subject</span>
              <h2 id="reset-title">Clear {subject.name}?</h2>
              <p>
                This removes all {mastered.size} mastered skill{mastered.size === 1 ? '' : 's'} in this
                subject. Your progress in other subjects stays untouched.
              </p>
              <div className="modal__actions">
                <button type="button" className="action action--ghost" onClick={() => setResetOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="action action--danger" onClick={confirmReset}>
                  Reset subject
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
