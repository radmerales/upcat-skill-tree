export interface Stage {
  label: string
  note: string
}

export interface Branch {
  id: string
  name: string
  color: string
}

export type NodeRole = 'start' | 'main' | 'sub'

export interface SkillNode {
  id: string
  title: string
  code: string
  branch: string
  role: NodeRole
  stage?: number
  description: string
  tip: string
}

export interface Subject {
  id: string
  name: string
  kicker: string
  blurb: string
  accent: string
  branches: Branch[]
  nodes: SkillNode[]
}

export interface TreeData {
  version: number
  title: string
  subtitle: string
  stages: Stage[]
  subjects: Subject[]
}

export type NodeState = 'mastered' | 'ready' | 'inprogress' | 'available' | 'locked'

export type Theme = 'light' | 'dark'

export interface Point {
  x: number
  y: number
}

export interface StageGroup {
  stage: number
  main: SkillNode
  subs: SkillNode[]
}

export interface SubjectStructure {
  start: SkillNode
  groups: StageGroup[]
  groupByNode: Map<string, StageGroup>
}

export interface HexCell extends Point {
  occupied: boolean
}

export interface StageHeader extends Point {
  stage: number
}

export interface SubjectLayout {
  positions: Record<string, Point>
  width: number
  height: number
  stageHeaders: StageHeader[]
  hexCells: HexCell[]
}
