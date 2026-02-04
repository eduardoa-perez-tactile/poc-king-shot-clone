import { BuildingId, BUILDING_DEFS } from '../config/buildings'
import { getDayPlan, getLevelById, LevelDefinition, LevelGoal } from '../config/levels'
import { UnitType, UNIT_DEFS } from '../config/units'
import { IncomeBreakdown, MetaState, RunBuilding, RunPhase, RunSquad, RunState } from './types'
import { getBuildingPurchaseCost, getBuildingUpgradeCost, getIncomeBreakdown, getSquadCap, getUnitCost } from './economy'

const SQUAD_ID = (() => {
  let id = 0
  return () => `sq_${id++}`
})()

export const createInitialMeta = (): MetaState => ({
  unlockedLevels: ['level_1'],
  bestCompletion: {},
  completedLevels: []
})

export const createRunState = (levelId: string): RunState => {
  const level = getLevelById(levelId)
  if (!level) throw new Error(`Unknown level: ${levelId}`)
  return {
    levelId: level.id,
    dayNumber: 1,
    daysSurvived: 0,
    gold: level.startGold,
    totalGoldEarned: 0,
    buildings: level.startingBuildings.map((building) => ({ ...building })),
    unitRoster: [],
    goalsProgress: {},
    bossDefeatedDays: [],
    hqHpByDay: {},
    lastIncome: undefined,
    difficultyScaling: 1
  }
}

export const addBuilding = (run: RunState, id: BuildingId): RunState => {
  if (run.buildings.some((building) => building.id === id)) return run
  return { ...run, buildings: [...run.buildings, { id, level: 1 }] }
}

export const upgradeBuilding = (run: RunState, id: BuildingId): RunState => {
  return {
    ...run,
    buildings: run.buildings.map((building) =>
      building.id === id ? { ...building, level: building.level + 1 } : building
    )
  }
}

export const buySquad = (run: RunState, type: UnitType): RunState => {
  const squad: RunSquad = {
    id: SQUAD_ID(),
    type,
    size: UNIT_DEFS[type].squadSize
  }
  return { ...run, unitRoster: [...run.unitRoster, squad] }
}

export const removeSquads = (run: RunState, squadIds: string[]): RunState => {
  if (squadIds.length === 0) return run
  const remaining = run.unitRoster.filter((squad) => !squadIds.includes(squad.id))
  return { ...run, unitRoster: remaining }
}

export const applyIncome = (run: RunState): { run: RunState; breakdown: IncomeBreakdown } => {
  const breakdown = getIncomeBreakdown(run)
  const gold = run.gold + breakdown.total + breakdown.bonuses
  return {
    run: {
      ...run,
      gold,
      totalGoldEarned: run.totalGoldEarned + breakdown.total + breakdown.bonuses,
      lastIncome: breakdown
    },
    breakdown
  }
}

export const recomputeGoalsProgress = (run: RunState, level: LevelDefinition): RunState => {
  const progress: Record<string, number | boolean> = {}
  level.goals.forEach((goal) => {
    progress[goal.id] = getGoalProgress(run, goal)
  })
  return { ...run, goalsProgress: progress }
}

export const getGoalProgress = (run: RunState, goal: LevelGoal): number | boolean => {
  switch (goal.type) {
    case 'survive_days':
      return Math.min(run.daysSurvived, goal.target)
    case 'total_gold_earned':
      return Math.min(run.totalGoldEarned, goal.target)
    case 'defeat_boss_day': {
      const day = goal.day ?? 0
      return run.bossDefeatedDays.includes(day)
    }
    case 'hq_hp_threshold': {
      const day = goal.day ?? run.daysSurvived
      const hp = run.hqHpByDay[day] ?? 0
      return hp >= goal.target
    }
    default:
      return 0
  }
}

export const areGoalsComplete = (run: RunState, level: LevelDefinition) =>
  level.goals.every((goal) => {
    const value = run.goalsProgress[goal.id]
    if (typeof value === 'boolean') return value
    return value >= goal.target
  })

export const canAffordBuilding = (run: RunState, id: BuildingId) => run.gold >= getBuildingPurchaseCost(id)

export const canUpgradeBuilding = (run: RunState, id: BuildingId) => {
  const def = BUILDING_DEFS[id]
  const current = run.buildings.find((building) => building.id === id)?.level ?? 0
  if (current === 0) return false
  if (current >= def.maxLevel) return false
  const cost = getBuildingUpgradeCost(id, current + 1)
  return run.gold >= cost
}

export const canBuySquad = (run: RunState, type: UnitType) => {
  const cap = getSquadCap(run)
  if (run.unitRoster.length >= cap) return false
  return run.gold >= getUnitCost(type)
}

export const nextDayNumber = (run: RunState) => run.dayNumber + 1

export const markBossDefeated = (run: RunState, dayNumber: number) => {
  if (run.bossDefeatedDays.includes(dayNumber)) return run
  return { ...run, bossDefeatedDays: [...run.bossDefeatedDays, dayNumber] }
}

export const markHqHp = (run: RunState, dayNumber: number, hpPercent: number) => ({
  ...run,
  hqHpByDay: { ...run.hqHpByDay, [dayNumber]: hpPercent }
})

export const getRunLevel = (run: RunState) => {
  const level = getLevelById(run.levelId)
  if (!level) throw new Error(`Unknown level: ${run.levelId}`)
  return level
}

export const getRunDayPlan = (run: RunState) => getDayPlan(getRunLevel(run), run.dayNumber)

export const canStartCombat = (run: RunState, phase: RunPhase) => phase === 'build'

export const getBuildCosts = () => ({
  building: getBuildingPurchaseCost,
  upgrade: getBuildingUpgradeCost,
  squad: getUnitCost
})

export const getStartingBuildings = (levelId: string): RunBuilding[] => {
  const level = getLevelById(levelId)
  if (!level) return []
  return level.startingBuildings.map((building) => ({ ...building }))
}
