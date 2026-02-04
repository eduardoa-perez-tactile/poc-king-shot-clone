import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LEVELS, getLevelById } from '../config/levels'
import { UnitType } from '../config/units'
import { loadSave, saveGame, clearSave } from '../storage/runSave'
import { getBuildingPurchaseCost, getBuildingUpgradeCost, getUnitCost } from './economy'
import {
  addBuilding,
  applyIncome,
  areGoalsComplete,
  buySquad,
  canBuySquad,
  canUpgradeBuilding,
  createInitialMeta,
  createRunState,
  getRunLevel,
  markBossDefeated,
  markHqHp,
  recomputeGoalsProgress,
  removeSquads,
  upgradeBuilding
} from './runState'
import { MetaState, RunPhase, RunState } from './types'
import { BuildingId } from '../config/buildings'

export interface CombatOutcome {
  victory: boolean
  lostSquadIds: string[]
  bossDefeated: boolean
  hqHpPercent: number
}

interface RunStore {
  meta: MetaState
  activeRun: RunState | null
  runPhase: RunPhase
  lastCombat?: CombatOutcome
  startRun: (levelId: string) => void
  abandonRun: () => void
  retryRun: () => void
  buyBuilding: (id: BuildingId) => void
  upgradeBuilding: (id: BuildingId) => void
  buySquad: (type: UnitType) => void
  startCombat: () => void
  resolveCombat: (outcome: CombatOutcome) => void
  startNewDay: () => void
  unlockLevel: (levelId: string) => void
  clearAll: () => void
}

const RunContext = createContext<RunStore | null>(null)

export const useRunStore = () => {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('RunStore not available')
  return ctx
}

const normalizeRunPhase = (phase: RunPhase): RunPhase => (phase === 'combat' ? 'build' : phase)

export const RunProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const saved = useMemo(() => loadSave(), [])
  const [meta, setMeta] = useState<MetaState>(() => saved?.meta ?? createInitialMeta())
  const [activeRun, setActiveRun] = useState<RunState | null>(() => saved?.activeRun ?? null)
  const [runPhase, setRunPhase] = useState<RunPhase>(() => (saved?.runPhase ? normalizeRunPhase(saved.runPhase) : 'build'))
  const [lastCombat, setLastCombat] = useState<CombatOutcome | undefined>(undefined)

  useEffect(() => {
    saveGame({ meta, activeRun, runPhase })
  }, [meta, activeRun, runPhase])

  const startRun = (levelId: string) => {
    const level = getLevelById(levelId)
    if (!level) return
    const run = recomputeGoalsProgress(createRunState(levelId), level)
    setActiveRun(run)
    setRunPhase('build')
    setLastCombat(undefined)
  }

  const abandonRun = () => {
    setActiveRun(null)
    setRunPhase('build')
    setLastCombat(undefined)
  }

  const retryRun = () => {
    if (!activeRun) return
    startRun(activeRun.levelId)
  }

  const buyBuildingAction = (id: BuildingId) => {
    if (!activeRun || runPhase !== 'build') return
    const cost = getBuildingPurchaseCost(id)
    if (activeRun.gold < cost) return
    if (activeRun.buildings.some((building) => building.id === id)) return
    const next = recomputeGoalsProgress(
      { ...addBuilding(activeRun, id), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(next)
  }

  const upgradeBuildingAction = (id: BuildingId) => {
    if (!activeRun || runPhase !== 'build') return
    const current = activeRun.buildings.find((building) => building.id === id)
    if (!current) return
    const cost = getBuildingUpgradeCost(id, current.level + 1)
    if (activeRun.gold < cost) return
    if (!canUpgradeBuilding(activeRun, id)) return
    const next = recomputeGoalsProgress(
      { ...upgradeBuilding(activeRun, id), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(next)
  }

  const buySquadAction = (type: UnitType) => {
    if (!activeRun || runPhase !== 'build') return
    if (!canBuySquad(activeRun, type)) return
    const cost = getUnitCost(type)
    const next = recomputeGoalsProgress(
      { ...buySquad(activeRun, type), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(next)
  }

  const startCombat = () => {
    if (!activeRun || runPhase !== 'build') return
    if (activeRun.unitRoster.length === 0) return
    setRunPhase('combat')
  }

  const resolveCombat = (outcome: CombatOutcome) => {
    if (!activeRun) return
    const level = getRunLevel(activeRun)
    const updated = removeSquads(activeRun, outcome.lostSquadIds)
    const withBoss = outcome.bossDefeated ? markBossDefeated(updated, updated.dayNumber) : updated
    const withHp = markHqHp(withBoss, withBoss.dayNumber, outcome.hqHpPercent)
    const daysSurvived = outcome.victory ? Math.max(withHp.daysSurvived, withHp.dayNumber) : withHp.daysSurvived
    const runWithDays = { ...withHp, daysSurvived }
    const next = recomputeGoalsProgress(runWithDays, level)
    setActiveRun(next)
    setLastCombat(outcome)
    if (outcome.victory) {
      setRunPhase('day_end')
    } else {
      setRunPhase('lose')
    }
  }

  const startNewDay = () => {
    if (!activeRun) return
    const level = getRunLevel(activeRun)
    const paid = applyIncome(activeRun)
    let next = recomputeGoalsProgress(paid.run, level)
    if (areGoalsComplete(next, level)) {
      setRunPhase('win')
      setActiveRun(next)
      setMeta((prev) => {
        const completed = prev.completedLevels.includes(level.id)
          ? prev.completedLevels
          : [...prev.completedLevels, level.id]
        const best = Math.max(prev.bestCompletion[level.id] ?? 0, next.daysSurvived)
        let unlockedLevels = prev.unlockedLevels
        const levelIndex = levelIndexById(level.id)
        const nextLevel = levelIndex >= 0 ? getLevelByIndex(levelIndex + 1) : null
        if (nextLevel && !unlockedLevels.includes(nextLevel.id)) {
          unlockedLevels = [...unlockedLevels, nextLevel.id]
        }
        return {
          ...prev,
          completedLevels: completed,
          bestCompletion: { ...prev.bestCompletion, [level.id]: best },
          unlockedLevels
        }
      })
      return
    }
    next = { ...next, dayNumber: next.dayNumber + 1 }
    setActiveRun(next)
    setRunPhase('build')
  }

  const unlockLevel = (levelId: string) => {
    setMeta((prev) => (prev.unlockedLevels.includes(levelId) ? prev : { ...prev, unlockedLevels: [...prev.unlockedLevels, levelId] }))
  }

  const clearAll = () => {
    clearSave()
    setMeta(createInitialMeta())
    setActiveRun(null)
    setRunPhase('build')
    setLastCombat(undefined)
  }

  const value: RunStore = {
    meta,
    activeRun,
    runPhase,
    lastCombat,
    startRun,
    abandonRun,
    retryRun,
    buyBuilding: buyBuildingAction,
    upgradeBuilding: upgradeBuildingAction,
    buySquad: buySquadAction,
    startCombat,
    resolveCombat,
    startNewDay,
    unlockLevel,
    clearAll
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

const levelIndexById = (id: string) => LEVELS.findIndex((level) => level.id === id)

const getLevelByIndex = (index: number) => LEVELS[index] ?? null
