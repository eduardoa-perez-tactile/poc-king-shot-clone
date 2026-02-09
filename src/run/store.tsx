import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LEVELS, getLevelById } from '../config/levels'
import { getBuildingUnlockLevel, getPadUnlockLevel, getStrongholdMaxLevel } from '../config/stronghold'
import { UnitType } from '../config/units'
import { loadSave, saveGame, clearSave } from '../storage/runSave'
import { getBuildingPurchaseCost, getBuildingUpgradeCost, getUnitCost } from './economy'
import {
  addBuilding,
  applyDayEndRewards,
  areGoalsComplete,
  buySquad,
  canBuildBuilding,
  canBuySquad,
  canUpgradeBuilding,
  canUpgradeStronghold,
  createInitialMeta,
  createRunState,
  getRunLevel,
  markBossDefeated,
  markHqHp,
  recomputeGoalsProgress,
  resetBuildingHp,
  upgradeStronghold,
  upgradeBuilding
} from './runState'
import { getBuildingMaxHp } from './economy'
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
  buyBuilding: (id: BuildingId, padId: string) => void
  upgradeBuilding: (padId: string) => void
  buySquad: (type: UnitType, spawnPos?: { x: number; y: number }, spawnPadId?: string) => void
  upgradeStronghold: () => void
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
  const [activeRun, setActiveRun] = useState<RunState | null>(() => normalizeRun(saved?.activeRun ?? null))
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

  const buyBuildingAction = (id: BuildingId, padId: string) => {
    if (!activeRun || runPhase !== 'build') return
    if (!canBuildBuilding(activeRun, id)) return
    const cost = getBuildingPurchaseCost(id)
    if (activeRun.gold < cost) return
    if (activeRun.buildings.some((building) => building.padId === padId)) return
    const next = recomputeGoalsProgress(
      { ...addBuilding(activeRun, id, padId), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(next)
  }

  const upgradeBuildingAction = (padId: string) => {
    if (!activeRun || runPhase !== 'build') return
    const current = activeRun.buildings.find((building) => building.padId === padId)
    if (!current) return
    const cost = getBuildingUpgradeCost(current.id, current.level + 1)
    if (activeRun.gold < cost) return
    if (!canUpgradeBuilding(activeRun, padId)) return
    const next = recomputeGoalsProgress(
      { ...upgradeBuilding(activeRun, padId), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(next)
  }

  const upgradeStrongholdAction = () => {
    if (!activeRun || runPhase !== 'build') return
    if (!canUpgradeStronghold(activeRun)) return
    const next = recomputeGoalsProgress(upgradeStronghold(activeRun), getRunLevel(activeRun))
    setActiveRun(next)
  }

  const buySquadAction = (type: UnitType, spawnPos?: { x: number; y: number }, spawnPadId?: string) => {
    if (!activeRun || runPhase !== 'build') return
    if (!canBuySquad(activeRun, type)) return
    const cost = getUnitCost(type)
    const next = recomputeGoalsProgress(
      { ...buySquad(activeRun, type, spawnPos, spawnPadId), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(next)
  }

  const startCombat = () => {
    if (!activeRun || runPhase !== 'build') return
    setRunPhase('combat')
  }

  const resolveCombat = (outcome: CombatOutcome) => {
    if (!activeRun) return
    const level = getRunLevel(activeRun)
    const updated = activeRun
    const withBoss = outcome.bossDefeated ? markBossDefeated(updated, updated.dayNumber) : updated
    const withHp = markHqHp(withBoss, withBoss.dayNumber, outcome.hqHpPercent)
    const daysSurvived = outcome.victory ? Math.max(withHp.daysSurvived, withHp.dayNumber) : withHp.daysSurvived
    const runWithDays = { ...withHp, daysSurvived }
    const healedBuildings = outcome.victory ? resetBuildingHp(runWithDays) : runWithDays
    const paid = outcome.victory ? applyDayEndRewards(healedBuildings, level) : { run: healedBuildings, breakdown: undefined }
    const next = recomputeGoalsProgress(paid.run, level)
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
    let next = recomputeGoalsProgress(activeRun, level)
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
    const growth = level.heroLoadout.growthPerDay ?? { hp: 0, attack: 0 }
    const heroProgress = next.heroProgress ?? { hp: 0, attack: 0 }
    next = {
      ...next,
      dayNumber: next.dayNumber + 1,
      heroProgress: { hp: heroProgress.hp + growth.hp, attack: heroProgress.attack + growth.attack }
    }
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
    upgradeStronghold: upgradeStrongholdAction,
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

const normalizeRun = (run: RunState | null): RunState | null => {
  if (!run) return null
  const level = getLevelById(run.levelId)
  if (!level) return run
  const usedPads = new Set<string>()
  const pads = level.buildingPads
  const buildings = run.buildings.map((building, index) => {
    if ('padId' in building && building.padId) {
      usedPads.add(building.padId)
      const maxHp = (building as typeof building & { maxHp?: number }).maxHp
      if (typeof maxHp === 'number') {
        return building
      }
      const nextMax = getBuildingMaxHp(building.id, building.level)
      return { ...building, hp: nextMax, maxHp: nextMax }
    }
    const preferred = pads.find((pad) => !usedPads.has(pad.id) && pad.allowedTypes.includes(building.id))
    const fallback = pads.find((pad) => !usedPads.has(pad.id)) ?? pads[0]
    const padId = preferred?.id ?? fallback?.id ?? `pad_${index}`
    usedPads.add(padId)
    const nextMax = getBuildingMaxHp(building.id, building.level)
    return { ...building, padId, hp: nextMax, maxHp: nextMax }
  })
  const heroProgress = run.heroProgress ?? { hp: 0, attack: 0 }
  const minStronghold = run.buildings.reduce((acc, building) => {
    const buildingLevel = getBuildingUnlockLevel(building.id)
    const padLevel = getPadUnlockLevel(building.padId)
    return Math.max(acc, buildingLevel, padLevel)
  }, 1)
  const strongholdLevel = Math.min(getStrongholdMaxLevel(), Math.max(run.strongholdLevel ?? 1, minStronghold))
  const strongholdUpgradeInProgress = run.strongholdUpgradeInProgress ?? null
  return { ...run, buildings, heroProgress, strongholdLevel, strongholdUpgradeInProgress }
}
