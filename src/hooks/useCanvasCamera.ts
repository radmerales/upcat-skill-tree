import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { clamp } from '../lib/tree'
import type { Point } from '../types'

interface View {
  x: number
  y: number
  k: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

interface CameraOptions {
  width: number
  height: number
  start: Point
  subjectId: string
}

export function useCanvasCamera({ width, height, start, subjectId }: CameraOptions) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [panning, setPanning] = useState(false)
  const [fitted, setFitted] = useState(false)

  viewRef.current = view

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const frameAll = useCallback(() => {
    if (!size.width || !size.height) return
    const paddingX = size.width < 720 ? 16 : 34
    const paddingY = size.height < 560 ? 16 : 32
    const k = clamp(
      Math.min((size.width - paddingX * 2) / width, (size.height - paddingY * 2) / height),
      0.24,
      1.35,
    )
    setView({
      k,
      x: (size.width - width * k) / 2,
      y: (size.height - height * k) / 2 + 6,
    })
    setFitted(true)
  }, [height, size.height, size.width, width])

  const frameStart = useCallback(() => {
    if (!size.width || !size.height) return

    if (size.width < 720) {
      const k = 0.76
      setView({
        k,
        x: 56 - start.x * k,
        y: Math.max(24, size.height * 0.4 - start.y * k),
      })
      setFitted(true)
      return
    }

    const paddingX = 30
    const paddingY = 26
    const fit = Math.min(
      (size.width - paddingX * 2) / width,
      (size.height - paddingY * 2) / height,
    )
    const k = clamp(fit * 1.04, 0.66, 1.25)
    setView({
      k,
      x: Math.max(24, (size.width - width * k) / 2),
      y: Math.max(8, (size.height - height * k) / 2),
    })
    setFitted(true)
  }, [height, size.height, size.width, start.x, start.y, width])

  useEffect(() => setFitted(false), [subjectId])

  useEffect(() => {
    frameStart()
  }, [frameStart, subjectId])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const current = viewRef.current
      const factor = Math.exp(-event.deltaY * 0.0016)
      const k = clamp(current.k * factor, 0.24, 2.2)
      const ratio = k / current.k
      setView({
        k,
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio,
      })
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('.vnode')) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true
    if (!drag.moved) return
    setView((current) => ({ ...current, x: drag.originX + dx, y: drag.originY + dy }))
  }

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    dragRef.current = null
    setPanning(false)
  }

  const zoomBy = (factor: number) => {
    const current = viewRef.current
    const k = clamp(current.k * factor, 0.24, 2.2)
    const ratio = k / current.k
    const centerX = size.width / 2
    const centerY = size.height / 2
    setView({
      k,
      x: centerX - (centerX - current.x) * ratio,
      y: centerY - (centerY - current.y) * ratio,
    })
  }

  const clearSuppressClick = () => {
    suppressClickRef.current = false
  }

  return {
    viewportRef,
    view,
    panning,
    fitted,
    suppressClickRef,
    frameAll,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPan,
    onPointerCancel: endPan,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    clearSuppressClick,
  }
}
