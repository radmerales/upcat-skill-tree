import type { Point } from '../types'

/** Equilateral triangle side, and the height of one row of triangles. */
export const TRI_S = 92
export const TRI_H = (TRI_S * Math.sqrt(3)) / 2

/** Every corner of the triangular lattice. */
export function vertexPoint(u: number, v: number): Point {
  return { x: (u + v / 2) * TRI_S, y: v * TRI_H }
}
