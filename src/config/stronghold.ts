import { BuildingId, BUILDING_DEFS } from './buildings'

export interface StrongholdLevelDef {
  level: number
  upgradeCost: number
  maxBuildingLevelCap: number
  unlockBuildingTypes: BuildingId[]
  unlockPads?: string[]
  hqBaseHp: number
  hqArmor?: number
  hqRegen?: number
}

export const STRONGHOLD_LEVELS: StrongholdLevelDef[] = [
  {
    level: 1,
    upgradeCost: 120,
    maxBuildingLevelCap: 1,
    unlockBuildingTypes: ['gold_mine', 'house', 'barracks'],
    unlockPads: ['pad_a', 'pad_b', 'pad_c'],
    hqBaseHp: 1500
  },
  {
    level: 2,
    upgradeCost: 260,
    maxBuildingLevelCap: 2,
    unlockBuildingTypes: ['range', 'watchtower'],
    unlockPads: ['pad_d', 'pad_e'],
    hqBaseHp: 1750
  },
  {
    level: 3,
    upgradeCost: 0,
    maxBuildingLevelCap: 3,
    unlockBuildingTypes: ['stable', 'blacksmith', 'hero_recruiter'],
    unlockPads: ['pad_f'],
    hqBaseHp: 2000
  }
]

export const BUILDING_CAPS_BY_LEVEL: Partial<Record<BuildingId, number[]>> = {
  gold_mine: [1, 2, 3],
  house: [1, 2, 3],
  barracks: [1, 2, 3],
  range: [0, 1, 3],
  watchtower: [0, 1, 3],
  stable: [0, 0, 3],
  blacksmith: [0, 0, 3],
  hero_recruiter: [0, 0, 3]
}

const GLOBAL_BUILDING_MAX_LEVEL = 3

const padUnlockLevels: Record<string, number> = {}

STRONGHOLD_LEVELS.forEach((entry) => {
  entry.unlockPads?.forEach((padId) => {
    padUnlockLevels[padId] = Math.min(padUnlockLevels[padId] ?? entry.level, entry.level)
  })
})

export const getStrongholdLevelDef = (level: number) => {
  const exact = STRONGHOLD_LEVELS.find((entry) => entry.level === level)
  if (exact) return exact
  const max = STRONGHOLD_LEVELS[STRONGHOLD_LEVELS.length - 1]
  return level > (max?.level ?? 1) ? max : STRONGHOLD_LEVELS[0]
}

export const getStrongholdMaxLevel = () => STRONGHOLD_LEVELS[STRONGHOLD_LEVELS.length - 1]?.level ?? 1

export const getStrongholdUpgradeCost = (currentLevel: number) => getStrongholdLevelDef(currentLevel).upgradeCost

export const getStrongholdMaxBuildingLevelCap = (level: number) => getStrongholdLevelDef(level).maxBuildingLevelCap

export const getStrongholdHqBaseHp = (level: number) => getStrongholdLevelDef(level).hqBaseHp

export const getPadUnlockLevel = (padId: string) => padUnlockLevels[padId] ?? 1

export const isPadUnlockedAtStronghold = (level: number, padId: string) => level >= getPadUnlockLevel(padId)

export const getUnlockedBuildingTypes = (level: number) => {
  const unlocked = new Set<BuildingId>()
  STRONGHOLD_LEVELS.forEach((entry) => {
    if (entry.level <= level) {
      entry.unlockBuildingTypes.forEach((id) => unlocked.add(id))
    }
  })
  return Array.from(unlocked)
}

const getPerBuildingCap = (level: number, id: BuildingId) => {
  const caps = BUILDING_CAPS_BY_LEVEL[id]
  if (!caps || caps.length === 0) return null
  const index = Math.max(0, Math.min(level - 1, caps.length - 1))
  return caps[index] ?? 0
}

export const getBuildingLevelCapForStronghold = (level: number, id: BuildingId) => {
  const globalCap = getStrongholdMaxBuildingLevelCap(level)
  const perBuildingCap = getPerBuildingCap(level, id)
  const rawCap = typeof perBuildingCap === 'number' ? Math.min(perBuildingCap, globalCap) : globalCap
  return Math.max(0, Math.min(rawCap, BUILDING_DEFS[id].maxLevel, GLOBAL_BUILDING_MAX_LEVEL))
}

export const isBuildingUnlockedAtStronghold = (level: number, id: BuildingId) => {
  const unlocked = getUnlockedBuildingTypes(level).includes(id)
  const cap = getBuildingLevelCapForStronghold(level, id)
  return unlocked && cap > 0
}

export const getBuildingUnlockLevel = (id: BuildingId) => {
  for (const entry of STRONGHOLD_LEVELS) {
    if (isBuildingUnlockedAtStronghold(entry.level, id)) return entry.level
  }
  return getStrongholdMaxLevel()
}

export const getStrongholdUnlockedPads = (level: number, padIds: string[]) =>
  padIds.filter((padId) => isPadUnlockedAtStronghold(level, padId))

export const getStrongholdUnlockDelta = (level: number) => {
  const current = getUnlockedBuildingTypes(level)
  const nextLevel = Math.min(level + 1, getStrongholdMaxLevel())
  if (nextLevel === level) return { buildingTypes: [], padIds: [], maxBuildingCap: getStrongholdMaxBuildingLevelCap(level) }
  const next = getUnlockedBuildingTypes(nextLevel)
  const newBuildings = next.filter((id) => !current.includes(id))
  const padIds = (getStrongholdLevelDef(nextLevel).unlockPads ?? []).slice()
  return {
    buildingTypes: newBuildings,
    padIds,
    maxBuildingCap: getStrongholdMaxBuildingLevelCap(nextLevel)
  }
}
