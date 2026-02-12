import { BuildingId, BUILDING_DEFS } from '../config/buildings'
import { HeroRecruitId, HERO_RECRUIT_DEFS } from '../config/heroes'
import { getDayPlan, getLevelById, LevelDefinition, LevelGoal, HeroRuntime } from '../config/levels'
import { UnitType, UNIT_DEFS } from '../config/units'
import {
  getPadUnlockLevelForLevel,
  getUnlockedPadIdsForStrongholdLevel,
  isUnitProducerBuilding
} from '../game/rules/progression'
import { IncomeBreakdown, MetaState, RunBuilding, RunHero, RunPhase, RunSquad, RunState } from './types'
import {
  getBuildingPurchaseCost,
  getBuildingUpgradeCost,
  getBuildingMaxHp,
  getIncomeBreakdown,
  getSquadCap,
  getUnitPurchaseCap,
  getUnitCost
} from './economy'

const SQUAD_ID = (() => {
  let id = 0
  return () => `sq_${id++}`
})()

const HERO_ID = (() => {
  let id = 0
  return () => `hero_${id++}`
})()

const DAY_END_BONUS_GOLD = 20
const PRODUCER_SPAWN_OFFSETS = [
  { x: -70, y: -60 },
  { x: 0, y: -72 },
  { x: 70, y: -60 },
  { x: -88, y: 0 },
  { x: 88, y: 0 },
  { x: -70, y: 60 },
  { x: 0, y: 72 },
  { x: 70, y: 60 }
]

export const getStrongholdMaxLevelForLevel = (level: LevelDefinition) => Math.max(1, Math.floor(level.stronghold.maxLevel))

export const getStrongholdUpgradeCostForLevel = (level: LevelDefinition, currentLevel: number) => {
  const index = Math.max(0, currentLevel - 1)
  return Math.max(0, Math.floor(level.stronghold.upgradeCostsByLevel[index] ?? 0))
}

const getPerBuildingCapForStrongholdLevel = (level: LevelDefinition, strongholdLevel: number, id: BuildingId) => {
  const caps = level.stronghold.perBuildingLevelCaps[id]
  if (!Array.isArray(caps) || caps.length === 0) return null
  const index = Math.max(0, Math.min(strongholdLevel - 1, caps.length - 1))
  return Math.max(0, Math.floor(caps[index] ?? 0))
}

export const getBuildingLevelCapForRun = (run: RunState, id: BuildingId, levelDef?: LevelDefinition) => {
  const level = levelDef ?? getRunLevel(run)
  const globalCap = Math.max(0, Math.floor(level.stronghold.globalMaxBuildingLevelCap))
  const perBuildingCap = getPerBuildingCapForStrongholdLevel(level, run.strongholdLevel, id)
  const buildingMaxLevel = Math.max(1, Math.floor(level.buildings[id]?.maxLevel ?? BUILDING_DEFS[id].maxLevel))
  const cap = typeof perBuildingCap === 'number' ? Math.min(globalCap, perBuildingCap) : globalCap
  return Math.max(0, Math.min(cap, buildingMaxLevel))
}

export const getBuildingUnlockLevelForLevel = (level: LevelDefinition, id: BuildingId) =>
  Math.max(1, Math.floor(level.stronghold.buildingUnlockLevels[id] ?? 1))

export const isBuildingUnlockedAtStrongholdForLevel = (
  level: LevelDefinition,
  strongholdLevel: number,
  id: BuildingId
) => strongholdLevel >= getBuildingUnlockLevelForLevel(level, id) && getBuildingLevelCapForStrongholdLevel(level, strongholdLevel, id) > 0

export const getBuildingLevelCapForStrongholdLevel = (
  level: LevelDefinition,
  strongholdLevel: number,
  id: BuildingId
) => {
  const globalCap = Math.max(0, Math.floor(level.stronghold.globalMaxBuildingLevelCap))
  const perBuildingCap = getPerBuildingCapForStrongholdLevel(level, strongholdLevel, id)
  const buildingMaxLevel = Math.max(1, Math.floor(level.buildings[id]?.maxLevel ?? BUILDING_DEFS[id].maxLevel))
  const cap = typeof perBuildingCap === 'number' ? Math.min(globalCap, perBuildingCap) : globalCap
  return Math.max(0, Math.min(cap, buildingMaxLevel))
}

export const getPadUnlockLevelForRunLevel = (level: LevelDefinition, padId: string) =>
  Math.max(1, Math.floor(getPadUnlockLevelForLevel(level, padId)))

export const isPadUnlockedAtStrongholdForRunLevel = (level: LevelDefinition, strongholdLevel: number, padId: string) =>
  strongholdLevel >= getPadUnlockLevelForRunLevel(level, padId)

export const getUnlockedBuildingTypesForRunLevel = (level: LevelDefinition, strongholdLevel: number): BuildingId[] =>
  (Object.keys(BUILDING_DEFS) as BuildingId[]).filter((id) => isBuildingUnlockedAtStrongholdForLevel(level, strongholdLevel, id))

export const getStrongholdUnlockDeltaForRun = (run: RunState, levelDef?: LevelDefinition) => {
  const level = levelDef ?? getRunLevel(run)
  const nextLevel = Math.min(run.strongholdLevel + 1, getStrongholdMaxLevelForLevel(level))
  if (nextLevel === run.strongholdLevel) {
    return {
      buildingTypes: [] as BuildingId[],
      padIds: [] as string[],
      maxBuildingCap: Math.max(0, Math.floor(level.stronghold.globalMaxBuildingLevelCap))
    }
  }
  const buildingTypes = (Object.keys(BUILDING_DEFS) as BuildingId[]).filter(
    (id) =>
      !isBuildingUnlockedAtStrongholdForLevel(level, run.strongholdLevel, id) &&
      isBuildingUnlockedAtStrongholdForLevel(level, nextLevel, id)
  )
  const currentPads = new Set(getUnlockedPadIdsForStrongholdLevel(level, run.strongholdLevel))
  const nextPads = getUnlockedPadIdsForStrongholdLevel(level, nextLevel).filter((padId) => !currentPads.has(padId))
  return {
    buildingTypes,
    padIds: nextPads,
    maxBuildingCap: Math.max(0, Math.floor(level.stronghold.globalMaxBuildingLevelCap))
  }
}

export const createInitialMeta = (): MetaState => ({
  unlockedLevels: ['level_1'],
  bestCompletion: {},
  completedLevels: []
})

const getPadPosition = (level: LevelDefinition, padId: string) => {
  const pad = level.buildingPads.find((entry) => entry.id === padId)
  if (!pad) return null
  return { x: pad.x, y: pad.y }
}

const getProducerSpawnPosition = (
  level: LevelDefinition,
  run: RunState,
  padId: string,
  spawnIndex: number
): { x: number; y: number } | undefined => {
  const padPos = getPadPosition(level, padId)
  if (!padPos) return undefined
  const existing = run.unitRoster.filter((entry) => entry.ownerBuildingPadId === padId).length
  const offset = PRODUCER_SPAWN_OFFSETS[(existing + spawnIndex) % PRODUCER_SPAWN_OFFSETS.length]
  return { x: padPos.x + offset.x, y: padPos.y + offset.y }
}

const updateProducerOwnedSquadsLevel = (run: RunState, padId: string, nextLevel: number): RunState => ({
  ...run,
  unitRoster: run.unitRoster.map((squad) =>
    squad.ownerBuildingPadId === padId ? { ...squad, ownerBuildingLevel: nextLevel } : squad
  )
})

const addProducerSquads = (
  run: RunState,
  level: LevelDefinition,
  buildingId: BuildingId,
  padId: string,
  buildingLevel: number,
  count: number
): RunState => {
  const type = BUILDING_DEFS[buildingId].unlocksUnit
  if (!type || count <= 0) return run
  const spawnCount = Math.max(0, Math.floor(count))
  if (spawnCount === 0) return run
  const nextRoster = run.unitRoster.slice()
  for (let i = 0; i < spawnCount; i += 1) {
    const spawnPos = getProducerSpawnPosition(level, { ...run, unitRoster: nextRoster }, padId, i)
    nextRoster.push({
      id: SQUAD_ID(),
      type,
      size: UNIT_DEFS[type].squadSize,
      spawnPos,
      spawnPadId: padId,
      ownerBuildingPadId: padId,
      ownerBuildingId: buildingId,
      ownerBuildingLevel: buildingLevel
    })
  }
  if (import.meta.env.DEV && (buildingId === 'barracks' || buildingId === 'range') && spawnCount > 0) {
    console.debug(`[ProducerSpawn] ${buildingId}@${padId} spawned ${spawnCount} squad(s) at level ${buildingLevel}.`)
  }
  return { ...run, unitRoster: nextRoster }
}

const applyProducerAutoSpawnOnBuild = (run: RunState, level: LevelDefinition, buildingId: BuildingId, padId: string, levelGained = 1) => {
  if (!isUnitProducerBuilding(buildingId)) return run
  const onBuild = Math.max(0, Math.floor(level.producerDefaults.unitsOnBuild))
  const perUpgrade = Math.max(0, Math.floor(level.producerDefaults.unitsPerUpgradeLevel))
  const extra = Math.max(0, levelGained - 1) * perUpgrade
  return addProducerSquads(run, level, buildingId, padId, Math.max(1, levelGained), onBuild + extra)
}

const applyProducerAutoSpawnOnUpgrade = (
  run: RunState,
  level: LevelDefinition,
  buildingId: BuildingId,
  padId: string,
  previousLevel: number,
  nextLevel: number
) => {
  if (!isUnitProducerBuilding(buildingId)) return run
  const levelGain = Math.max(0, nextLevel - previousLevel)
  const count = Math.max(0, Math.floor(level.producerDefaults.unitsPerUpgradeLevel)) * levelGain
  const withScaledExisting = updateProducerOwnedSquadsLevel(run, padId, nextLevel)
  return addProducerSquads(withScaledExisting, level, buildingId, padId, nextLevel, count)
}

export const createRunState = (levelId: string): RunState => {
  const level = getLevelById(levelId)
  if (!level) throw new Error(`Unknown level: ${levelId}`)
  const minStrongholdForStart = level.startingBuildings.reduce((acc, building) => {
    const buildingLevel = getBuildingUnlockLevelForLevel(level, building.id)
    const padLevel = getPadUnlockLevelForRunLevel(level, building.padId)
    return Math.max(acc, buildingLevel, padLevel)
  }, 1)
  const initialStronghold = Math.min(getStrongholdMaxLevelForLevel(level), minStrongholdForStart)
  const baseRun: RunState = {
    levelId: level.id,
    dayNumber: 1,
    daysSurvived: 0,
    gold: level.startGold,
    totalGoldEarned: 0,
    strongholdLevel: initialStronghold,
    strongholdUpgradeInProgress: null,
    buildings: level.startingBuildings.map((building) => {
      const maxHp = getBuildingMaxHp(building.id, building.level)
      return { ...building, hp: maxHp, maxHp, purchasedUnitsCount: 0, heroSummonUsed: 0 }
    }),
    unitRoster: [],
    heroRoster: [],
    goalsProgress: {},
    bossDefeatedDays: [],
    hqHpByDay: {},
    lastIncome: undefined,
    heroProgress: { hp: 0, attack: 0 },
    difficultyScaling: 1
  }
  const withInitialProducerSquads = baseRun.buildings.reduce((acc, building) => {
    if (!isUnitProducerBuilding(building.id)) return acc
    return applyProducerAutoSpawnOnBuild(acc, level, building.id, building.padId, building.level)
  }, baseRun)
  return withInitialProducerSquads
}

export const addBuilding = (run: RunState, id: BuildingId, padId: string): RunState => {
  if (run.buildings.some((building) => building.padId === padId)) return run
  const level = getRunLevel(run)
  const maxHp = getBuildingMaxHp(id, 1)
  const nextRun: RunState = {
    ...run,
    buildings: [
      ...run.buildings,
      { id, level: 1, padId, hp: maxHp, maxHp, purchasedUnitsCount: 0, heroSummonUsed: 0 }
    ]
  }
  return applyProducerAutoSpawnOnBuild(nextRun, level, id, padId, 1)
}

export const upgradeBuilding = (run: RunState, padId: string): RunState => {
  const level = getRunLevel(run)
  const target = run.buildings.find((building) => building.padId === padId)
  if (!target) return run
  const nextLevel = target.level + 1
  const nextRun = {
    ...run,
    buildings: run.buildings.map((building) =>
      building.padId === padId
        ? (() => {
            const nextMaxHp = getBuildingMaxHp(building.id, nextLevel)
            return { ...building, level: nextLevel, hp: nextMaxHp, maxHp: nextMaxHp }
          })()
        : building
    )
  }
  return applyProducerAutoSpawnOnUpgrade(nextRun, level, target.id, padId, target.level, nextLevel)
}

export const buySquad = (run: RunState, type: UnitType, spawnPos?: { x: number; y: number }, spawnPadId?: string): RunState => {
  const ownerBuilding = spawnPadId ? run.buildings.find((entry) => entry.padId === spawnPadId) : null
  const squad: RunSquad = {
    id: SQUAD_ID(),
    type,
    size: UNIT_DEFS[type].squadSize,
    spawnPos,
    spawnPadId,
    ownerBuildingPadId: spawnPadId,
    ownerBuildingId: ownerBuilding?.id,
    ownerBuildingLevel: ownerBuilding?.level ?? 1
  }
  const buildings = spawnPadId
    ? run.buildings.map((building) =>
        building.padId === spawnPadId
          ? { ...building, purchasedUnitsCount: (building.purchasedUnitsCount ?? 0) + 1 }
          : building
      )
    : run.buildings
  return { ...run, unitRoster: [...run.unitRoster, squad], buildings }
}

export const removeSquads = (run: RunState, squadIds: string[]): RunState => {
  if (squadIds.length === 0) return run
  const remaining = run.unitRoster.filter((squad) => !squadIds.includes(squad.id))
  return { ...run, unitRoster: remaining }
}

export const removeHeroes = (run: RunState, heroIds: string[]): RunState => {
  if (heroIds.length === 0) return run
  const remaining = run.heroRoster.filter((hero) => !heroIds.includes(hero.id))
  return { ...run, heroRoster: remaining }
}

export const getDayRewardGold = (level: LevelDefinition, dayNumber: number) => {
  const base = level.dayRewardGold
  const scale = level.dayRewardScale ?? 0
  return Math.max(0, Math.floor(base + Math.max(0, dayNumber - 1) * scale + DAY_END_BONUS_GOLD))
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
  const level = getRunLevel(run)
  const current = run.buildings.find((building) => building.padId === padId)
  if (!current) return false
  if (!isBuildingUnlockedAtStrongholdForLevel(level, run.strongholdLevel, current.id)) return false
  const cap = getBuildingLevelCapForStrongholdLevel(level, run.strongholdLevel, current.id)
  if (current.level >= cap) return false
  const cost = getBuildingUpgradeCost(current.id, current.level + 1)
  return run.gold >= cost
}

export const canBuildBuilding = (run: RunState, id: BuildingId) => {
  const level = getRunLevel(run)
  return isBuildingUnlockedAtStrongholdForLevel(level, run.strongholdLevel, id)
}

export const canUpgradeStronghold = (run: RunState) => {
  const level = getRunLevel(run)
  const maxLevel = getStrongholdMaxLevelForLevel(level)
  if (run.strongholdLevel >= maxLevel) return false
  const cost = getStrongholdUpgradeCostForLevel(level, run.strongholdLevel)
  return run.gold >= cost
}

export const upgradeStronghold = (run: RunState) => {
  const level = getRunLevel(run)
  const maxLevel = getStrongholdMaxLevelForLevel(level)
  if (run.strongholdLevel >= maxLevel) return run
  const cost = getStrongholdUpgradeCostForLevel(level, run.strongholdLevel)
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

export const canBuySquadFromBuilding = (run: RunState, type: UnitType, padId?: string) => {
  if (!canBuySquad(run, type)) return false
  if (!padId) return true
  const building = run.buildings.find((entry) => entry.padId === padId)
  if (!building) return false
  if (isUnitProducerBuilding(building.id)) return false
  const cap = getUnitPurchaseCap(run)
  const purchased = building.purchasedUnitsCount ?? 0
  return purchased < cap
}

export const summonHero = (
  run: RunState,
  heroId: HeroRecruitId,
  spawnPos?: { x: number; y: number },
  spawnPadId?: string
): RunState => {
  const def = HERO_RECRUIT_DEFS[heroId]
  if (!def) return run
  if (spawnPadId) {
    const building = run.buildings.find((entry) => entry.padId === spawnPadId)
    if (!building) return run
    const buildingDef = BUILDING_DEFS[building.id]
    const limit = buildingDef.heroRecruiter?.summonLimit ?? 0
    const used = building.heroSummonUsed ?? 0
    if (limit <= 0 || used >= limit) return run
  }
  const hero: RunHero = {
    id: HERO_ID(),
    heroId,
    spawnPos,
    spawnPadId
  }
  const buildings = spawnPadId
    ? run.buildings.map((building) =>
        building.padId === spawnPadId ? { ...building, heroSummonUsed: (building.heroSummonUsed ?? 0) + 1 } : building
      )
    : run.buildings
  return { ...run, heroRoster: [...run.heroRoster, hero], buildings }
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
    return { ...building, hp: maxHp, maxHp, purchasedUnitsCount: 0, heroSummonUsed: 0 }
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

export const resetBuildingPurchaseCounts = (run: RunState): RunState => ({
  ...run,
  buildings: run.buildings.map((building) => ({
    ...building,
    purchasedUnitsCount: 0
  }))
})

// Walls are battle-persistent: if destroyed in combat, they stay disabled for the
// rest of that day and respawn at the beginning of the next build phase.
export const markDestroyedWallsForDay = (run: RunState, destroyedPadIds: string[]): RunState => {
  if (destroyedPadIds.length === 0) return run
  const destroyed = new Set(destroyedPadIds)
  return {
    ...run,
    buildings: run.buildings.map((building) =>
      building.id === 'wall' && destroyed.has(building.padId)
        ? {
            ...building,
            hp: 0
          }
        : building
    )
  }
}

export const respawnDestroyedWallsAtDayStart = (run: RunState): RunState => ({
  ...run,
  buildings: run.buildings.map((building) =>
    building.id === 'wall' && building.hp <= 0
      ? {
          ...building,
          hp: building.maxHp
        }
      : building
  )
})
