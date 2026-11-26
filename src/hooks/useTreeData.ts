import { useEffect, useState } from 'react'
import { assembleTreeData, normalizeManifest } from '../lib/tree'
import type { TreeData } from '../types'

const DATA_DIR = new URL(`${import.meta.env.BASE_URL}data/`, document.baseURI)

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${url.pathname}`)
  return response.json() as Promise<unknown>
}

async function loadTreeData(): Promise<TreeData> {
  const manifest = normalizeManifest(await fetchJson(new URL('upcat-skill-tree.json', DATA_DIR)))
  const subjectRaws = await Promise.all(
    manifest.subjectFiles.map((file) => fetchJson(new URL(file, DATA_DIR))),
  )
  return assembleTreeData(manifest, subjectRaws)
}

export function useTreeData() {
  const [data, setData] = useState<TreeData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTreeData()
      .then((tree) => {
        if (cancelled) return
        setData(tree)
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
