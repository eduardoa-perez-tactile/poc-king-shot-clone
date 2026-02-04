import React, { useEffect, useMemo, useState } from 'react'
import { BuildingId, BUILDING_DEFS } from '../../config/buildings'
import { LEVELS } from '../../config/levels'
import { UNIT_DEFS } from '../../config/units'
import { getIncomeBreakdown, getSquadCap } from '../../run/economy'
import { useRunStore } from '../../run/store'
import { buildCombatDefinition } from '../../rts/combat'
import { RTSGame } from '../../rts/RTSGame'
import { BuildPanel } from './BuildPanel'
import { BuildingPanel } from './BuildingPanel'
import { DayEndOverlay } from './DayEndOverlay'
import { Toast, ToastStack } from './ToastStack'

const formatNumber = (value: number) => value.toLocaleString()

export const LevelRun: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const {
    activeRun,
    runPhase,
    buyBuilding,
    upgradeBuilding,
    buySquad,
    startCombat,
    resolveCombat,
    startNewDay
  } = useRunStore()
  const [panel, setPanel] = useState<{ padId: string; mode: 'build' | 'details' } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  if (!activeRun) return null
  const level = LEVELS.find((entry) => entry.id === activeRun.levelId)
  if (!level) return null

  const combatDefinition = buildCombatDefinition(activeRun)
  const squadCap = getSquadCap(activeRun)

  const buildingByPad = useMemo(() => {
    return new Map(activeRun.buildings.map((building) => [building.padId, building]))
  }, [activeRun.buildings])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random()}`
    setToasts((prev) => [...prev, { ...toast, id }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 2600)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }

  const handlePadClick = (padId: string) => {
    if (runPhase !== 'build') {
      addToast({ message: 'Cannot build during combat.' })
      return
    }
    const existing = buildingByPad.get(padId)
    setPanel({ padId, mode: existing ? 'details' : 'build' })
  }

  const handleBuild = (padId: string, buildingId: BuildingId) => {
    const cost = BUILDING_DEFS[buildingId].baseCost
    if (activeRun.gold < cost) {
      addToast({ message: 'Not enough gold.' })
      return
    }
    buyBuilding(buildingId, padId)
    setPanel(null)
  }

  const handleUpgrade = (padId: string) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const def = BUILDING_DEFS[building.id]
    if (building.level >= def.maxLevel) {
      addToast({ message: 'Building already at max level.' })
      return
    }
    const cost = Math.floor(def.upgradeBase * Math.pow(def.upgradeScale, building.level))
    if (activeRun.gold < cost) {
      addToast({ message: 'Not enough gold.' })
      return
    }
    upgradeBuilding(padId)
    setPanel(null)
  }

  const handleRecruit = (padId: string) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const def = BUILDING_DEFS[building.id]
    if (!def.unlocksUnit) return
    const unit = UNIT_DEFS[def.unlocksUnit]
    if (activeRun.unitRoster.length >= squadCap) {
      addToast({ message: 'Squad cap reached.' })
      return
    }
    if (activeRun.gold < unit.baseCost) {
      addToast({ message: 'Not enough gold.' })
      return
    }
    buySquad(def.unlocksUnit)
  }

  useEffect(() => {
    if (!panel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  useEffect(() => {
    if (runPhase !== 'build') {
      setPanel(null)
    }
  }, [runPhase])

  const phaseLabel = runPhase === 'combat' ? 'Combat' : runPhase === 'day_end' ? 'Day End' : 'Build'
  const dayIncome = activeRun.lastIncome ?? getIncomeBreakdown(activeRun, 0)
  const activePad = panel ? level.buildingPads.find((pad) => pad.id === panel.padId) ?? null : null
  const activeBuilding = panel ? buildingByPad.get(panel.padId) ?? null : null

  return (
    <div className="level-run">
      <div className="top-bar">
        <div>
          <h2>{level.name}</h2>
          <div className="muted">Day {activeRun.dayNumber} · Gold {formatNumber(activeRun.gold)} · {phaseLabel}</div>
        </div>
        <div className="top-actions">
          <button className="btn success" onClick={startCombat} disabled={runPhase !== 'build'}>
            Battle Cry
          </button>
          <button className="btn ghost" onClick={onExit}>Exit</button>
        </div>
      </div>

      <div className="map-stage">
        <RTSGame
          combat={combatDefinition}
          run={activeRun}
          phase={runPhase === 'combat' ? 'combat' : 'build'}
          buildingPads={level.buildingPads}
          buildings={activeRun.buildings}
          onPadClick={handlePadClick}
          onPadBlocked={() => addToast({ message: 'Cannot build during combat.' })}
          onComplete={(result) =>
            resolveCombat({
              victory: result.victory,
              lostSquadIds: result.lostSquadIds,
              bossDefeated: result.bossDefeated,
              hqHpPercent: result.hqHpPercent
            })
          }
          onExit={onExit}
        />

        {panel && activePad && panel.mode === 'build' && (
          <BuildPanel
            pad={activePad}
            gold={activeRun.gold}
            onBuild={(buildingId) => handleBuild(activePad.id, buildingId)}
            onClose={() => setPanel(null)}
          />
        )}

        {panel && activeBuilding && panel.mode === 'details' && (
          <BuildingPanel
            building={activeBuilding}
            gold={activeRun.gold}
            squadCount={activeRun.unitRoster.length}
            squadCap={squadCap}
            onUpgrade={() => handleUpgrade(activeBuilding.padId)}
            onRecruit={() => handleRecruit(activeBuilding.padId)}
            onClose={() => setPanel(null)}
          />
        )}

        {runPhase === 'day_end' && (
          <DayEndOverlay
            dayNumber={activeRun.dayNumber}
            breakdown={dayIncome}
            onNextDay={startNewDay}
          />
        )}

        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  )
}
