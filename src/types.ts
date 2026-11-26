export interface Branch {
  id: string
  name: string
  color: string
}

export interface ExamQuestion {
  prompt: string
  choices: string[]
  answer: number
  explanation: string
}

export interface NodeExam {
  /** Minimum percentage required to master the node and unlock its dependents. */
  passScore: number
  questions: ExamQuestion[]
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
  exam?: NodeExam
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

/** Root manifest: metadata plus one file per subject. */
export interface SubjectManifest {
  version: number
  title: string
  subtitle: string
  subjectFiles: string[]
}

export interface TreeData {
  version: number
  title: string
  subtitle: string
  subjects: Subject[]
}

export type NodeState = 'mastered' | 'available' | 'locked'

export type NodeType = 'lesson' | 'quiz' | 'exam'

export interface Point {
  x: number
  y: number
}

export interface TriangleCell {
  points: Point[]
}

export interface AnchorPoint extends Point {
  u: number
  v: number
}

export interface LayoutEdge {
  key: string
  from: string
  to: string
}

export interface RoutedPath extends LayoutEdge {
  points: Point[]
}

export interface SubjectLayout {
  positions: Record<string, AnchorPoint>
  anchors: AnchorPoint[]
  offset: Point
  width: number
  height: number
  triangles: TriangleCell[]
  edges: LayoutEdge[]
}
