import React, { useEffect, useRef } from 'react'

export interface MiniMapView {
  mapWidth: number
  mapHeight: number
  viewX: number
  viewY: number
  viewW: number
  viewH: number
}

export const MiniMap: React.FC<{
  obstacles: Array<{ x: number; y: number; w: number; h: number }>
  hq: { x: number; y: number }
  view: MiniMapView | null
  onNavigate?: (x: number, y: number) => void
}> = ({ obstacles, hq, view, onNavigate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !view) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'
    ctx.strokeRect(1, 1, width - 2, height - 2)

    const scaleX = width / view.mapWidth
    const scaleY = height / view.mapHeight
    obstacles.forEach((ob) => {
      ctx.fillStyle = 'rgba(148,163,184,0.25)'
      ctx.fillRect(ob.x * scaleX, ob.y * scaleY, ob.w * scaleX, ob.h * scaleY)
    })
    ctx.fillStyle = '#38bdf8'
    ctx.beginPath()
    ctx.arc(hq.x * scaleX, hq.y * scaleY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 1
    ctx.strokeRect(view.viewX * scaleX, view.viewY * scaleY, view.viewW * scaleX, view.viewH * scaleY)
  }, [obstacles, hq, view])

  return (
    <button
      type="button"
      className="pointer-events-auto rounded-2xl border border-white/10 bg-surface/80 p-2 shadow-soft"
      onClick={(event) => {
        if (!view || !onNavigate || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const worldX = (x / rect.width) * view.mapWidth
        const worldY = (y / rect.height) * view.mapHeight
        onNavigate(worldX, worldY)
      }}
    >
      <canvas ref={canvasRef} width={160} height={120} className="block rounded-xl" />
    </button>
  )
}
