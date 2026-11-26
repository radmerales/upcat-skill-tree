const PROGRESS_KEY = 'upcat-skill-tree:progress:v1'
const EXAMS_KEY = 'upcat-skill-tree:exams:v1'
const SUBJECT_KEY = 'upcat-skill-tree:subject:v1'

export type ProgressMap = Record<string, string[]>
export type ExamScoreMap = Record<string, Record<string, number>>

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const result: ProgressMap = {}
    for (const [subjectId, ids] of Object.entries(parsed)) {
      if (Array.isArray(ids)) {
        result[subjectId] = ids.filter((id): id is string => typeof id === 'string')
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveProgress(progress: ProgressMap): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* storage unavailable — progress simply stays in memory */
  }
}

export function loadExamScores(): ExamScoreMap {
  try {
    const raw = localStorage.getItem(EXAMS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const result: ExamScoreMap = {}
    for (const [subjectId, scores] of Object.entries(parsed)) {
      if (typeof scores !== 'object' || scores === null || Array.isArray(scores)) continue
      const clean: Record<string, number> = {}
      for (const [nodeId, score] of Object.entries(scores)) {
        if (typeof score === 'number' && Number.isFinite(score)) {
          clean[nodeId] = Math.max(0, Math.min(100, Math.round(score)))
        }
      }
      result[subjectId] = clean
    }
    return result
  } catch {
    return {}
  }
}

export function saveExamScores(scores: ExamScoreMap): void {
  try {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(scores))
  } catch {
    /* storage unavailable — scores simply stay in memory */
  }
}

export function loadLastSubject(): string | null {
  try {
    return localStorage.getItem(SUBJECT_KEY)
  } catch {
    return null
  }
}

export function saveLastSubject(subjectId: string): void {
  try {
    localStorage.setItem(SUBJECT_KEY, subjectId)
  } catch {
    /* ignore */
  }
}
