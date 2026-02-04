import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { BuildingPad } from '../../config/levels'
import { RunBuilding, RunState } from '../../run/types'
import { buildCombatResult, createGridForCombat, createSimState, issueOrder, stepSim, useHeroAbility } from '../../rts/sim'
import { clampCamera, renderScene, screenToWorld, Camera } from '../../rts/render'
import { hitTestPad } from '../../rts/pads'
import { CombatDefinition, CombatResult, EntityState, Order, SimState, Vec2 } from '../../rts/types'
import { UNIT_DEFS } from '../../config/units'
import { Grid } from '../../rts/pathfinding'
import type { SelectionInfo } from '../store/uiStore'

const FIXED_DT = 1 / 30

const getEntityAt = (entities: EntityState[], pos: Vec2, team: 'player' | 'enemy') => {
  let best: EntityState | null = null
  let bestDist = Infinity
  entities.forEach((entity) => {
    if (entity.team !== team) return
    if (entity.kind === 'hq') return
    const dist = Math.hypot(entity.pos.x - pos.x, entity.pos.y - pos.y)
    if (dist < entity.radius + 6 && dist < bestDist) {
      best = entity
      bestDist = dist
    }
  })
  return best
}

const getHqAt = (entities: EntityState[], pos: Vec2) => {
  const hq = entities.find((entity) => entity.kind === 'hq')
  if (!hq) return null
  const dist = Math.hypot(hq.pos.x - pos.x, hq.pos.y - pos.y)
  return dist < hq.radius + 8 ? hq : null
}

export interface CanvasTelemetry {
  waveIndex: number
  waveCount: number
  enemiesRemaining: number
  hqHp: number
  hqMaxHp: number
  heroHp: number
  heroMaxHp: number
  qReadyIn: number
  eReadyIn: number
  camera: { x: number; y: number; zoom: number; viewW: number; viewH: number }
  playerUnits: Array<{ x: number; y: number; kind: 'hero' | 'unit' }>
  enemyUnits: Array<{ x: number; y: number }>
}

export interface CanvasHandle {
  panTo: (x: number, y: number) => void
  castAbility: (key: 'q' | 'e') => void
  resetDay: () => void
}

export const CanvasLayer = React.memo(
  React.forwardRef<CanvasHandle, {
    combat: CombatDefinition
    run: RunState
    phase: 'build' | 'combat'
    resetOnBuild?: boolean
    buildingPads: BuildingPad[]
    buildings: RunBuilding[]
    inputBlocked?: boolean
    onPadClick: (padId: string) => void
    onPadBlocked: () => void
    onComplete: (result: CombatResult) => void
    onSelectionChange?: (selection: SelectionInfo) => void
    onTelemetry?: (telemetry: CanvasTelemetry) => void
    onPauseToggle?: () => void
    paused?: boolean
    selectedPadId?: string | null
  }>(({
    combat,
    run,
    phase,
    resetOnBuild,
    buildingPads,
    buildings,
    inputBlocked,
    onPadClick,
    onPadBlocked,
    onComplete,
    onSelectionChange,
    onTelemetry,
    onPauseToggle,
    paused,
    selectedPadId
  }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const simRef = useRef<SimState>(createSimState(combat, run))
    const gridRef = useRef<Grid>(createGridForCombat(combat))
    const rafRef = useRef<number | null>(null)
    const dragBoxRef = useRef<{ start: Vec2; end: Vec2 } | null>(null)
    const dragMovedRef = useRef(false)
    const selectedIdsRef = useRef<string[]>([])
    const hoveredPadIdRef = useRef<string | null>(null)
    const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
    const commandModeRef = useRef<'move' | 'attackMove'>('move')
    const controlGroupsRef = useRef<Record<number, string[]>>({})
    const phaseRef = useRef(phase)
    const pausedRef = useRef(Boolean(paused))
    const endedRef = useRef(false)
    const padsRef = useRef(buildingPads)
    const buildingsRef = useRef(buildings)
    const selectedPadRef = useRef<string | null>(selectedPadId ?? null)
    const onPadClickRef = useRef(onPadClick)
    const onPadBlockedRef = useRef(onPadBlocked)
    const onCompleteRef = useRef(onComplete)
    const onSelectionRef = useRef(onSelectionChange)
    const onTelemetryRef = useRef(onTelemetry)
    const onPauseToggleRef = useRef(onPauseToggle)
    const lastTelemetryRef = useRef<CanvasTelemetry | null>(null)
    const lastTelemetryAt = useRef(0)
    const dayRef = useRef(combat.dayNumber)
    const combatRef = useRef(combat)
    const runRef = useRef(run)

    useEffect(() => {
      padsRef.current = buildingPads
      buildingsRef.current = buildings
      selectedPadRef.current = selectedPadId ?? null
    }, [buildingPads, buildings, selectedPadId])

    useEffect(() => {
      onPadClickRef.current = onPadClick
      onPadBlockedRef.current = onPadBlocked
      onCompleteRef.current = onComplete
      onSelectionRef.current = onSelectionChange
      onTelemetryRef.current = onTelemetry
      onPauseToggleRef.current = onPauseToggle
    }, [onPadClick, onPadBlocked, onComplete, onSelectionChange, onTelemetry, onPauseToggle])

    useEffect(() => {
      pausedRef.current = Boolean(paused)
    }, [paused])

    useEffect(() => {
      combatRef.current = combat
      gridRef.current = createGridForCombat(combat)
    }, [combat])

    useEffect(() => {
      const prev = runRef.current
      runRef.current = run
      if (prev === run) return
      if (phaseRef.current === 'build') {
        const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
        simRef.current = createSimState(combatRef.current, run, {
          heroPos: hero ? { ...hero.pos } : combatRef.current.map.playerSpawn,
          heroHp: hero?.hp
        })
        endedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }, [run])

    useEffect(() => {
      if (combat.dayNumber !== dayRef.current) {
        simRef.current = createSimState(combat, run)
        selectedIdsRef.current = []
        dragBoxRef.current = null
        dayRef.current = combat.dayNumber
        endedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }, [combat, run])

    useEffect(() => {
      if (phaseRef.current === phase) return
      const prev = phaseRef.current
      phaseRef.current = phase
      if (prev === 'build' && phase === 'combat') {
        const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
        simRef.current = createSimState(combat, run, {
          heroPos: hero ? { ...hero.pos } : combat.map.playerSpawn,
          heroHp: hero?.hp
        })
        selectedIdsRef.current = []
        dragBoxRef.current = null
        endedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
      if (prev === 'combat' && phase === 'build') {
        const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
        simRef.current = createSimState(combat, run, {
          heroPos: hero ? { ...hero.pos } : combat.map.playerSpawn,
          heroHp: resetOnBuild ? undefined : hero?.hp
        })
        selectedIdsRef.current = []
        dragBoxRef.current = null
        endedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }, [phase, combat, resetOnBuild, run])

    useImperativeHandle(ref, () => ({
      panTo: (x: number, y: number) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const viewW = canvas.width / cameraRef.current.zoom
        const viewH = canvas.height / cameraRef.current.zoom
        cameraRef.current = { ...cameraRef.current, x: x - viewW / 2, y: y - viewH / 2 }
      },
      castAbility: (key: 'q' | 'e') => {
        if (phaseRef.current !== 'combat' || pausedRef.current) return
        const next = useHeroAbility(simRef.current, key)
        simRef.current = next
      },
      resetDay: () => {
        simRef.current = createSimState(combatRef.current, runRef.current)
        selectedIdsRef.current = []
        dragBoxRef.current = null
        endedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const resize = () => {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
      }
      const observer = new ResizeObserver(() => {
        window.requestAnimationFrame(resize)
      })
      observer.observe(container)
      resize()
      return () => observer.disconnect()
    }, [])

    const emitTelemetry = (time: number) => {
      if (!onTelemetryRef.current) return
      if (time - lastTelemetryAt.current < 120) return
      const sim = simRef.current
      const enemiesRemaining = sim.entities.filter((entity) => entity.team === 'enemy').length
      const hq = sim.entities.find((entity) => entity.kind === 'hq')
      const hero = sim.entities.find((entity) => entity.kind === 'hero')
      const qReadyIn = Math.max(0, sim.heroAbilityCooldowns.q - sim.time)
      const eReadyIn = Math.max(0, sim.heroAbilityCooldowns.e - sim.time)
      const playerUnits = sim.entities
        .filter((entity) => entity.team === 'player' && entity.kind !== 'hq')
        .map((entity) => ({
          x: entity.pos.x,
          y: entity.pos.y,
          kind: entity.kind === 'hero' ? 'hero' : 'unit'
        }))
      const enemyUnits = sim.entities
        .filter((entity) => entity.team === 'enemy')
        .map((entity) => ({ x: entity.pos.x, y: entity.pos.y }))
      const canvas = canvasRef.current
      const camera = cameraRef.current
      const viewW = canvas ? canvas.width / camera.zoom : 0
      const viewH = canvas ? canvas.height / camera.zoom : 0
      const payload: CanvasTelemetry = {
        waveIndex: sim.waveIndex,
        waveCount: sim.combat.waves.length,
        enemiesRemaining,
        hqHp: hq?.hp ?? 0,
        hqMaxHp: hq?.maxHp ?? 0,
        heroHp: hero?.hp ?? 0,
        heroMaxHp: hero?.maxHp ?? 0,
        qReadyIn,
        eReadyIn,
        camera: { x: camera.x, y: camera.y, zoom: camera.zoom, viewW, viewH },
        playerUnits,
        enemyUnits
      }
      const last = lastTelemetryRef.current
      if (!last || JSON.stringify(last) !== JSON.stringify(payload)) {
        lastTelemetryRef.current = payload
        onTelemetryRef.current(payload)
      }
      lastTelemetryAt.current = time
    }

    const emitSelection = () => {
      if (!onSelectionRef.current) return
      const selectedIds = selectedIdsRef.current
      if (selectedIds.length === 0) {
        onSelectionRef.current({ kind: 'none' })
        return
      }
      if (selectedIds.length > 1) {
        const units = selectedIds
          .map((id) => {
            const entity = simRef.current.entities.find((entry) => entry.id === id)
            if (!entity) return null
            const def = entity.kind === 'hero' ? { name: combatRef.current.hero.name } : UNIT_DEFS[entity.kind]
            return { id, name: def.name, hp: entity.hp, maxHp: entity.maxHp }
          })
          .filter(Boolean) as Array<{ id: string; name: string; hp: number; maxHp: number }>
        onSelectionRef.current({ kind: 'multi', units })
        return
      }
      const entity = simRef.current.entities.find((entry) => entry.id === selectedIds[0])
      if (!entity || entity.kind === 'hq') {
        onSelectionRef.current({ kind: 'none' })
        return
      }
      if (entity.kind === 'hero') {
        onSelectionRef.current({
          kind: 'hero',
          id: entity.id,
          name: combatRef.current.hero.name,
          description: combatRef.current.hero.description,
          hp: entity.hp,
          maxHp: entity.maxHp
        })
      } else {
        const def = UNIT_DEFS[entity.kind]
        onSelectionRef.current({
          kind: 'unit',
          id: entity.id,
          name: def.name,
          description: def.description,
          hp: entity.hp,
          maxHp: entity.maxHp
        })
      }
    }

    useEffect(() => {
      const handleKey = (event: KeyboardEvent) => {
        if (inputBlocked) return
        if (event.key === 'Escape') {
          if (phaseRef.current === 'combat' && onPauseToggleRef.current) {
            onPauseToggleRef.current()
          }
          return
        }
        if (event.key.toLowerCase() === 'a') {
          commandModeRef.current = 'attackMove'
        }
        if (event.key.toLowerCase() === 's') {
          issueToSelected({ type: 'stop' })
        }
        if ((event.key === 'q' || event.key === 'Q') && phaseRef.current === 'combat' && !pausedRef.current) {
          const next = useHeroAbility(simRef.current, 'q')
          simRef.current = next
        }
        if ((event.key === 'e' || event.key === 'E') && phaseRef.current === 'combat' && !pausedRef.current) {
          const next = useHeroAbility(simRef.current, 'e')
          simRef.current = next
        }
        if (event.ctrlKey && ['1', '2', '3'].includes(event.key)) {
          const key = Number(event.key)
          controlGroupsRef.current[key] = [...selectedIdsRef.current]
        }
        if (!event.ctrlKey && ['1', '2', '3'].includes(event.key)) {
          const group = controlGroupsRef.current[Number(event.key)]
          if (group) {
            selectedIdsRef.current = group
            emitSelection()
          }
        }
        if (event.key === 'ArrowUp') {
          cameraRef.current = { ...cameraRef.current, y: cameraRef.current.y - 40 }
        }
        if (event.key === 'ArrowDown') {
          cameraRef.current = { ...cameraRef.current, y: cameraRef.current.y + 40 }
        }
        if (event.key === 'ArrowLeft') {
          cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x - 40 }
        }
        if (event.key === 'ArrowRight') {
          cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x + 40 }
        }
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }, [inputBlocked])

    const issueToSelected = (order: Order) => {
      if (selectedIdsRef.current.length === 0) return
      const updated = issueOrder(simRef.current, selectedIdsRef.current, order, gridRef.current)
      simRef.current = updated
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

        if (!pausedRef.current) {
          while (acc >= FIXED_DT) {
            const next = stepSim(simRef.current, FIXED_DT, gridRef.current, phaseRef.current === 'combat' ? 'combat' : 'build')
            simRef.current = next
            acc -= FIXED_DT
            if (next.status !== 'running' && !endedRef.current) {
              endedRef.current = true
              const result = buildCombatResult(next)
              onCompleteRef.current(result)
            }
          }
        }

        const clamped = clampCamera(cameraRef.current, canvas.width, canvas.height, combatRef.current.map.width, combatRef.current.map.height)
        cameraRef.current = clamped
        renderScene(ctx, simRef.current, clamped, selectedIdsRef.current, gridRef.current, {
          pads: padsRef.current,
          buildings: buildingsRef.current,
          hoveredPadId: hoveredPadIdRef.current,
          selectedPadId: selectedPadRef.current
        })

        const dragBox = dragBoxRef.current
        if (dragBox) {
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1
          const start = dragBox.start
          const end = dragBox.end
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
        }

        emitTelemetry(time)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }, [])

    const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (inputBlocked) return
      if (event.button !== 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const start = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      dragMovedRef.current = false
      dragBoxRef.current = { start, end: start }
    }

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (inputBlocked) return
      const rect = event.currentTarget.getBoundingClientRect()
      const end = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const dragBox = dragBoxRef.current
      if (dragBox) {
        if (!dragMovedRef.current) {
          const dx = Math.abs(end.x - dragBox.start.x)
          const dy = Math.abs(end.y - dragBox.start.y)
          if (dx > 6 || dy > 6) dragMovedRef.current = true
        }
        dragBoxRef.current = { ...dragBox, end }
        return
      }

      const world = screenToWorld({ x: end.x, y: end.y }, cameraRef.current)
      const pad = padsRef.current.find((entry) => hitTestPad(entry, world)) ?? null
      hoveredPadIdRef.current = pad ? pad.id : null
    }

    const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (inputBlocked) return
      if (event.button !== 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const end = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const dragBox = dragBoxRef.current
      if (!dragBox) return
      const { start } = dragBox
      const dx = Math.abs(end.x - start.x)
      const dy = Math.abs(end.y - start.y)
      const wasDrag = dragMovedRef.current

      if (!wasDrag && dx < 6 && dy < 6) {
        const world = screenToWorld({ x: end.x, y: end.y }, cameraRef.current)
        const pad = padsRef.current.find((entry) => hitTestPad(entry, world))
        if (pad) {
          if (phaseRef.current === 'build') {
            onPadClickRef.current(pad.id)
          } else {
            onPadBlockedRef.current()
          }
          dragBoxRef.current = null
          return
        }
        const hqTarget = getHqAt(simRef.current.entities, world)
        if (hqTarget) {
          selectedIdsRef.current = []
          emitSelection()
          dragBoxRef.current = null
          return
        }

        const playerTarget = getEntityAt(simRef.current.entities, world, 'player')

      if (playerTarget) {
        if (selectedIdsRef.current.length === 1 && selectedIdsRef.current[0] === playerTarget.id) {
          selectedIdsRef.current = []
        } else {
          selectedIdsRef.current = [playerTarget.id]
        }
        emitSelection()
      } else if (selectedIdsRef.current.length > 0) {
          const orderType = commandModeRef.current === 'attackMove' ? 'attackMove' : 'move'
          issueToSelected({ type: orderType, targetPos: world })
          commandModeRef.current = 'move'
        } else {
          selectedIdsRef.current = []
          emitSelection()
        }
      } else {
        const minX = Math.min(start.x, end.x)
        const maxX = Math.max(start.x, end.x)
        const minY = Math.min(start.y, end.y)
        const maxY = Math.max(start.y, end.y)
        const selected = simRef.current.entities.filter((entity) => {
          if (entity.team !== 'player' || entity.kind === 'hq') return false
          const screen = {
            x: (entity.pos.x - cameraRef.current.x) * cameraRef.current.zoom,
            y: (entity.pos.y - cameraRef.current.y) * cameraRef.current.zoom
          }
          return screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY
        })
        selectedIdsRef.current = selected.map((entity) => entity.id)
        emitSelection()
      }

      dragBoxRef.current = null
    }

    const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (inputBlocked) return
      event.preventDefault()
      if (selectedIdsRef.current.length === 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const world = screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, cameraRef.current)

      const enemy = getEntityAt(simRef.current.entities, world, 'enemy')
      if (enemy) {
        issueToSelected({ type: 'attack', targetId: enemy.id, targetPos: { ...enemy.pos } })
      } else {
        const orderType = commandModeRef.current === 'attackMove' ? 'attackMove' : 'move'
        issueToSelected({ type: orderType, targetPos: world })
        commandModeRef.current = 'move'
      }
    }

    const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
      if (inputBlocked) return
      event.preventDefault()
      cameraRef.current = {
        ...cameraRef.current,
        zoom: Math.min(1.6, Math.max(0.6, cameraRef.current.zoom - event.deltaY * 0.001))
      }
    }

    const label = useMemo(() => (phase === 'combat' ? 'Combat' : 'Build'), [phase])

    return (
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
          onMouseLeave={() => {
            hoveredPadIdRef.current = null
          }}
          aria-label={`RTS canvas ${label}`}
        />
      </div>
    )
  })
)

CanvasLayer.displayName = 'CanvasLayer'
