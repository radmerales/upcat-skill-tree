import type { Branch, NodeState, NodeType, SkillNode, Subject } from '../types'

/*  Progression                                                                */
/* -------------------------------------------------------------------------- */

export function nodeState(node: SkillNode, mastered: Set<string>): NodeState {
  if (mastered.has(node.id)) return 'mastered'
  return node.requires.every((id) => mastered.has(id)) ? 'available' : 'locked'
}

export function stateLabel(state: NodeState, type: NodeType = 'lesson'): string {
  if (state === 'mastered') return type === 'exam' ? 'Exam passed' : 'Mastered'
  if (state === 'available') return type === 'exam' ? 'Exam ready' : 'Ready to learn'
  return 'Locked'
}

export function missingRequirements(node: SkillNode, mastered: Set<string>): string[] {
  return node.requires.filter((id) => !mastered.has(id))
}

export function dependentsOf(subject: Subject, nodeId: string): SkillNode[] {
  return subject.nodes.filter((node) => node.requires.includes(nodeId))
}

/** A node plus everything that transitively depends on it. */
export function collectSubtree(subject: Subject, nodeId: string): string[] {
  const result = new Set<string>([nodeId])
  const stack = [nodeId]
  while (stack.length) {
    const current = stack.pop() as string
    for (const dependent of dependentsOf(subject, current)) {
      if (!result.has(dependent.id)) {
        result.add(dependent.id)
        stack.push(dependent.id)
      }
    }
  }
  return [...result]
}

export function sanitizeMastered(subject: Subject, stored: Set<string>): Set<string> {
  const validIds = new Set(subject.nodes.map((node) => node.id))
  const valid = new Set([...stored].filter((id) => validIds.has(id)))

  let changed = true
  while (changed) {
    changed = false
    for (const node of subject.nodes) {
      if (!valid.has(node.id)) continue
      if (!node.requires.every((id) => valid.has(id))) {
        valid.delete(node.id)
        changed = true
      }
    }
  }
  return valid
}

export function branchMap(subject: Subject): Record<string, Branch> {
  return Object.fromEntries(subject.branches.map((branch) => [branch.id, branch]))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/* -------------------------------------------------------------------------- */
