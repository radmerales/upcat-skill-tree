import { useCallback, useEffect, useState } from 'react'
import { sanitizeMastered } from '../lib/tree'
import { loadProgress, saveProgress, type ProgressMap } from '../lib/storage'
import type { Subject, TreeData } from '../types'

export function useProgress(data: TreeData | null) {
  const [progress, setProgress] = useState<ProgressMap>(loadProgress)

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

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
  }, [data])

  const updateProgress = useCallback((subject: Subject, ids: string[]) => {
    setProgress((current) => ({ ...current, [subject.id]: ids }))
  }, [])

  return { progress, updateProgress }
}
