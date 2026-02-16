import type { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Scene } from '@babylonjs/core/scene'
import React, { useEffect, useRef } from 'react'
import type { UnitHudEntity } from '../rts/render3d'
import { projectWorldToScreen } from './projectWorldToScreen'

interface UnitHudManager {
  getActiveUnits: () => readonly UnitHudEntity[]
}

export interface UnitHudRuntime {
  scene: Scene
  camera: BabylonCamera
  engine: Engine
  unitManager: UnitHudManager
}

interface NameplateEntry {
  root: HTMLDivElement
  topRow: HTMLDivElement
  hpRow: HTMLDivElement
  barFill: HTMLDivElement
  lastSeenToken: number
  lastTypeName: string
  lastLevel: number
  lastHp: number
  lastHpMax: number
  lastSelected: boolean
  lastX: number
  lastY: number
  visible: boolean
}

const createNameplate = (container: HTMLDivElement): NameplateEntry => {
  const root = document.createElement('div')
  root.style.position = 'absolute'
  root.style.left = '0'
  root.style.top = '0'
  root.style.pointerEvents = 'none'
  root.style.background = 'rgba(0,0,0,0.55)'
  root.style.border = '1px solid rgba(255,255,255,0.15)'
  root.style.borderRadius = '6px'
  root.style.padding = '2px 6px'
  root.style.font = '11px/1.2 system-ui'
  root.style.color = '#fff'
  root.style.whiteSpace = 'nowrap'
  root.style.display = 'none'
  root.style.willChange = 'transform'

  const topRow = document.createElement('div')
  const hpRow = document.createElement('div')
  hpRow.style.opacity = '0.92'

  const bar = document.createElement('div')
  bar.style.marginTop = '2px'
  bar.style.width = '100%'
  bar.style.height = '2px'
  bar.style.background = 'rgba(255,255,255,0.2)'
  bar.style.borderRadius = '999px'
  bar.style.overflow = 'hidden'

  const barFill = document.createElement('div')
  barFill.style.width = '100%'
  barFill.style.height = '100%'
  barFill.style.background = '#22c55e'
  barFill.style.transformOrigin = '0 50%'
  barFill.style.transform = 'scaleX(1)'
  bar.append(barFill)

  root.append(topRow)
  root.append(hpRow)
  root.append(bar)
  container.append(root)

  return {
    root,
    topRow,
    hpRow,
    barFill,
    lastSeenToken: -1,
    lastTypeName: '',
    lastLevel: -1,
    lastHp: -1,
    lastHpMax: -1,
    lastSelected: false,
    lastX: Number.NaN,
    lastY: Number.NaN,
    visible: false
  }
}

const hideNameplate = (entry: NameplateEntry) => {
  if (!entry.visible) return
  entry.visible = false
  entry.root.style.display = 'none'
}

const setSelectedVisual = (entry: NameplateEntry, selected: boolean) => {
  entry.root.style.borderColor = selected ? 'rgba(96,165,250,0.9)' : 'rgba(255,255,255,0.15)'
  entry.root.style.boxShadow = selected ? '0 0 0 1px rgba(96,165,250,0.45)' : 'none'
}

export const UnitHudLayer: React.FC<{ runtime: UnitHudRuntime | null }> = React.memo(({ runtime }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const entriesRef = useRef<Map<string, NameplateEntry>>(new Map())
  const frameTokenRef = useRef(0)

  useEffect(() => {
    if (runtime) return
    entriesRef.current.forEach((entry) => hideNameplate(entry))
  }, [runtime])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !runtime) return

    const update = () => {
      const renderWidth = runtime.engine.getRenderWidth()
      const renderHeight = runtime.engine.getRenderHeight()
      if (renderWidth <= 0 || renderHeight <= 0) return
      const cssWidth = Math.max(1, container.clientWidth)
      const cssHeight = Math.max(1, container.clientHeight)
      const scaleX = cssWidth / renderWidth
      const scaleY = cssHeight / renderHeight
      const token = (frameTokenRef.current += 1)
      const units = runtime.unitManager.getActiveUnits()

      for (let i = 0; i < units.length; i += 1) {
        const unit = units[i]
        let entry = entriesRef.current.get(unit.id)
        if (!entry) {
          entry = createNameplate(container)
          entriesRef.current.set(unit.id, entry)
        }
        entry.lastSeenToken = token

        const hp = Math.max(0, Math.round(unit.hp))
        const hpMax = Math.max(1, Math.round(unit.hpMax))
        if (!unit.isAlive || hp <= 0) {
          hideNameplate(entry)
          continue
        }

        const projected = projectWorldToScreen(
          unit.getHudWorldPosition(),
          runtime.camera,
          runtime.scene,
          runtime.engine
        )
        if (!projected.onScreen) {
          hideNameplate(entry)
          continue
        }

        const x = projected.x * scaleX
        const y = projected.y * scaleY
        if (!entry.visible) {
          entry.visible = true
          entry.root.style.display = 'block'
        }
        if (entry.lastX !== x || entry.lastY !== y) {
          entry.root.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`
          entry.lastX = x
          entry.lastY = y
        }

        if (entry.lastTypeName !== unit.typeName || entry.lastLevel !== unit.level) {
          entry.topRow.textContent = `${unit.typeName}  Lv ${unit.level}`
          entry.lastTypeName = unit.typeName
          entry.lastLevel = unit.level
        }

        if (entry.lastHp !== hp || entry.lastHpMax !== hpMax) {
          entry.hpRow.textContent = `${hp}/${hpMax}`
          entry.barFill.style.transform = `scaleX(${Math.max(0, Math.min(1, hp / hpMax))})`
          entry.lastHp = hp
          entry.lastHpMax = hpMax
        }

        const selected = Boolean(unit.isSelected)
        if (entry.lastSelected !== selected) {
          setSelectedVisual(entry, selected)
          entry.lastSelected = selected
        }
      }

      entriesRef.current.forEach((entry) => {
        if (entry.lastSeenToken !== token) hideNameplate(entry)
      })
    }

    const observer = runtime.scene.onAfterRenderObservable.add(update)
    return () => {
      runtime.scene.onAfterRenderObservable.remove(observer)
      entriesRef.current.forEach((entry) => hideNameplate(entry))
    }
  }, [runtime])

  useEffect(() => () => {
    entriesRef.current.forEach((entry) => entry.root.remove())
    entriesRef.current.clear()
  }, [])

  return <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden />
})

UnitHudLayer.displayName = 'UnitHudLayer'
