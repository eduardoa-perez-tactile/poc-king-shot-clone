import { BuildingId } from '../config/buildings'
import {
  getBuildingLevelCapForStronghold,
  getBuildingUnlockLevel,
  getPadUnlockLevel,
  getStrongholdMaxLevel,
  getStrongholdUpgradeCost,
  isBuildingUnlockedAtStronghold
} from '../config/stronghold'
import { getDayPlan, getLevelById, LevelDefinition, LevelGoal, HeroRuntime } from '../config/levels'
import { UnitType, UNIT_DEFS } from '../config/units'
import { IncomeBreakdown, MetaState, RunBuilding, RunPhase, RunSquad, RunState } from './types'
import {
  getBuildingPurchaseCost,
  getBuildingUpgradeCost,
  getBuildingMaxHp,
  getIncomeBreakdown,
  getSquadCap,
  getUnitCost
} from './economy'

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
  const minStrongholdForStart = level.startingBuildings.reduce((acc, building) => {
    const buildingLevel = getBuildingUnlockLevel(building.id)
    const padLevel = getPadUnlockLevel(building.padId)
    return Math.max(acc, buildingLevel, padLevel)
  }, 1)
  const initialStronghold = Math.min(getStrongholdMaxLevel(), minStrongholdForStart)
  return {
    levelId: level.id,
    dayNumber: 1,
    daysSurvived: 0,
    gold: level.startGold,
    totalGoldEarned: 0,
    strongholdLevel: initialStronghold,
    strongholdUpgradeInProgress: null,
    buildings: level.startingBuildings.map((building) => {
      const maxHp = getBuildingMaxHp(building.id, building.level)
      return { ...building, hp: maxHp, maxHp }
    }),
    unitRoster: [],
    goalsProgress: {},
    bossDefeatedDays: [],
    hqHpByDay: {},
    lastIncome: undefined,
    heroProgress: { hp: 0, attack: 0 },
    difficultyScaling: 1
  }
}

export const addBuilding = (run: RunState, id: BuildingId, padId: string): RunState => {
  if (run.buildings.some((building) => building.padId === padId)) return run
  const maxHp = getBuildingMaxHp(id, 1)
  return { ...run, buildings: [...run.buildings, { id, level: 1, padId, hp: maxHp, maxHp }] }
}

export const upgradeBuilding = (run: RunState, padId: string): RunState => {
  return {
    ...run,
    buildings: run.buildings.map((building) =>
      building.padId === padId
        ? (() => {
            const nextLevel = building.level + 1
            const maxHp = getBuildingMaxHp(building.id, nextLevel)
            return { ...building, level: nextLevel, hp: maxHp, maxHp }
          })()
        : building
    )
  }
}

export const buySquad = (run: RunState, type: UnitType, spawnPos?: { x: number; y: number }, spawnPadId?: string): RunState => {
  const squad: RunSquad = {
    id: SQUAD_ID(),
    type,
    size: UNIT_DEFS[type].squadSize,
    spawnPos,
    spawnPadId
  }
  return { ...run, unitRoster: [...run.unitRoster, squad] }
}

export const removeSquads = (run: RunState, squadIds: string[]): RunState => {
  if (squadIds.length === 0) return run
  const remaining = run.unitRoster.filter((squad) => !squadIds.includes(squad.id))
  return { ...run, unitRoster: remaining }
}

export const getDayRewardGold = (level: LevelDefinition, dayNumber: number) => {
  const base = level.dayRewardGold
  const scale = level.dayRewardScale ?? 0
  return Math.max(0, Math.floor(base + Math.max(0, dayNumber - 1) * scale))
}

export const applyDayEndRewards = (run: RunState, level: LevelDefinition): { run: RunState; breakdown: IncomeBreakdown } => {
  const reward = getDayRewardGold(level, run.dayNumber)
  const breakdown = getIncomeBreakdown(run, reward)
  const gold = run.gold + breakdown.total
  return {
    run: {
      ...run,
      gold,
      totalGoldEarned: run.totalGoldEarned + breakdown.total,
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
    case 'stronghold_level':
      return Math.min(run.strongholdLevel, goal.target)
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

export const canUpgradeBuilding = (run: RunState, padId: string) => {
  const current = run.buildings.find((building) => building.padId === padId)
  if (!current) return false
  if (!isBuildingUnlockedAtStronghold(run.strongholdLevel, current.id)) return false
  const cap = getBuildingLevelCapForStronghold(run.strongholdLevel, current.id)
  if (current.level >= cap) return false
  const cost = getBuildingUpgradeCost(current.id, current.level + 1)
  return run.gold >= cost
}

export const canBuildBuilding = (run: RunState, id: BuildingId) =>
  isBuildingUnlockedAtStronghold(run.strongholdLevel, id)

export const canUpgradeStronghold = (run: RunState) => {
  const maxLevel = getStrongholdMaxLevel()
  if (run.strongholdLevel >= maxLevel) return false
  const cost = getStrongholdUpgradeCost(run.strongholdLevel)
  return run.gold >= cost
}

export const upgradeStronghold = (run: RunState) => {
  const maxLevel = getStrongholdMaxLevel()
  if (run.strongholdLevel >= maxLevel) return run
  const cost = getStrongholdUpgradeCost(run.strongholdLevel)
  if (run.gold < cost) return run
  return {
    ...run,
    gold: run.gold - cost,
    strongholdLevel: Math.min(maxLevel, run.strongholdLevel + 1),
    strongholdUpgradeInProgress: null
  }
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
  return level.startingBuildings.map((building) => {
    const maxHp = getBuildingMaxHp(building.id, building.level)
    return { ...building, hp: maxHp, maxHp }
  })
}

export const getHeroRuntime = (run: RunState): HeroRuntime => {
  const level = getRunLevel(run)
  const base = level.heroLoadout.baseStats
  const bonus = run.heroProgress ?? { hp: 0, attack: 0 }
  return {
    id: level.heroLoadout.id,
    name: level.heroLoadout.name,
    description: level.heroLoadout.description,
    stats: {
      hp: base.hp + bonus.hp,
      attack: base.attack + bonus.attack,
      range: base.range,
      speed: base.speed,
      cooldown: base.cooldown
    },
    abilities: level.heroLoadout.abilities
  }
}

export const resetBuildingHp = (run: RunState): RunState => ({
  ...run,
  buildings: run.buildings.map((building) => ({
    ...building,
    hp: building.maxHp
  }))
})
