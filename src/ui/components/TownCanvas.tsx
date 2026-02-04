import React, { useEffect, useRef } from 'react'
import { BUILDING_DEFS, TOWN_SIZE } from '../../config/balance'
import { TownTile } from '../../game/types'

export const TownCanvas: React.FC<{
  tiles: TownTile[]
  selected?: { x: number; y: number } | null
  onSelect?: (tile: TownTile) => void
}> = ({ tiles, selected, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = 360
    canvas.width = size
    canvas.height = size
    const cell = size / TOWN_SIZE
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = '#1f2937'
    for (let i = 0; i <= TOWN_SIZE; i += 1) {
      ctx.beginPath()
      ctx.moveTo(i * cell, 0)
      ctx.lineTo(i * cell, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * cell)
      ctx.lineTo(size, i * cell)
      ctx.stroke()
    }

    tiles.forEach((tile) => {
      if (!tile.buildingId) return
      const x = tile.x * cell
      const y = tile.y * cell
      ctx.fillStyle = '#1e3a8a'
      ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '10px sans-serif'
      ctx.fillText(BUILDING_DEFS[tile.buildingId].name.split(' ')[0], x + 8, y + cell / 2)
    })

    if (selected) {
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2
      ctx.strokeRect(selected.x * cell + 2, selected.y * cell + 2, cell - 4, cell - 4)
    }
  }, [tiles, selected])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !onSelect) return
    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const size = canvas.width
      const cell = size / TOWN_SIZE
      const x = Math.floor((event.clientX - rect.left) / cell)
      const y = Math.floor((event.clientY - rect.top) / cell)
      const tile = tiles.find((t) => t.x === x && t.y === y)
      if (tile) onSelect(tile)
    }
    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [tiles, onSelect])

  return <canvas ref={canvasRef} className="town-canvas" />
}
