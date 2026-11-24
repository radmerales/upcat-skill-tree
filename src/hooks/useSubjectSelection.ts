import { useEffect, useState } from 'react'
import { loadLastSubject, saveLastSubject } from '../lib/storage'
import type { TreeData } from '../types'

export function useSubjectSelection(data: TreeData | null) {
  const [subjectId, setSubjectId] = useState('')

  useEffect(() => {
    if (!data) return
    setSubjectId((current) => {
      if (current && data.subjects.some((subject) => subject.id === current)) return current
      const fromUrl = new URLSearchParams(window.location.search).get('subject')
      const stored = loadLastSubject()
      const preferred = [fromUrl, stored].find(
        (candidate): candidate is string =>
          typeof candidate === 'string' && data.subjects.some((subject) => subject.id === candidate),
      )
      return preferred ?? data.subjects[0].id
    })
  }, [data])

  useEffect(() => {
    if (!subjectId) return
    saveLastSubject(subjectId)
    const url = new URL(window.location.href)
    url.searchParams.set('subject', subjectId)
    window.history.replaceState(null, '', url)
  }, [subjectId])

  return { subjectId, setSubjectId }
}
