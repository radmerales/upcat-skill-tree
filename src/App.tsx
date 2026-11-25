import { useCallback, useEffect, useMemo, useState } from 'react'
import BootScreen from './components/BootScreen'
import DetailPanel from './components/DetailPanel'
import Header from './components/Header'
import Legend from './components/Legend'
import ResetDialog from './components/ResetDialog'
import SkillCanvas from './components/SkillCanvas'
import Toast from './components/Toast'
import { useCloseOnOutside } from './hooks/useCloseOnOutside'
import { useProgress } from './hooks/useProgress'
import { useSubjectSelection } from './hooks/useSubjectSelection'
import { useTreeData } from './hooks/useTreeData'
import {
  collectSubtree,
  layoutSubject,
  missingRequirements,
  nodeState,
} from './lib/tree'
import type { SkillNode } from './types'

interface ToastState {
  id: number
  message: string
}

export default function App() {
  const { data, error } = useTreeData()
  const { subjectId, setSubjectId } = useSubjectSelection(data)
  const { progress, updateProgress } = useProgress(data)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [branchFilter, setBranchFilter] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const closePanel = useCallback(() => setSelectedId(null), [])
  useCloseOnOutside(Boolean(selectedId), closePanel)

  useEffect(() => {
    setSelectedId(null)
    setBranchFilter(null)
  }, [subjectId])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

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
    if (!subject) return {}
    return subject.nodes.reduce<Record<string, number>>((counts, node) => {
      if (mastered.has(node.id)) counts[node.branch] = (counts[node.branch] ?? 0) + 1
      return counts
    }, {})
  }, [mastered, subject])

  useEffect(() => {
    if (subject) document.title = `${subject.name} · UPCAT Skill Tree`
  }, [subject])

  const toggleNode = useCallback(
    (node: SkillNode) => {
      if (!subject) return
      const ids = new Set(progress[subject.id] ?? [])
      const state = nodeState(node, ids)

      if (state === 'mastered') {
        const removed = collectSubtree(subject, node.id)
        const removedMastered = removed.filter((id) => ids.has(id)).length
        removed.forEach((id) => ids.delete(id))
        updateProgress(subject, [...ids])
        setSelectedId((current) => (current && removed.includes(current) ? null : current))
        setToast({
          id: Date.now(),
          message:
            removedMastered > 1
              ? `Cleared ${removedMastered} downstream nodes`
              : `Removed: ${node.title}`,
        })
        return
      }

      if (state === 'locked') {
        const missing = missingRequirements(node, ids)
        const titles = missing
          .map((id) => subject.nodes.find((entry) => entry.id === id)?.title ?? id)
          .slice(0, 2)
        setToast({
          id: Date.now(),
          message:
            missing.length === 1
              ? `Master ${titles[0]} first`
              : `Master ${titles.join(', ')}${missing.length > 2 ? ', …' : ''} first`,
        })
        return
      }

      ids.add(node.id)
      updateProgress(subject, [...ids])
      setToast({
        id: Date.now(),
        message:
          ids.size === subject.nodes.length
            ? `${subject.name} complete — every node mastered!`
            : node.start
              ? 'Subject started — follow the connected paths'
              : `Mastered: ${node.title}`,
      })
    },
    [progress, subject, updateProgress],
  )

  const handleSelectSubject = useCallback(
    (nextSubjectId: string) => {
      setSubjectId(nextSubjectId)
      setResetOpen(false)
      setToast(null)
    },
    [setSubjectId],
  )

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
    closePanel()
    setResetOpen(false)
    setToast({ id: Date.now(), message: `${subject.name} progress reset` })
  }, [closePanel, subject, updateProgress])

  if (error) return <BootScreen error={error} />
  if (!data || !subject || !layout) return <BootScreen error={null} />

  return (
    <div className="app">
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
          <span>Drag canvas to pan</span>
          <span>Drag nodes to move</span>
          <span>Scroll to zoom</span>
          <span>Click to inspect</span>
          <span>Double-click to master</span>
        </div>

        {selectedNode && (
          <DetailPanel
            key={selectedNode.id}
            subject={subject}
            node={selectedNode}
            mastered={mastered}
            onClose={closePanel}
            onSelect={setSelectedId}
            onToggle={toggleNode}
          />
        )}

        {toast && <Toast key={toast.id} message={toast.message} />}

        {resetOpen && (
          <ResetDialog
            subjectName={subject.name}
            masteredCount={mastered.size}
            onCancel={() => setResetOpen(false)}
            onConfirm={confirmReset}
          />
        )}
      </main>
    </div>
  )
}
