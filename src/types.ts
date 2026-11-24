export interface Tier {
  label: string
  note: string
}

export interface Branch {
  id: string
  name: string
  color: string
}

export interface SkillNode {
  id: string
  title: string
  code: string
  branch: string
  tier: number
  lane: number
  description: string
  tip: string
  requires: string[]
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
  tiers: Tier[]
  subjects: Subject[]
}

export type NodeState = 'mastered' | 'available' | 'locked'

export interface Point {
  x: number
  y: number
}

export interface SubjectLayout {
  positions: Record<string, Point>
  width: number
  height: number
  maxTier: number
  maxLane: number
}
