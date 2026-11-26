import { useCallback, useEffect, useState } from 'react'
import { sanitizeMastered } from '../lib/tree'
import {
  loadExamScores,
  loadProgress,
  saveExamScores,
  saveProgress,
  type ExamScoreMap,
  type ProgressMap,
} from '../lib/storage'
import type { Subject, TreeData } from '../types'

export function useProgress(data: TreeData | null) {
  const [progress, setProgress] = useState<ProgressMap>(loadProgress)
  const [examScores, setExamScores] = useState<ExamScoreMap>(loadExamScores)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    saveExamScores(examScores)
  }, [examScores])

  useEffect(() => {
    if (!data) return
    setProgress((current) => {
      const cleaned: ProgressMap = { ...current }
      for (const entry of data.subjects) {
        const stored = new Set(current[entry.id] ?? [])
        cleaned[entry.id] = [...sanitizeMastered(entry, stored)]
      }
      return cleaned
    })
    setExamScores((current) => {
      const cleaned: ExamScoreMap = { ...current }
      for (const entry of data.subjects) {
        const examIds = new Set(
          entry.nodes.filter((node) => node.exam).map((node) => node.id),
        )
        cleaned[entry.id] = Object.fromEntries(
          Object.entries(current[entry.id] ?? {}).filter(([nodeId]) => examIds.has(nodeId)),
        )
      }
      return cleaned
    })
  }, [data])

  const updateProgress = useCallback((subject: Subject, ids: string[]) => {
    setProgress((current) => ({ ...current, [subject.id]: ids }))
  }, [])

  const recordExamScore = useCallback((subject: Subject, nodeId: string, score: number) => {
    const bounded = Math.max(0, Math.min(100, Math.round(score)))
    setExamScores((current) => {
      const subjectScores = current[subject.id] ?? {}
      const best = Math.max(subjectScores[nodeId] ?? 0, bounded)
      if (best === subjectScores[nodeId]) return current
      return { ...current, [subject.id]: { ...subjectScores, [nodeId]: best } }
    })
  }, [])

  const clearExamScores = useCallback((subject: Subject, nodeIds: string[]) => {
    const removed = new Set(nodeIds)
    setExamScores((current) => {
      const subjectScores = { ...(current[subject.id] ?? {}) }
      for (const nodeId of removed) delete subjectScores[nodeId]
      return { ...current, [subject.id]: subjectScores }
    })
  }, [])

  return { progress, examScores, updateProgress, recordExamScore, clearExamScores }
}
