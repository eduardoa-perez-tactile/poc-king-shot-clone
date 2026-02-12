import { BuildingId } from '../../config/buildings'
import type { LevelDefinition } from '../types/LevelDefinition'

export type PadType = 'TOWER_ONLY' | 'UNIT_PRODUCER' | 'HERO'

export interface PadConstraintRules {
  minTowerPads: number
  maxUnitProducerPads: number
  maxHeroPads: number
}

export interface ProducerStatScaling {
  healthMultPerLevel: number
  damageMultPerLevel: number
  attackSpeedMultPerLevel: number
}

export interface ProducerDefaults {
  unitsOnBuild: number
  unitsPerUpgradeLevel: number
  unitStatScalingPerLevel: ProducerStatScaling
}

export const DEFAULT_PAD_CONSTRAINTS: PadConstraintRules = {
  minTowerPads: 4,
  maxUnitProducerPads: 3,
  maxHeroPads: 3
}

export const DEFAULT_PRODUCER_DEFAULTS: ProducerDefaults = {
  unitsOnBuild: 4,
  unitsPerUpgradeLevel: 4,
  unitStatScalingPerLevel: {
    healthMultPerLevel: 0.12,
    damageMultPerLevel: 0.1,
    attackSpeedMultPerLevel: 0.08
  }
}

const TOWER_BUILDINGS = new Set<BuildingId>(['gold_mine', 'house', 'watchtower', 'wall', 'blacksmith', 'stable'])
const UNIT_PRODUCER_BUILDINGS = new Set<BuildingId>(['barracks', 'range'])
const HERO_BUILDINGS = new Set<BuildingId>(['hero_recruiter'])

export const isUnitProducerBuilding = (buildingId: BuildingId) => UNIT_PRODUCER_BUILDINGS.has(buildingId)

export const isHeroBuilding = (buildingId: BuildingId) => HERO_BUILDINGS.has(buildingId)

export const isTowerBuilding = (buildingId: BuildingId) =>
  TOWER_BUILDINGS.has(buildingId) || (!isUnitProducerBuilding(buildingId) && !isHeroBuilding(buildingId))

export const getAllowedBuildingTypesForPadType = (padType: PadType): BuildingId[] => {
  if (padType === 'UNIT_PRODUCER') return ['barracks', 'range']
  if (padType === 'HERO') return ['hero_recruiter']
  return ['gold_mine', 'house', 'watchtower', 'wall', 'blacksmith', 'stable']
}

export const inferPadType = (allowedTypes: BuildingId[]): PadType => {
  if (allowedTypes.some((id) => isHeroBuilding(id))) return 'HERO'
  if (allowedTypes.some((id) => isUnitProducerBuilding(id))) return 'UNIT_PRODUCER'
  return 'TOWER_ONLY'
}

export const isBuildingAllowedOnPadType = (padType: PadType, buildingId: BuildingId) => {
  if (padType === 'UNIT_PRODUCER') return isUnitProducerBuilding(buildingId)
  if (padType === 'HERO') return isHeroBuilding(buildingId)
  return isTowerBuilding(buildingId)
}

export const getPadAllowedBuildingType = (
  pad: { allowedTypes: BuildingId[]; allowedBuildingType?: BuildingId }
): BuildingId | null => {
  const explicit = pad.allowedBuildingType
  if (explicit && pad.allowedTypes.includes(explicit)) return explicit
  return pad.allowedTypes[0] ?? null
}

export const isBuildingAllowedOnPad = (
  pad: { padType: PadType; allowedTypes: BuildingId[]; allowedBuildingType?: BuildingId },
  buildingId: BuildingId
) => {
  const fixedAllowed = getPadAllowedBuildingType(pad)
  return Boolean(fixedAllowed) && isBuildingAllowedOnPadType(pad.padType, buildingId) && fixedAllowed === buildingId
}

export const buildPadUnlockLevelsFromByLevel = (padUnlocksByLevel: Record<string, string[]>) => {
  const unlockLevels: Record<string, number> = {}
  Object.keys(padUnlocksByLevel).forEach((levelKey) => {
    const level = Number(levelKey)
    if (!Number.isFinite(level)) return
    const padIds = padUnlocksByLevel[levelKey] ?? []
    padIds.forEach((padId) => {
      const current = unlockLevels[padId]
      unlockLevels[padId] = typeof current === 'number' ? Math.min(current, level) : level
    })
  })
  return unlockLevels
}

export const buildPadUnlocksByLevelFromLevels = (padUnlockLevels: Record<string, number>) => {
  const byLevel: Record<string, string[]> = {}
  Object.keys(padUnlockLevels).forEach((padId) => {
    const level = Math.max(1, Math.floor(padUnlockLevels[padId] ?? 1))
    const key = String(level)
    if (!byLevel[key]) byLevel[key] = []
    byLevel[key].push(padId)
  })
  Object.keys(byLevel).forEach((key) => {
    byLevel[key] = Array.from(new Set(byLevel[key])).sort()
  })
  return byLevel
}

export const getPadUnlockLevelForLevel = (level: LevelDefinition, padId: string) =>
  (() => {
    const pad = level.buildingPads.find((entry) => entry.id === padId)
    if (typeof pad?.unlockLevel === 'number') return Math.max(1, Math.floor(pad.unlockLevel))
    return level.stronghold.padUnlockLevels[padId] ?? 1
  })()

export const getPadUnlocksForStrongholdLevel = (level: LevelDefinition, strongholdLevel: number) =>
  (level.stronghold.padUnlocksByLevel[String(strongholdLevel)] ?? []).slice()

export const getUnlockedPadIdsForStrongholdLevel = (level: LevelDefinition, strongholdLevel: number) =>
  level.buildingPads
    .filter((pad) => getPadUnlockLevelForLevel(level, pad.id) <= strongholdLevel)
    .map((pad) => pad.id)

export const countPadsByType = (level: LevelDefinition) => {
  const counts = {
    tower: 0,
    producer: 0,
    hero: 0
  }
  level.buildingPads.forEach((pad) => {
    if (pad.padType === 'UNIT_PRODUCER') counts.producer += 1
    else if (pad.padType === 'HERO') counts.hero += 1
    else counts.tower += 1
  })
  return counts
}

export const getProducerLevelStatMultipliers = (
  producerDefaults: ProducerDefaults,
  buildingLevel: number
) => {
  const gainLevels = Math.max(0, buildingLevel - 1)
  return {
    hp: 1 + gainLevels * producerDefaults.unitStatScalingPerLevel.healthMultPerLevel,
    attack: 1 + gainLevels * producerDefaults.unitStatScalingPerLevel.damageMultPerLevel,
    attackSpeed: 1 + gainLevels * producerDefaults.unitStatScalingPerLevel.attackSpeedMultPerLevel
  }
}
