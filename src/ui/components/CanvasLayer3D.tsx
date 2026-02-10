import React, { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { buildCombatResult, createGridForCombat, createSimState, issueOrder, stepSim, useHeroAbility } from '../../rts/sim'
import type { Camera } from '../../rts/render'
import { pickAt, pickPadAt, pickUnitAt } from '../../rts/input/input3d'
import { initRenderer3D, type Renderer3D } from '../../rts/render3d'
import { CameraController } from '../../rts/CameraController'
import type { Order, SimState } from '../../rts/types'
import { UNIT_DEFS } from '../../config/units'
import type { Grid } from '../../rts/pathfinding'
import type { CanvasHandle, CanvasLayerProps, CanvasTelemetry } from './CanvasLayer.types'

const FIXED_DT = 1 / 30
type CanvasWithRendererMarker = HTMLCanvasElement & { __rts3dDispose?: () => void }

export const CanvasLayer3D = React.memo(
  React.forwardRef<CanvasHandle, CanvasLayerProps>(({
    combat,
    run,
    phase,
    resetOnBuild,
    buildingPads,
    buildings,
    inputBlocked,
    onPadClick,
    onPadBlocked,
    onPadLocked,
    onComplete,
    onSelectionChange,
    onTelemetry,
    onPauseToggle,
    paused,
    selectedPadId,
    padUnlockLevels,
    showUnitLabels,
    onEliteWarning
  }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const dragBoxRef = useRef<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)
    const dragBoxElRef = useRef<HTMLDivElement>(null)
    const dragMovedRef = useRef(false)
    const activePointerIdRef = useRef<number | null>(null)
    const rendererRef = useRef<Renderer3D | null>(null)

    const simRef = useRef<SimState>(createSimState(combat, run))
    const gridRef = useRef<Grid>(createGridForCombat(combat))
    const rafRef = useRef<number | null>(null)
    const loopTokenRef = useRef(0)
    const selectedIdsRef = useRef<string[]>([])
    const strongholdSelectedRef = useRef(false)
    const hoveredPadIdRef = useRef<string | null>(null)
    const hoveredHqRef = useRef(false)
    const cameraControllerRef = useRef<CameraController | null>(null)
    const commandModeRef = useRef<'move' | 'attackMove'>('move')
    const controlGroupsRef = useRef<Record<number, string[]>>({})
    const phaseRef = useRef(phase)
    const pausedRef = useRef(Boolean(paused))
    const endedRef = useRef(false)
    const padsRef = useRef(buildingPads)
    const buildingsRef = useRef(buildings)
    const selectedPadRef = useRef<string | null>(selectedPadId ?? null)
    const padUnlockLevelsRef = useRef<Record<string, number> | undefined>(padUnlockLevels)
    const onPadClickRef = useRef(onPadClick)
    const onPadBlockedRef = useRef(onPadBlocked)
    const onPadLockedRef = useRef(onPadLocked)
    const onCompleteRef = useRef(onComplete)
    const onSelectionRef = useRef(onSelectionChange)
    const onTelemetryRef = useRef(onTelemetry)
    const onPauseToggleRef = useRef(onPauseToggle)
    const onEliteWarningRef = useRef(onEliteWarning)
    const inputBlockedRef = useRef(Boolean(inputBlocked))
    const lastTelemetryRef = useRef<CanvasTelemetry | null>(null)
    const lastTelemetryAt = useRef(0)
    const lastWaveIndexRef = useRef(0)
    const dayRef = useRef(combat.dayNumber)
    const combatRef = useRef(combat)
    const runRef = useRef(run)
    const showLabelsRef = useRef(Boolean(showUnitLabels))

    useEffect(() => {
      padsRef.current = buildingPads
      buildingsRef.current = buildings
      selectedPadRef.current = selectedPadId ?? null
      padUnlockLevelsRef.current = padUnlockLevels
    }, [buildingPads, buildings, selectedPadId, padUnlockLevels])

    useEffect(() => {
      onPadClickRef.current = onPadClick
      onPadBlockedRef.current = onPadBlocked
      onPadLockedRef.current = onPadLocked
      onCompleteRef.current = onComplete
      onSelectionRef.current = onSelectionChange
      onTelemetryRef.current = onTelemetry
      onPauseToggleRef.current = onPauseToggle
    }, [onPadClick, onPadBlocked, onPadLocked, onComplete, onSelectionChange, onTelemetry, onPauseToggle])

    useEffect(() => {
      onEliteWarningRef.current = onEliteWarning
    }, [onEliteWarning])

    useEffect(() => {
      inputBlockedRef.current = Boolean(inputBlocked)
    }, [inputBlocked])

    useEffect(() => {
      showLabelsRef.current = Boolean(showUnitLabels)
    }, [showUnitLabels])

    useEffect(() => {
      pausedRef.current = Boolean(paused)
    }, [paused])

    useEffect(() => {
      combatRef.current = combat
      gridRef.current = createGridForCombat(combat)
      rendererRef.current?.setMap(combat.map)
      cameraControllerRef.current?.setMapBounds({
        minX: 0,
        maxX: combat.map.width,
        minZ: 0,
        maxZ: combat.map.height
      })
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
        lastWaveIndexRef.current = simRef.current.waveIndex
        endedRef.current = false
        strongholdSelectedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }, [run])

    useEffect(() => {
      if (combat.dayNumber !== dayRef.current) {
        simRef.current = createSimState(combat, run)
        selectedIdsRef.current = []
        dragBoxRef.current = null
        dayRef.current = combat.dayNumber
        lastWaveIndexRef.current = simRef.current.waveIndex
        endedRef.current = false
        strongholdSelectedRef.current = false
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
        lastWaveIndexRef.current = simRef.current.waveIndex
        selectedIdsRef.current = []
        dragBoxRef.current = null
        endedRef.current = false
        strongholdSelectedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
      if (prev === 'combat' && phase === 'build') {
        const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
        simRef.current = createSimState(combat, run, {
          heroPos: hero ? { ...hero.pos } : combat.map.playerSpawn,
          heroHp: resetOnBuild ? undefined : hero?.hp
        })
        lastWaveIndexRef.current = simRef.current.waveIndex
        selectedIdsRef.current = []
        dragBoxRef.current = null
        endedRef.current = false
        strongholdSelectedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }, [phase, combat, resetOnBuild, run])

    useImperativeHandle(ref, () => ({
      panTo: (x: number, y: number) => {
        cameraControllerRef.current?.focusOn(x, y)
      },
      castAbility: (key: 'q' | 'e') => {
        if (phaseRef.current !== 'combat' || pausedRef.current) return
        const next = useHeroAbility(simRef.current, key)
        simRef.current = next
      },
      resetDay: () => {
        simRef.current = createSimState(combatRef.current, runRef.current)
        lastWaveIndexRef.current = simRef.current.waveIndex
        selectedIdsRef.current = []
        dragBoxRef.current = null
        endedRef.current = false
        strongholdSelectedRef.current = false
        onSelectionRef.current?.({ kind: 'none' })
      }
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const canvasWithMarker = canvas as CanvasWithRendererMarker
      if (canvasWithMarker.__rts3dDispose) {
        canvasWithMarker.__rts3dDispose()
        delete canvasWithMarker.__rts3dDispose
      }
      const renderer = initRenderer3D(canvas, combatRef.current.map)
      rendererRef.current = renderer
      const controller = new CameraController({
        scene: renderer.scene,
        camera: renderer.camera,
        canvas,
        bounds: {
          minX: 0,
          maxX: combatRef.current.map.width,
          minZ: 0,
          maxZ: combatRef.current.map.height
        },
        target: () => {
          const hero = simRef.current.entities.find((entity) => entity.kind === 'hero')
          return hero ? { x: hero.pos.x, z: hero.pos.y } : null
        }
      })
      cameraControllerRef.current = controller

      const dispose = () => {
        controller.dispose()
        cameraControllerRef.current = null
        renderer.dispose()
        rendererRef.current = null
      }

      canvasWithMarker.__rts3dDispose = dispose
      return () => {
        if (canvasWithMarker.__rts3dDispose === dispose) {
          delete canvasWithMarker.__rts3dDispose
        }
        dispose()
      }
    }, [])

    useEffect(() => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const resize = () => {
        const width = Math.max(1, Math.floor(container.clientWidth))
        const height = Math.max(1, Math.floor(container.clientHeight))
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        rendererRef.current?.resize(width, height)
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
      const renderer = rendererRef.current
      const renderCamera = renderer?.camera
      const viewPolygon = renderer?.getViewPolygon() ?? null
      let viewW = renderCamera ? Math.abs(renderCamera.orthoRight - renderCamera.orthoLeft) : 0
      let viewH = renderCamera ? Math.abs(renderCamera.orthoTop - renderCamera.orthoBottom) : 0
      let viewX = renderCamera?.target.x ?? 0
      let viewY = renderCamera?.target.z ?? 0
      if (viewW > 0) viewX -= viewW / 2
      if (viewH > 0) viewY -= viewH / 2
      if (viewPolygon && viewPolygon.length > 0) {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        viewPolygon.forEach((point) => {
          minX = Math.min(minX, point.x)
          maxX = Math.max(maxX, point.x)
          minY = Math.min(minY, point.y)
          maxY = Math.max(maxY, point.y)
        })
        if (Number.isFinite(minX) && Number.isFinite(minY)) {
          viewX = minX
          viewY = minY
          if (Number.isFinite(maxX) && Number.isFinite(maxY)) {
            // Overwrite with AABB from the polygon for fallback sizing.
            viewW = maxX - minX
            viewH = maxY - minY
          }
        }
      }
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
        camera: { x: viewX, y: viewY, zoom: 1, viewW, viewH, viewPolygon: viewPolygon ?? undefined },
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
      if (strongholdSelectedRef.current) {
        onSelectionRef.current({ kind: 'stronghold' })
        return
      }
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
            const def =
              entity.kind === 'hero'
                ? { name: entity.heroName ?? combatRef.current.hero.name }
                : UNIT_DEFS[entity.kind]
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
          name: entity.heroName ?? combatRef.current.hero.name,
          description: entity.heroDescription ?? combatRef.current.hero.description,
          hp: entity.hp,
          maxHp: entity.maxHp,
          attack: entity.attack,
          range: entity.range,
          speed: entity.speed,
          cooldown: entity.cooldown
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
      }
      window.addEventListener('keydown', handleKey)
      return () => window.removeEventListener('keydown', handleKey)
    }, [inputBlocked])

    const issueToSelected = (order: Order) => {
      if (selectedIdsRef.current.length === 0) return
      const eligible = selectedIdsRef.current.filter((id) => {
        const entity = simRef.current.entities.find((entry) => entry.id === id)
        return entity?.team === 'player' && entity.kind !== 'hq'
      })
      if (eligible.length === 0) return
      const updated = issueOrder(simRef.current, eligible, order, gridRef.current)
      simRef.current = updated
    }

    const updateDragBox = (box: { start: { x: number; y: number }; end: { x: number; y: number } } | null) => {
      const el = dragBoxElRef.current
      if (!el) return
      if (!box) {
        el.style.display = 'none'
        return
      }
      const left = Math.min(box.start.x, box.end.x)
      const top = Math.min(box.start.y, box.end.y)
      const width = Math.abs(box.end.x - box.start.x)
      const height = Math.abs(box.end.y - box.start.y)
      el.style.display = 'block'
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.width = `${width}px`
      el.style.height = `${height}px`
    }

    const processPointerUp = (clientX: number, clientY: number) => {
      if (inputBlockedRef.current) return
      const renderer = rendererRef.current
      const canvas = canvasRef.current
      if (!renderer || !canvas) return
      const rect = canvas.getBoundingClientRect()
      const end = { x: clientX - rect.left, y: clientY - rect.top }
      const dragBox = dragBoxRef.current
      const start = dragBox?.start ?? end
      const dx = Math.abs(end.x - start.x)
      const dy = Math.abs(end.y - start.y)
      const wasDrag = dragBox ? dragMovedRef.current : false

      if (!wasDrag && dx < 6 && dy < 6) {
        let pick = pickUnitAt(renderer.getPickContext(), end.x, end.y)
        if (pick.kind === 'none') {
          const padId = pickPadAt(renderer.getPickContext(), end.x, end.y)
          if (padId) {
            pick = { kind: 'pad', padId }
          } else {
            pick = pickAt(renderer.getPickContext(), end.x, end.y)
          }
        }
        if (pick.kind === 'pad') {
          if (phaseRef.current === 'build') {
            const unlockLevel = padUnlockLevelsRef.current?.[pick.padId] ?? 1
            if (runRef.current.strongholdLevel < unlockLevel) {
              onPadLockedRef.current?.(pick.padId)
            } else {
              strongholdSelectedRef.current = false
              onPadClickRef.current(pick.padId)
            }
          } else {
            onPadBlockedRef.current()
          }
          dragBoxRef.current = null
          updateDragBox(null)
          return
        }
        if (pick.kind === 'hq') {
          selectedIdsRef.current = []
          strongholdSelectedRef.current = true
          emitSelection()
          dragBoxRef.current = null
          updateDragBox(null)
          return
        }
        if (pick.kind === 'unit') {
          const entity = simRef.current.entities.find((entry) => entry.id === pick.entityId)
          if (entity?.team === 'player') {
            strongholdSelectedRef.current = false
            if (selectedIdsRef.current.length === 1 && selectedIdsRef.current[0] === entity.id) {
              selectedIdsRef.current = []
            } else {
              selectedIdsRef.current = [entity.id]
            }
            emitSelection()
            dragBoxRef.current = null
            updateDragBox(null)
            return
          }
          if (entity?.team === 'enemy') {
            const hasPlayerSelection = selectedIdsRef.current.some((id) => {
              const selected = simRef.current.entities.find((entry) => entry.id === id)
              return selected?.team === 'player' && selected.kind !== 'hq'
            })
            if (hasPlayerSelection) {
              issueToSelected({ type: 'attack', targetId: entity.id, targetPos: { ...entity.pos } })
              commandModeRef.current = 'move'
            } else {
              selectedIdsRef.current = [entity.id]
              strongholdSelectedRef.current = false
              emitSelection()
            }
            dragBoxRef.current = null
            updateDragBox(null)
            return
          }
        }

        if (pick.kind === 'ground' || pick.kind === 'unit') {
          const targetPos = pick.kind === 'ground'
            ? pick.point
            : simRef.current.entities.find((entry) => entry.id === (pick.kind === 'unit' ? pick.entityId : ''))?.pos
          if (targetPos && selectedIdsRef.current.length > 0) {
            strongholdSelectedRef.current = false
            const orderType = commandModeRef.current === 'attackMove' ? 'attackMove' : 'move'
            issueToSelected({ type: orderType, targetPos: { ...targetPos } })
            commandModeRef.current = 'move'
          } else {
            strongholdSelectedRef.current = false
            selectedIdsRef.current = []
            emitSelection()
          }
        } else {
          strongholdSelectedRef.current = false
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
          const screen = renderer.projectToScreen(entity.pos)
          if (!screen) return false
          return screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY
        })
        selectedIdsRef.current = selected.map((entity) => entity.id)
        strongholdSelectedRef.current = false
        emitSelection()
      }

      dragBoxRef.current = null
      updateDragBox(null)
    }

    useEffect(() => {
      const loopToken = loopTokenRef.current + 1
      loopTokenRef.current = loopToken
      const loop = (time: number) => {
        if (loopTokenRef.current !== loopToken) return
        if (!pausedRef.current) {
          let acc = loopState.acc + (time - loopState.last) / 1000
          loopState.last = time
          while (acc >= FIXED_DT) {
            const next = stepSim(simRef.current, FIXED_DT, gridRef.current, phaseRef.current === 'combat' ? 'combat' : 'build')
            simRef.current = next
            if (next.waveIndex !== lastWaveIndexRef.current) {
              for (let i = lastWaveIndexRef.current; i < next.waveIndex; i += 1) {
                const wave = combatRef.current.waves[i]
                if (wave?.elite) {
                  const message = wave.elite === 'boss' ? 'BOSS WAVE!' : 'Mini Boss Approaching!'
                  onEliteWarningRef.current?.(message)
                }
              }
              lastWaveIndexRef.current = next.waveIndex
            }
            acc -= FIXED_DT
            if (next.status !== 'running' && !endedRef.current) {
              endedRef.current = true
              const result = buildCombatResult(next)
              onCompleteRef.current(result)
            }
          }
          loopState.acc = acc
        } else {
          loopState.last = time
        }

        const canvas = canvasRef.current
        const renderer = rendererRef.current
        if (canvas && renderer) {
          const renderCamera = renderer.camera
          const viewW = Math.abs(renderCamera.orthoRight - renderCamera.orthoLeft)
          const viewH = Math.abs(renderCamera.orthoTop - renderCamera.orthoBottom)
          const cameraState: Camera = {
            x: renderCamera.target.x - viewW / 2,
            y: renderCamera.target.z - viewH / 2,
            zoom: 1
          }
          renderer.update({
            sim: simRef.current,
            camera: cameraState,
            selection: selectedIdsRef.current,
            overlays: {
              pads: padsRef.current,
              buildings: buildingsRef.current,
              hoveredPadId: hoveredPadIdRef.current,
              hoveredHq: hoveredHqRef.current,
              selectedPadId: selectedPadRef.current,
              padUnlockLevels: padUnlockLevelsRef.current,
              strongholdLevel: runRef.current.strongholdLevel
            },
            options: { showLabels: showLabelsRef.current }
          })
          renderer.render()
        }

        emitTelemetry(time)
        rafRef.current = requestAnimationFrame(loop)
      }

      const loopState = { last: performance.now(), acc: 0 }
      rafRef.current = requestAnimationFrame(loop)
      return () => {
        loopTokenRef.current += 1
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }, [])

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (inputBlockedRef.current) return
      if (event.button !== 0) return
      const rect = event.currentTarget.getBoundingClientRect()
      const start = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      dragMovedRef.current = false
      dragBoxRef.current = { start, end: start }
      updateDragBox(dragBoxRef.current)
      activePointerIdRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (inputBlockedRef.current) return
      const canvas = canvasRef.current
      const renderer = rendererRef.current
      if (!canvas || !renderer) return
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
        updateDragBox(dragBoxRef.current)
        return
      }

      const padId = pickPadAt(renderer.getPickContext(), end.x, end.y)
      hoveredPadIdRef.current = padId
      const unitPick = pickUnitAt(renderer.getPickContext(), end.x, end.y)
      hoveredHqRef.current = unitPick.kind === 'hq'
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return
      if (activePointerIdRef.current !== event.pointerId) return
      processPointerUp(event.clientX, event.clientY)
      activePointerIdRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (inputBlocked) return
      event.preventDefault()
      if (selectedIdsRef.current.length === 0) return
      const renderer = rendererRef.current
      if (!renderer) return
      const rect = event.currentTarget.getBoundingClientRect()
      let pick = pickUnitAt(renderer.getPickContext(), event.clientX - rect.left, event.clientY - rect.top)
      if (pick.kind === 'none') {
        pick = pickAt(renderer.getPickContext(), event.clientX - rect.left, event.clientY - rect.top)
      }
      if (pick.kind === 'unit') {
        const enemy = simRef.current.entities.find((entry) => entry.id === pick.entityId && entry.team === 'enemy')
        if (enemy) {
          issueToSelected({ type: 'attack', targetId: enemy.id, targetPos: { ...enemy.pos } })
          return
        }
      }
      if (pick.kind === 'ground') {
        const orderType = commandModeRef.current === 'attackMove' ? 'attackMove' : 'move'
        issueToSelected({ type: orderType, targetPos: pick.point })
        commandModeRef.current = 'move'
        return
      }
      if (pick.kind === 'unit') {
        const entity = simRef.current.entities.find((entry) => entry.id === pick.entityId)
        if (entity) {
          const orderType = commandModeRef.current === 'attackMove' ? 'attackMove' : 'move'
          issueToSelected({ type: orderType, targetPos: { ...entity.pos } })
          commandModeRef.current = 'move'
        }
      }
    }

    const label = useMemo(() => (phase === 'combat' ? 'Combat' : 'Build'), [phase])

    return (
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            activePointerIdRef.current = null
            dragBoxRef.current = null
            hoveredHqRef.current = false
            updateDragBox(null)
          }}
          onContextMenu={handleContextMenu}
          onPointerLeave={() => {
            hoveredPadIdRef.current = null
            hoveredHqRef.current = false
            dragBoxRef.current = null
            updateDragBox(null)
          }}
          aria-label={`RTS canvas ${label}`}
        />
        <div
          ref={dragBoxElRef}
          style={{
            position: 'absolute',
            border: '1px solid #38bdf8',
            pointerEvents: 'none',
            display: 'none',
            left: 0,
            top: 0
          }}
        />
      </div>
    )
  })
)

CanvasLayer3D.displayName = 'CanvasLayer3D'
