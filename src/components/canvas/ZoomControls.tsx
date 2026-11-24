import { Fit, Minus, Plus } from '../Icons'

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onFit }: ZoomControlsProps) {
  return (
    <div className="zoom-controls">
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
        <Plus size={15} />
      </button>
      <span className="zoom-controls__value">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
        <Minus size={15} />
      </button>
      <button type="button" onClick={onFit} aria-label="Fit tree to screen" title="Fit to screen">
        <Fit size={15} />
      </button>
    </div>
  )
}
