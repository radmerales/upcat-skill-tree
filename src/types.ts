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
  type: NodeType
  u: number
  v: number
  start?: boolean
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
  subjects: Subject[]
}

export type NodeState = 'mastered' | 'available' | 'locked'

export type NodeType = 'lesson' | 'quiz'

export interface Point {
  x: number
  y: number
}

export interface TriangleCell {
  points: Point[]
}

export interface RoutedEdge {
  key: string
  from: string
  to: string
  points: Point[]
}

export interface SubjectLayout {
  positions: Record<string, Point>
  width: number
  height: number
  triangles: TriangleCell[]
  edgePaths: RoutedEdge[]
}
