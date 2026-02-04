import React, { useEffect, useRef } from 'react'
import { TroopCounts } from '../../game/types'

export const CombatCanvas: React.FC<{
  playerTroops: TroopCounts
  enemyTroops: TroopCounts
  resultText: string
}> = ({ playerTroops, enemyTroops, resultText }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = 500
    const height = 220
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#1d4ed8'
    ctx.fillRect(40, 80, 120, 60)
    ctx.fillStyle = '#f8fafc'
    ctx.font = '12px sans-serif'
    ctx.fillText(`Player`, 60, 70)
    ctx.fillText(`Inf ${playerTroops.infantry}`, 50, 100)
    ctx.fillText(`Arc ${playerTroops.archer}`, 50, 120)
    ctx.fillText(`Cav ${playerTroops.cavalry}`, 50, 140)

    ctx.fillStyle = '#b91c1c'
    ctx.fillRect(340, 80, 120, 60)
    ctx.fillStyle = '#f8fafc'
    ctx.fillText(`Enemy`, 360, 70)
    ctx.fillText(`Inf ${enemyTroops.infantry}`, 350, 100)
    ctx.fillText(`Arc ${enemyTroops.archer}`, 350, 120)
    ctx.fillText(`Cav ${enemyTroops.cavalry}`, 350, 140)

    ctx.fillStyle = '#e2e8f0'
    ctx.fillText(resultText, 180, 200)
  }, [playerTroops, enemyTroops, resultText])

  return <canvas ref={canvasRef} className="combat-canvas" />
}
