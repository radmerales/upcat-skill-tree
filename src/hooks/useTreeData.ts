import { useEffect, useState } from 'react'
import { normalizeData } from '../lib/tree'
import type { TreeData } from '../types'

const DATA_URL = `${import.meta.env.BASE_URL}data/upcat-skill-tree.json`

export function useTreeData() {
  const [data, setData] = useState<TreeData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(DATA_URL, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${DATA_URL}`)
        return response.json() as Promise<unknown>
      })
      .then((raw) => {
        if (cancelled) return
        setData(normalizeData(raw))
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'Unknown error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error }
}
