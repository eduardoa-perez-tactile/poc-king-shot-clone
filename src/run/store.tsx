import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getLevelById, getLevels } from '../config/levels'
import { EnemyTraitId, NightModifierId, PerkId } from '../config/nightContent'
import { HERO_RECRUIT_DEFS, HeroRecruitId } from '../config/heroes'
import { UnitType } from '../config/units'
import { isBuildingAllowedOnPad } from '../game/rules/progression'
import { loadSave, saveGame, clearSave } from '../storage/runSave'
import { getBuildingPurchaseCost, getUnitCost } from './economy'
import {
  addBuilding,
  applyDayEndRewards,
  applyNightGoldStartPenalty,
  applyPerkSelection,
  areGoalsComplete,
  buySquad,
  canBuildBuilding,
  canBuySquadFromBuilding,
  canUpgradeBuilding,
  canUpgradeStronghold,
  createInitialMeta,
  createRunState,
  getBuildingUpgradeCostForRun,
  getBuildingUnlockLevelForLevel,
  getPadUnlockLevelForRunLevel,
  getRunLevel,
  getStrongholdMaxLevelForLevel,
  markDestroyedWallsForDay,
  markBossDefeated,
  markHqHp,
  recomputeGoalsProgress,
  respawnDestroyedWallsAtDayStart,
  resetBuildingPurchaseCounts,
  resetBuildingHp,
  setActiveNightModifier,
  setNextNightPlan,
  summonHero,
  upgradeStronghold,
  upgradeBuilding
} from './runState'
import { getBuildingMaxHp } from './economy'
import { MetaState, RunPhase, RunState } from './types'
import { BuildingId } from '../config/buildings'
import type { PlayerPositionSnapshot } from '../rts/types'
import { deriveSeed } from './rng'

export interface CombatOutcome {
  victory: boolean
  lostSquadIds: string[]
  lostHeroIds: string[]
  bossDefeated: boolean
  hqHpPercent: number
  playerPositions?: PlayerPositionSnapshot
  destroyedWallPadIds?: string[]
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
  summonHero: (heroId: HeroRecruitId, spawnPos?: { x: number; y: number }, spawnPadId?: string) => void
  upgradeStronghold: () => void
  startCombat: () => void
  startCombatWithNightModifier: (modifierId?: NightModifierId) => void
  resolveCombat: (outcome: CombatOutcome) => void
  selectPerk: (perkId: PerkId) => void
  rerollRunSeed: () => void
  setDebugOverrides: (overrides: { forceNightModifierId?: NightModifierId; forcePerkId?: PerkId; forceEnemyTraitId?: EnemyTraitId; forceEliteVariant?: boolean }) => void
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

const normalizeRunPhase = (phase: RunPhase): RunPhase => (phase === 'combat' || phase === 'battle_cry' ? 'build' : phase)

export const RunProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const saved = useMemo(() => loadSave(), [])
  const [meta, setMeta] = useState<MetaState>(() => saved?.meta ?? createInitialMeta())
  const [activeRun, setActiveRun] = useState<RunState | null>(() => normalizeRun(saved?.activeRun ?? null))
  const [runPhase, setRunPhase] = useState<RunPhase>(() => (saved?.runPhase ? normalizeRunPhase(saved.runPhase) : 'build'))
  const [lastCombat, setLastCombat] = useState<CombatOutcome | undefined>(undefined)
  const battleCryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (battleCryTimeoutRef.current) {
        window.clearTimeout(battleCryTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    saveGame({ meta, activeRun, runPhase })
  }, [meta, activeRun, runPhase])

  const startRun = (levelId: string) => {
    if (battleCryTimeoutRef.current) {
      window.clearTimeout(battleCryTimeoutRef.current)
      battleCryTimeoutRef.current = null
    }
    const level = getLevelById(levelId)
    if (!level) return
    const run = recomputeGoalsProgress(createRunState(levelId), level)
    setActiveRun(run)
    setRunPhase('build')
    setLastCombat(undefined)
  }

  const abandonRun = () => {
    if (battleCryTimeoutRef.current) {
      window.clearTimeout(battleCryTimeoutRef.current)
      battleCryTimeoutRef.current = null
    }
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
    const level = getRunLevel(activeRun)
    const pad = level.buildingPads.find((entry) => entry.id === padId)
    if (!pad || !isBuildingAllowedOnPad(pad, id)) return
    const padUnlock = getPadUnlockLevelForRunLevel(level, padId)
    if (activeRun.strongholdLevel < padUnlock) return
    const cost = getBuildingPurchaseCost(id)
    if (activeRun.gold < cost) return
    if (activeRun.buildings.some((building) => building.padId === padId)) return
    const next = recomputeGoalsProgress(
      { ...addBuilding(activeRun, id, padId), gold: activeRun.gold - cost },
      level
    )
    setActiveRun(setNextNightPlan(next, level))
  }

  const upgradeBuildingAction = (padId: string) => {
    if (!activeRun || runPhase !== 'build') return
    const current = activeRun.buildings.find((building) => building.padId === padId)
    if (!current) return
    const cost = getBuildingUpgradeCostForRun(activeRun, padId)
    if (activeRun.gold < cost) return
    if (!canUpgradeBuilding(activeRun, padId)) return
    const next = recomputeGoalsProgress(
      { ...upgradeBuilding(activeRun, padId), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(setNextNightPlan(next, getRunLevel(activeRun)))
  }

  const upgradeStrongholdAction = () => {
    if (!activeRun || runPhase !== 'build') return
    if (!canUpgradeStronghold(activeRun)) return
    const next = recomputeGoalsProgress(upgradeStronghold(activeRun), getRunLevel(activeRun))
    setActiveRun(setNextNightPlan(next, getRunLevel(activeRun)))
  }

  const buySquadAction = (type: UnitType, spawnPos?: { x: number; y: number }, spawnPadId?: string) => {
    if (!activeRun || runPhase !== 'build') return
    if (!canBuySquadFromBuilding(activeRun, type, spawnPadId)) return
    const cost = getUnitCost(type)
    const next = recomputeGoalsProgress(
      { ...buySquad(activeRun, type, spawnPos, spawnPadId), gold: activeRun.gold - cost },
      getRunLevel(activeRun)
    )
    setActiveRun(setNextNightPlan(next, getRunLevel(activeRun)))
  }

  const summonHeroAction = (heroId: HeroRecruitId, spawnPos?: { x: number; y: number }, spawnPadId?: string) => {
    if (!activeRun || runPhase !== 'build') return
    const def = HERO_RECRUIT_DEFS[heroId]
    if (!def) return
    if (activeRun.gold < def.cost) return
    const updated = summonHero(activeRun, heroId, spawnPos, spawnPadId)
    if (updated === activeRun) return
    const next = recomputeGoalsProgress(
      { ...updated, gold: activeRun.gold - def.cost },
      getRunLevel(activeRun)
    )
    setActiveRun(setNextNightPlan(next, getRunLevel(activeRun)))
  }

  const startCombat = () => {
    if (!activeRun || runPhase !== 'build') return
    const level = getRunLevel(activeRun)
    const withPenalty = applyNightGoldStartPenalty(activeRun, level)
    const planned = setNextNightPlan(withPenalty, level)
    setActiveRun(planned)
    setRunPhase('battle_cry')
    if (battleCryTimeoutRef.current) {
      window.clearTimeout(battleCryTimeoutRef.current)
    }
    battleCryTimeoutRef.current = window.setTimeout(() => {
      setRunPhase((phase) => (phase === 'battle_cry' ? 'combat' : phase))
      battleCryTimeoutRef.current = null
    }, 450)
  }

  const startCombatWithNightModifier = (modifierId?: NightModifierId) => {
    if (!activeRun || runPhase !== 'build') return
    const level = getRunLevel(activeRun)
    const withModifier = setActiveNightModifier(activeRun, modifierId)
    const withPenalty = applyNightGoldStartPenalty(withModifier, level)
    const planned = setNextNightPlan(withPenalty, level)
    setActiveRun(planned)
    setRunPhase('battle_cry')
    if (battleCryTimeoutRef.current) {
      window.clearTimeout(battleCryTimeoutRef.current)
    }
    battleCryTimeoutRef.current = window.setTimeout(() => {
      setRunPhase((phase) => (phase === 'battle_cry' ? 'combat' : phase))
      battleCryTimeoutRef.current = null
    }, 450)
  }

  const resolveCombat = (outcome: CombatOutcome) => {
    if (!activeRun) return
    if (battleCryTimeoutRef.current) {
      window.clearTimeout(battleCryTimeoutRef.current)
      battleCryTimeoutRef.current = null
    }
    const level = getRunLevel(activeRun)
    const updated = activeRun
    const withBoss = outcome.bossDefeated ? markBossDefeated(updated, updated.dayNumber) : updated
    const withHp = markHqHp(withBoss, withBoss.dayNumber, outcome.hqHpPercent)
    const withPositions = outcome.playerPositions
      ? {
          ...withHp,
          unitRoster: withHp.unitRoster.map((squad) => {
            const nextPos = outcome.playerPositions?.squads[squad.id]
            return nextPos ? { ...squad, spawnPos: { ...nextPos } } : squad
          }),
          heroRoster: withHp.heroRoster.map((hero) => {
            const nextPos = outcome.playerPositions?.heroes[hero.id]
            return nextPos ? { ...hero, spawnPos: { ...nextPos } } : hero
          })
        }
      : withHp
    const daysSurvived = outcome.victory ? Math.max(withPositions.daysSurvived, withPositions.dayNumber) : withPositions.daysSurvived
    const runWithDays = { ...withPositions, daysSurvived }
    const healedBuildings = outcome.victory ? resetBuildingHp(runWithDays) : runWithDays
    const wallsMarked = markDestroyedWallsForDay(healedBuildings, outcome.destroyedWallPadIds ?? [])
    const paid = outcome.victory ? applyDayEndRewards(wallsMarked, level) : { run: wallsMarked, breakdown: undefined }
    const cleared = { ...paid.run, activeNightModifier: undefined }
    const withPlan = setNextNightPlan(cleared, level)
    const next = recomputeGoalsProgress(withPlan, level)
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
    const withRespawnedWalls = respawnDestroyedWallsAtDayStart(next)
    const reset = resetBuildingPurchaseCounts(withRespawnedWalls)
    setActiveRun(setNextNightPlan(reset, level))
    setRunPhase('build')
  }

  const selectPerkAction = (perkId: PerkId) => {
    if (!activeRun || runPhase !== 'day_end') return
    const level = getRunLevel(activeRun)
    const withPerk = applyPerkSelection(activeRun, level, perkId)
    setActiveRun(setNextNightPlan(withPerk, level))
  }

  const rerollRunSeed = () => {
    if (!activeRun) return
    const level = getRunLevel(activeRun)
    const nextSeed = deriveSeed(activeRun.runSeed, 'reroll', Date.now(), activeRun.dayNumber)
    const next = setNextNightPlan({ ...activeRun, runSeed: nextSeed >>> 0 }, level)
    setActiveRun(next)
  }

  const setDebugOverridesAction = (overrides: {
    forceNightModifierId?: NightModifierId
    forcePerkId?: PerkId
    forceEnemyTraitId?: EnemyTraitId
    forceEliteVariant?: boolean
  }) => {
    if (!activeRun) return
    const level = getRunLevel(activeRun)
    const merged = {
      ...(activeRun.debugOverrides ?? {}),
      ...overrides
    }
    const next = setNextNightPlan(
      {
        ...activeRun,
        debugOverrides: merged
      },
      level
    )
    setActiveRun(next)
  }

  const unlockLevel = (levelId: string) => {
    setMeta((prev) => (prev.unlockedLevels.includes(levelId) ? prev : { ...prev, unlockedLevels: [...prev.unlockedLevels, levelId] }))
  }

  const clearAll = () => {
    if (battleCryTimeoutRef.current) {
      window.clearTimeout(battleCryTimeoutRef.current)
      battleCryTimeoutRef.current = null
    }
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
    summonHero: summonHeroAction,
    upgradeStronghold: upgradeStrongholdAction,
    startCombat,
    startCombatWithNightModifier,
    resolveCombat,
    selectPerk: selectPerkAction,
    rerollRunSeed,
    setDebugOverrides: setDebugOverridesAction,
    startNewDay,
    unlockLevel,
    clearAll
  }

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

const levelIndexById = (id: string) => getLevels().findIndex((level) => level.id === id)

const getLevelByIndex = (index: number) => getLevels()[index] ?? null

const normalizeRun = (run: RunState | null): RunState | null => {
  if (!run) return null
  const level = getLevelById(run.levelId)
  if (!level) return null
  const usedPads = new Set<string>()
  const pads = level.buildingPads
  const buildings = run.buildings.reduce<RunState['buildings']>((acc, building) => {
    const explicitPadId = 'padId' in building && building.padId ? building.padId : null
    const explicitPad = explicitPadId ? pads.find((pad) => pad.id === explicitPadId) : null
    const explicitPadValid =
      Boolean(explicitPad) &&
      Boolean(explicitPadId) &&
      !usedPads.has(explicitPadId!) &&
      isBuildingAllowedOnPad(explicitPad as NonNullable<typeof explicitPad>, building.id)
    if (explicitPadValid) {
      usedPads.add(explicitPadId!)
      const maxHp = (building as typeof building & { maxHp?: number }).maxHp
      if (typeof maxHp === 'number') {
        acc.push({
          ...building,
          purchasedUnitsCount: building.purchasedUnitsCount ?? 0,
          heroSummonUsed: building.heroSummonUsed ?? 0
        })
        return acc
      }
      const nextMax = getBuildingMaxHp(building.id, building.level)
      acc.push({
        ...building,
        hp: nextMax,
        maxHp: nextMax,
        purchasedUnitsCount: building.purchasedUnitsCount ?? 0,
        heroSummonUsed: building.heroSummonUsed ?? 0
      })
      return acc
    }
    const preferred = pads.find((pad) => !usedPads.has(pad.id) && isBuildingAllowedOnPad(pad, building.id))
    if (!preferred) {
      return acc
    }
    const padId = preferred.id
    usedPads.add(padId)
    const nextMax = getBuildingMaxHp(building.id, building.level)
    acc.push({
      ...building,
      padId,
      hp: nextMax,
      maxHp: nextMax,
      purchasedUnitsCount: building.purchasedUnitsCount ?? 0,
      heroSummonUsed: building.heroSummonUsed ?? 0
    })
    return acc
  }, [])
  const unitRoster = (run.unitRoster ?? []).map((squad) => {
    const ownerPadId = squad.ownerBuildingPadId ?? squad.spawnPadId
    const ownerBuilding = ownerPadId ? buildings.find((entry) => entry.padId === ownerPadId) : undefined
    return {
      ...squad,
      ownerBuildingPadId: ownerPadId,
      ownerBuildingId: squad.ownerBuildingId ?? ownerBuilding?.id,
      ownerBuildingLevel: squad.ownerBuildingLevel ?? ownerBuilding?.level ?? 1
    }
  })
  const heroProgress = run.heroProgress ?? { hp: 0, attack: 0 }
  const heroRoster = run.heroRoster ?? []
  const minStronghold = buildings.reduce((acc, building) => {
    const buildingLevel = getBuildingUnlockLevelForLevel(level, building.id)
    const padLevel = getPadUnlockLevelForRunLevel(level, building.padId)
    return Math.max(acc, buildingLevel, padLevel)
  }, 1)
  const strongholdLevel = Math.min(getStrongholdMaxLevelForLevel(level), Math.max(run.strongholdLevel ?? 1, minStronghold))
  const strongholdUpgradeInProgress = run.strongholdUpgradeInProgress ?? null
  const runSeed = typeof run.runSeed === 'number' ? run.runSeed >>> 0 : (level.metadata.seed ?? deriveSeed(0x9e3779b9, run.levelId))
  const normalized: RunState = {
    ...run,
    buildings,
    unitRoster,
    heroProgress,
    heroRoster,
    strongholdLevel,
    strongholdUpgradeInProgress,
    runSeed,
    perks: run.perks ?? {},
    activeNightModifier: run.activeNightModifier,
    debugOverrides: run.debugOverrides ?? {}
  }
  if (!normalized.nextNightPlan || normalized.nextNightPlan.nightIndex !== normalized.dayNumber) {
    return setNextNightPlan(normalized, level)
  }
  return normalized
}
