import React, { useEffect, useRef, useState } from 'react'
import { createGridForCombat, createSimState, buildCombatResult, issueOrder, stepSim } from './sim'
import { renderScene, screenToWorld, clampCamera, Camera } from './render'
import { CombatDefinition, CombatResult, EntityState, Order, SimState, Vec2 } from './types'
import { UNIT_DEFS } from '../config/units'
import { Grid } from './pathfinding'
import { RunState } from '../run/types'

const FIXED_DT = 1 / 30

const getEntityAt = (entities: EntityState[], pos: Vec2, team: 'player' | 'enemy') => {
  let best: EntityState | null = null
  let bestDist = Infinity
  entities.forEach((entity) => {
    if (entity.team !== team) return
    const dist = Math.hypot(entity.pos.x - pos.x, entity.pos.y - pos.y)
    if (dist < entity.radius + 6 && dist < bestDist) {
      best = entity
      bestDist = dist
    }
  })
  return best
}

export const RTSGame: React.FC<{
  combat: CombatDefinition
  run: RunState
  onComplete: (result: CombatResult) => void
  onExit: () => void
}> = ({ combat, run, onComplete, onExit }) => {
  const [sim, setSim] = useState<SimState>(() => createSimState(combat, run))
  const simRef = useRef(sim)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null)
  const [dragBox, setDragBox] = useState<{ start: Vec2; end: Vec2 } | null>(null)
  const [paused, setPaused] = useState(false)
  const [commandMode, setCommandMode] = useState<'move' | 'attackMove'>('move')
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<Grid>(createGridForCombat(combat))
  const rafRef = useRef<number | null>(null)
  const dragMovedRef = useRef(false)
  const controlGroups = useRef<Record<number, string[]>>({})
  const endedRef = useRef(false)

  useEffect(() => {
    simRef.current = sim
  }, [sim])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPaused((prev) => !prev)
      }
      if (event.key.toLowerCase() === 'a') {
        setCommandMode('attackMove')
      }
      if (event.key.toLowerCase() === 's') {
        issueToSelected({ type: 'stop' })
      }
      if (event.ctrlKey && ['1', '2', '3'].includes(event.key)) {
        controlGroups.current[Number(event.key)] = [...selectedIds]
      }
      if (!event.ctrlKey && ['1', '2', '3'].includes(event.key)) {
        const group = controlGroups.current[Number(event.key)]
        if (group) setSelectedIds(group)
      }
      if (event.key === 'ArrowUp') {
        setCamera((prev) => ({ ...prev, y: prev.y - 40 }))
      }
      if (event.key === 'ArrowDown') {
        setCamera((prev) => ({ ...prev, y: prev.y + 40 }))
      }
      if (event.key === 'ArrowLeft') {
        setCamera((prev) => ({ ...prev, x: prev.x - 40 }))
      }
      if (event.key === 'ArrowRight') {
        setCamera((prev) => ({ ...prev, x: prev.x + 40 }))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedIds])

  const issueToSelected = (order: Order) => {
    if (selectedIds.length === 0) return
    const updated = issueOrder(simRef.current, selectedIds, order, gridRef.current)
    simRef.current = updated
    setSim(updated)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let last = performance.now()
    let acc = 0

    const loop = (time: number) => {
      const delta = (time - last) / 1000
      last = time
      acc += delta

      if (!paused) {
        while (acc >= FIXED_DT) {
          const next = stepSim(simRef.current, FIXED_DT, gridRef.current)
          simRef.current = next
          acc -= FIXED_DT
          if (next.status !== 'running' && !endedRef.current) {
            endedRef.current = true
            const result = buildCombatResult(next)
            onComplete(result)
          }
        }
      }

      const clamped = clampCamera(camera, canvas.width, canvas.height, combat.map.width, combat.map.height)
      if (clamped.x !== camera.x || clamped.y !== camera.y) {
        setCamera(clamped)
      }
      renderScene(ctx, simRef.current, clamped, selectedIds, gridRef.current)

      if (dragBox) {
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1
        const start = dragBox.start
        const end = dragBox.end
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [paused, dragBox, camera, combat.map.height, combat.map.width, onComplete, selectedIds])

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const start = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    dragMovedRef.current = false
    setDragBox({ start, end: start })
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const end = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (dragBox) {
      if (!dragMovedRef.current) {
        const dx = Math.abs(end.x - dragBox.start.x)
        const dy = Math.abs(end.y - dragBox.start.y)
        if (dx > 6 || dy > 6) dragMovedRef.current = true
      }
      setHoveredEnemyId(null)
      setDragBox({ ...dragBox, end })
      return
    }

    const world = screenToWorld({ x: end.x, y: end.y }, camera)
    const enemyTarget = getEntityAt(simRef.current.entities, world, 'enemy')
    const nextHover = enemyTarget ? enemyTarget.id : null
    if (nextHover !== hoveredEnemyId) setHoveredEnemyId(nextHover)
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const end = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (!dragBox) return
    const { start } = dragBox
    const dx = Math.abs(end.x - start.x)
    const dy = Math.abs(end.y - start.y)
    const wasDrag = dragMovedRef.current

    if (!wasDrag && dx < 6 && dy < 6) {
      const world = screenToWorld({ x: end.x, y: end.y }, camera)
      const playerTarget = getEntityAt(simRef.current.entities, world, 'player')

      if (playerTarget) {
        if (selectedIds.length === 1 && selectedIds[0] === playerTarget.id) {
          setSelectedIds([])
        } else {
          setSelectedIds([playerTarget.id])
        }
      } else if (selectedIds.length > 0) {
        const orderType = commandMode === 'attackMove' ? 'attackMove' : 'move'
        issueToSelected({ type: orderType, targetPos: world })
        setCommandMode('move')
      } else {
        setSelectedIds([])
      }
    } else {
      const minX = Math.min(start.x, end.x)
      const maxX = Math.max(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxY = Math.max(start.y, end.y)
      const selected = simRef.current.entities.filter((entity) => {
        if (entity.team !== 'player' || entity.kind === 'hq') return false
        const screen = {
          x: (entity.pos.x - camera.x) * camera.zoom,
          y: (entity.pos.y - camera.y) * camera.zoom
        }
        return screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY
      })
      setSelectedIds(selected.map((entity) => entity.id))
    }

    setDragBox(null)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    if (selectedIds.length === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const world = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera)

    const enemy = getEntityAt(simRef.current.entities, world, 'enemy')
    if (enemy) {
      issueToSelected({ type: 'attack', targetId: enemy.id, targetPos: { ...enemy.pos } })
    } else {
      const orderType = commandMode === 'attackMove' ? 'attackMove' : 'move'
      issueToSelected({ type: orderType, targetPos: world })
      setCommandMode('move')
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    setCamera((prev) => {
      const zoom = Math.min(1.6, Math.max(0.6, prev.zoom - event.deltaY * 0.001))
      return { ...prev, zoom }
    })
  }

  const selectedEntity = sim.entities.find((entity) => entity.id === selectedIds[0])
  const hoveredEnemy = sim.entities.find((entity) => entity.id === hoveredEnemyId && entity.team === 'enemy')
  const enemiesRemaining = sim.entities.filter((entity) => entity.team === 'enemy').length
  const hq = sim.entities.find((entity) => entity.kind === 'hq')
  const hqHp = hq ? `${Math.round(hq.hp)}/${Math.round(hq.maxHp)}` : '0'
  const selectedInfo = selectedEntity && selectedEntity.kind !== 'hq' ? UNIT_DEFS[selectedEntity.kind] : null
  const hoveredInfo = hoveredEnemy && hoveredEnemy.kind !== 'hq' ? UNIT_DEFS[hoveredEnemy.kind] : null
  const tooltipPosition = (() => {
    if (!hoveredEnemy) return null
    const canvas = canvasRef.current
    if (!canvas) return null
    const tooltipW = 220
    const tooltipH = 84
    const screenX = (hoveredEnemy.pos.x - camera.x) * camera.zoom
    const screenY = (hoveredEnemy.pos.y - camera.y) * camera.zoom
    const pad = 12
    let x = screenX + 16
    let y = screenY - tooltipH - 16
    if (x + tooltipW > canvas.width - pad) x = screenX - tooltipW - 16
    if (x < pad) x = pad
    if (y < pad) y = screenY + 16
    if (y + tooltipH > canvas.height - pad) y = canvas.height - tooltipH - pad
    return { x, y }
  })()

  return (
    <div className="rts">
      <div className="rts-top">
        <div>Day {combat.dayNumber} Combat</div>
        <div className="muted">Wave {Math.min(sim.waveIndex + 1, combat.waves.length)}/{combat.waves.length}</div>
        <div className="muted">Enemies: {enemiesRemaining}</div>
        <div className="muted">HQ: {hqHp}</div>
      </div>
      <div className="rts-body">
        <div className="rts-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="rts-canvas"
            width={900}
            height={540}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
            onMouseLeave={() => setHoveredEnemyId(null)}
          />
          {hoveredEnemy && hoveredInfo && tooltipPosition && (
            <div
              className="rts-tooltip"
              style={{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }}
            >
              <div className="rts-tooltip-title">{hoveredInfo.name}{hoveredEnemy.isBoss ? ' (Boss)' : ''}</div>
              <div className="muted">{hoveredInfo.description}</div>
              <div className="muted">HP {Math.round(hoveredEnemy.hp)}/{Math.round(hoveredEnemy.maxHp)}</div>
            </div>
          )}
        </div>
        <div className="rts-panel">
          <h4>Selected</h4>
          {selectedEntity ? (
            <div>
              <div>Type: {selectedInfo ? selectedInfo.name : 'HQ'}</div>
              {selectedInfo && <div className="muted">{selectedInfo.description}</div>}
              <div>HP: {Math.round(selectedEntity.hp)}/{Math.round(selectedEntity.maxHp)}</div>
              <div>Order: {selectedEntity.order.type}</div>
            </div>
          ) : (
            <div className="muted">No unit selected.</div>
          )}
          <div className="rts-help">
            <div className="muted">Left-click units to select. Left-click ground to move. Right-click to attack or move.</div>
            <div className="muted">Hover an enemy to inspect. Hotkeys: A attack-move, S stop, Ctrl+1/2/3 assign group, 1/2/3 recall.</div>
          </div>
          <button className="btn" onClick={() => setPaused(true)}>Pause</button>
        </div>
      </div>
      {paused && (
        <div className="pause-overlay">
          <div className="pause-menu">
            <h3>Paused</h3>
            <button className="btn success" onClick={() => setPaused(false)}>Resume</button>
            <button className="btn" onClick={() => {
              const next = createSimState(combat, run)
              simRef.current = next
              setSim(next)
              setSelectedIds([])
              setPaused(false)
              endedRef.current = false
            }}>Restart Day</button>
            <button className="btn" onClick={onExit}>Quit to Level Select</button>
          </div>
        </div>
      )}
    </div>
  )
}
