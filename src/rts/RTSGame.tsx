import React, { useEffect, useRef, useState } from 'react'
import { BuildingPad } from '../config/levels'
import { RunBuilding, RunState } from '../run/types'
import {
  createGridForCombat,
  createSimState,
  buildCombatResult,
  getPlayerPositionSnapshot,
  issueOrder,
  rallyFriendlyToHero,
  stepSim,
  type PlayerInputState,
  useHeroAbility
} from './sim'
import { renderScene, screenToWorld, clampCamera, Camera } from './render'
import { hitTestPad } from './pads'
import { CombatDefinition, CombatResult, EntityState, Order, SimState, Vec2 } from './types'
import { UNIT_DEFS } from '../config/units'
import { Grid } from './pathfinding'
import { isGameplayKeyboardBlockedByFocus } from './input/focusGuard'

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
  phase: 'build' | 'combat'
  resetOnBuild?: boolean
  buildingPads: BuildingPad[]
  buildings: RunBuilding[]
  onPadClick: (padId: string) => void
  onPadBlocked: () => void
  onComplete: (result: CombatResult) => void
  onExit: () => void
}> = ({ combat, run, phase, resetOnBuild, buildingPads, buildings, onPadClick, onPadBlocked, onComplete, onExit }) => {
  const [sim, setSim] = useState<SimState>(() => createSimState(combat, run))
  const simRef = useRef(sim)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null)
  const [hoveredPadId, setHoveredPadId] = useState<string | null>(null)
  const [dragBox, setDragBox] = useState<{ start: Vec2; end: Vec2 } | null>(null)
  const [paused, setPaused] = useState(false)
  const [commandMode, setCommandMode] = useState<'move' | 'attackMove'>('move')
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<Grid>(createGridForCombat(combat))
  const rafRef = useRef<number | null>(null)
  const dragMovedRef = useRef(false)
  const controlGroups = useRef<Record<number, string[]>>({})
  const playerInputRef = useRef<PlayerInputState>({ up: false, down: false, left: false, right: false })
  const endedRef = useRef(false)
  const phaseRef = useRef(phase)
  const dayRef = useRef(combat.dayNumber)

  useEffect(() => {
    simRef.current = sim
  }, [sim])

  useEffect(() => {
    if (combat.dayNumber !== dayRef.current) {
      const playerPositions = getPlayerPositionSnapshot(simRef.current)
      const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
      const next = createSimState(combat, run, {
        heroPos: hero ? { ...hero.pos } : combat.map.playerSpawn,
        heroHp: hero?.hp,
        playerPositions
      })
      simRef.current = next
      setSim(next)
      setSelectedIds([])
      setPaused(false)
      controlGroups.current = {}
      endedRef.current = false
      dayRef.current = combat.dayNumber
    }
  }, [combat, run])

  useEffect(() => {
    if (phaseRef.current === phase) return
    const prev = phaseRef.current
    phaseRef.current = phase
    if (prev === 'build' && phase === 'combat') {
      const playerPositions = getPlayerPositionSnapshot(simRef.current)
      const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
      const next = createSimState(combat, run, {
        heroPos: hero ? { ...hero.pos } : combat.map.playerSpawn,
        heroHp: hero?.hp,
        playerPositions
      })
      simRef.current = next
      setSim(next)
      setSelectedIds([])
      controlGroups.current = {}
      endedRef.current = false
    }
    if (prev === 'combat' && phase === 'build') {
      const playerPositions = getPlayerPositionSnapshot(simRef.current)
      const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
      const next = createSimState(combat, run, {
        heroPos: hero ? { ...hero.pos } : combat.map.playerSpawn,
        heroHp: resetOnBuild ? undefined : hero?.hp,
        playerPositions
      })
      simRef.current = next
      setSim(next)
      setSelectedIds([])
      controlGroups.current = {}
      endedRef.current = false
    }
    if (phase === 'build') {
      setPaused(false)
    }
  }, [phase, combat, run])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isGameplayKeyboardBlockedByFocus()) return
      if (event.key === 'ArrowUp') {
        playerInputRef.current.up = true
        event.preventDefault()
        return
      }
      if (event.key === 'ArrowDown') {
        playerInputRef.current.down = true
        event.preventDefault()
        return
      }
      if (event.key === 'ArrowLeft') {
        playerInputRef.current.left = true
        event.preventDefault()
        return
      }
      if (event.key === 'ArrowRight') {
        playerInputRef.current.right = true
        event.preventDefault()
        return
      }
      if (event.code === 'KeyT' && !paused) {
        const rallied = rallyFriendlyToHero(simRef.current, gridRef.current)
        simRef.current = rallied.state
        setSim(rallied.state)
        return
      }
      if (event.key === 'Escape') {
        if (phase === 'combat') {
          setPaused((prev) => !prev)
        }
        return
      }
      if (event.key.toLowerCase() === 'a') {
        setCommandMode('attackMove')
      }
      if (event.key.toLowerCase() === 's') {
        issueToSelected({ type: 'stop' })
      }
      if ((event.key === 'q' || event.key === 'Q') && phase === 'combat' && !paused) {
        const next = useHeroAbility(simRef.current, 'q')
        simRef.current = next
        setSim(next)
      }
      if ((event.key === 'e' || event.key === 'E') && phase === 'combat' && !paused) {
        const next = useHeroAbility(simRef.current, 'e')
        simRef.current = next
        setSim(next)
      }
      if (event.ctrlKey && ['1', '2', '3'].includes(event.key)) {
        controlGroups.current[Number(event.key)] = [...selectedIds]
      }
      if (!event.ctrlKey && ['1', '2', '3'].includes(event.key)) {
        const group = controlGroups.current[Number(event.key)]
        if (group) setSelectedIds(group)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        playerInputRef.current.up = false
        return
      }
      if (event.key === 'ArrowDown') {
        playerInputRef.current.down = false
        return
      }
      if (event.key === 'ArrowLeft') {
        playerInputRef.current.left = false
        return
      }
      if (event.key === 'ArrowRight') {
        playerInputRef.current.right = false
      }
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedIds, phase, paused])

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
          const next = stepSim(
            simRef.current,
            FIXED_DT,
            gridRef.current,
            phase === 'combat' ? 'combat' : 'build',
            playerInputRef.current
          )
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
      renderScene(ctx, simRef.current, clamped, selectedIds, gridRef.current, {
        pads: buildingPads,
        buildings,
        hoveredPadId,
        selectedPadId: null
      }, {
        showLabels: true
      })

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
  }, [paused, dragBox, camera, combat.map.height, combat.map.width, onComplete, selectedIds, phase, buildingPads, buildings, hoveredPadId])

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
      setHoveredPadId(null)
      setDragBox({ ...dragBox, end })
      return
    }

    const world = screenToWorld({ x: end.x, y: end.y }, camera)
    const pad = buildingPads.find((entry) => hitTestPad(entry, world)) ?? null
    setHoveredPadId(pad ? pad.id : null)
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
      const pad = buildingPads.find((entry) => hitTestPad(entry, world))
      if (pad) {
        if (phase === 'build') {
          onPadClick(pad.id)
        } else {
          onPadBlocked()
        }
        setDragBox(null)
        return
      }
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
  const heroEntity = sim.entities.find((entity) => entity.kind === 'hero')
  const heroRuntime = combat.hero
  const selectedInfo =
    selectedEntity && selectedEntity.kind !== 'hq'
      ? selectedEntity.kind === 'hero'
        ? { name: selectedEntity.heroName ?? heroRuntime.name, description: selectedEntity.heroDescription ?? heroRuntime.description }
        : selectedEntity.kind === 'elite'
          ? { name: selectedEntity.tier === 'boss' ? 'Boss' : 'Mini Boss', description: 'Elite enemy unit.' }
          : UNIT_DEFS[selectedEntity.kind]
      : null
  const hoveredInfo =
    hoveredEnemy && hoveredEnemy.kind !== 'hq'
      ? hoveredEnemy.kind === 'elite'
        ? { name: hoveredEnemy.tier === 'boss' ? 'Boss' : 'Mini Boss', description: 'Elite enemy unit.' }
        : UNIT_DEFS[hoveredEnemy.kind]
      : null
  const heroCooldowns = sim.heroAbilityCooldowns
  const qReadyIn = Math.max(0, heroCooldowns.q - sim.time)
  const eReadyIn = Math.max(0, heroCooldowns.e - sim.time)
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
        <div>Day {combat.dayNumber} · {phase === 'combat' ? 'Combat' : 'Build'}</div>
        {phase === 'combat' && (
          <>
            <div className="muted">Wave {Math.min(sim.waveIndex + 1, combat.waves.length)}/{combat.waves.length}</div>
            <div className="muted">Enemies: {enemiesRemaining}</div>
          </>
        )}
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
            onMouseLeave={() => {
              setHoveredEnemyId(null)
              setHoveredPadId(null)
            }}
          />
          {hoveredEnemy && hoveredInfo && tooltipPosition && (
            <div
              className="rts-tooltip"
              style={{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }}
            >
              <div className="rts-tooltip-title">
                {hoveredInfo.name}
                {hoveredEnemy.tier === 'boss' ? ' (Boss)' : hoveredEnemy.tier === 'miniBoss' ? ' (Mini Boss)' : ''}
              </div>
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
          {heroEntity && (
            <div className="rts-hero">
              <h4>Hero</h4>
              <div>{heroRuntime.name}</div>
              <div className="muted">{heroRuntime.description}</div>
              <div>HP: {Math.round(heroEntity.hp)}/{Math.round(heroEntity.maxHp)}</div>
              <div className="muted">
                Q {heroRuntime.abilities.q.name}: {qReadyIn <= 0 ? 'Ready' : `${qReadyIn.toFixed(1)}s`}
              </div>
              <div className="muted">
                E {heroRuntime.abilities.e.name}: {eReadyIn <= 0 ? 'Ready' : `${eReadyIn.toFixed(1)}s`}
              </div>
            </div>
          )}
          <div className="rts-help">
            <div className="muted">Left-click units to select. Left-click ground to move. Right-click to attack or move.</div>
            <div className="muted">Hover an enemy to inspect. Hotkeys: Arrows move hero, T rally, A attack-move, S stop, Q/E hero abilities, Ctrl+1/2/3 assign group, 1/2/3 recall.</div>
          </div>
          {phase === 'combat' && <button className="btn" onClick={() => setPaused(true)}>Pause</button>}
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
