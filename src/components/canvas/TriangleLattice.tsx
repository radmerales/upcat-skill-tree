import type { SubjectLayout } from '../../types'

interface TriangleLatticeProps {
  layout: SubjectLayout
}

export default function TriangleLattice({ layout }: TriangleLatticeProps) {
  return (
    <svg
      className="triangle-grid"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
    >
      {layout.triangles.map((triangle, index) => (
        <polygon
          key={`tri-${index}`}
          points={triangle.points.map((point) => `${point.x},${point.y}`).join(' ')}
          className="tri-cell"
        />
      ))}
    </svg>
  )
}
