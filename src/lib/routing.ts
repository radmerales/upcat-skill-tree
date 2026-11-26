const TRI_NEIGHBORS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
]

export function buildGraph(
  minU: number,
  maxU: number,
  minV: number,
  maxV: number,
  allow: (u: number, v: number) => boolean = () => true,
) {
  const verts = new Set<string>()
  for (let v = minV; v <= maxV; v += 1) {
    for (let u = minU; u <= maxU; u += 1) {
      if (allow(u, v)) verts.add(`${u},${v}`)
    }
  }

  const neighbors = new Map<string, string[]>()
  for (const key of verts) {
    const [u, v] = key.split(',').map(Number)
    const list: string[] = []
    for (const [du, dv] of TRI_NEIGHBORS) {
      const nk = `${u + du},${v + dv}`
      if (verts.has(nk)) list.push(nk)
    }
    neighbors.set(key, list)
  }
  return { verts, neighbors }
}

/** Shortest route across triangle edges, preferring fewer bends. */
export function routeEdge(
  graph: ReturnType<typeof buildGraph>,
  from: string,
  to: string,
  blocked: Set<string>,
): Array<[number, number]> | null {
  if (!graph.verts.has(from) || !graph.verts.has(to)) return null

  interface State {
    key: string
    dir: number
    cost: number
    path: string[]
  }

  const dirIndex = new Map<string, number>()
  TRI_NEIGHBORS.forEach((step, index) => dirIndex.set(`${step[0]},${step[1]}`, index))

  const queue: State[] = [{ key: from, dir: -1, cost: 0, path: [from] }]
  const best = new Map<string, number>([[`${from}|-1`, 0]])

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift() as State
    const currentBest = best.get(`${current.key}|${current.dir}`)
    if (currentBest !== undefined && current.cost > currentBest) continue

    if (current.key === to) {
      return current.path.map((key) => {
        const [u, v] = key.split(',').map(Number)
        return [u, v] as [number, number]
      })
    }

    const [cu, cv] = current.key.split(',').map(Number)
    for (const nextKey of graph.neighbors.get(current.key) ?? []) {
      if (blocked.has(nextKey) && nextKey !== to) continue
      const [nu, nv] = nextKey.split(',').map(Number)
      const dir = dirIndex.get(`${nu - cu},${nv - cv}`) ?? -1
      if (dir === -1) continue
      const turn = current.dir === -1 || current.dir === dir ? 0 : 0.3
      const cost = current.cost + 1 + turn
      const stateKey = `${nextKey}|${dir}`
      const known = best.get(stateKey)
      if (known !== undefined && known <= cost) continue
      best.set(stateKey, cost)
      queue.push({ key: nextKey, dir, cost, path: [...current.path, nextKey] })
    }
  }
  return null
}

export function simplify(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length <= 2) return points
  const result: Array<[number, number]> = [points[0]]
  for (let i = 1; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    const [cx, cy] = points[i + 1]
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    if (cross !== 0) result.push(points[i])
  }
  result.push(points[points.length - 1])
  return result
}
