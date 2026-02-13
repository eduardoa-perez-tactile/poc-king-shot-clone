import { BUILDING_CAPS_BY_LEVEL, STRONGHOLD_LEVELS } from '../../config/stronghold'
import { BuildingId, BUILDING_DEFS } from '../../config/buildings'
import { EliteId, ELITE_DEFS } from '../../config/elites'
import { UnitType, UNIT_DEFS } from '../../config/units'
import {
  DEFAULT_ELITE_CONFIG,
  DEFAULT_ENEMY_TRAITS,
  DEFAULT_NIGHT_MODIFIERS,
  DEFAULT_PERKS,
  EliteConfig,
  EnemyTraitDef,
  EnemyTraitId,
  NightModifierDef,
  NightModifierId,
  PerkDef,
  PerkId
} from '../../config/nightContent'
import {
  DEFAULT_PAD_CONSTRAINTS,
  DEFAULT_PRODUCER_DEFAULTS,
  PadConstraintRules,
  PadType,
  ProducerDefaults,
  buildPadUnlockLevelsFromByLevel,
  buildPadUnlocksByLevelFromLevels,
  countPadsByType,
  getAllowedBuildingTypesForPadType,
  inferPadType,
  isBuildingAllowedOnPad,
  isBuildingAllowedOnPadType
} from '../rules/progression'

export type {
  EliteConfig,
  EnemyTraitDef,
  EnemyTraitId,
  NightModifierDef,
  NightModifierId,
  PerkDef,
  PerkId
} from '../../config/nightContent'

export interface WaveUnitGroup {
  type: UnitType
  squads: number
  squadSize?: number
}

export type SpawnEdge = 'N' | 'E' | 'S' | 'W'

export interface SpawnEdgeConfig {
  edge: SpawnEdge
  weight?: number
}

export interface SpawnPointCountRange {
  min: number
  max: number
}

export type SpawnPointCount = number | SpawnPointCountRange

export interface DayWave {
  id: string
  units: WaveUnitGroup[]
  traits?: EnemyTraitId[]
  eliteChance?: number
  groups?: Array<{
    enemyTypeId: UnitType
    count: number
    traits?: EnemyTraitId[]
    eliteChance?: number
  }>
  spawnTimeSec?: number
  elite?: EliteId
  eliteCount?: number
  spawnEdges?: SpawnEdgeConfig[]
  spawnPointsPerEdge?: SpawnPointCount
  spawnPadding?: number
}

export interface DayPlan {
  day: number
  waveMode?: 'sequential' | 'timed'
  waveDelaySec?: number
  enemyModifiers?: {
    hpMultiplier: number
    attackMultiplier: number
  }
  miniBossAfterWave?: number
  miniBossId?: EliteId
  waves: DayWave[]
}

export interface HeroAbilityDef {
  id: 'q' | 'e'
  name: string
  description: string
  cooldown: number
  damage?: number
  radius?: number
  heal?: number
  dash?: number
}

export interface HeroStats {
  hp: number
  attack: number
  range: number
  speed: number
  cooldown: number
}

export interface HeroLoadout {
  id: string
  name: string
  description: string
  baseStats: HeroStats
  growthPerDay?: { hp: number; attack: number }
  abilities: {
    q: HeroAbilityDef
    e: HeroAbilityDef
  }
}

export interface HeroRuntime {
  id: string
  name: string
  description: string
  stats: HeroStats
  abilities: {
    q: HeroAbilityDef
    e: HeroAbilityDef
  }
}

export interface BuildingPad {
  id: string
  x: number
  y: number
  rotation?: number
  padType: PadType
  allowedBuildingType?: BuildingId
  allowedTypes: BuildingId[]
  unlockLevel?: number
}

export type GoalType =
  | 'survive_days'
  | 'defeat_boss_day'
  | 'total_gold_earned'
  | 'hq_hp_threshold'
  | 'stronghold_level'

export interface LevelGoal {
  id: string
  type: GoalType
  label: string
  target: number
  day?: number
}

export interface LevelMetadata {
  id: string
  name: string
  description: string
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare' | string
  biome: string
  theme: string
  seed?: number
}

export interface LevelEconomy {
  startingGold: number
  goldPerKill: number
  endOfDayGoldBonus: number
  endOfDayGoldScale: number
  buildPhaseDurationSec: number
}

export interface LevelStrongholdTuning {
  startingLevel: number
  maxLevel: number
  globalMaxBuildingLevelCap: number
  upgradeCostsByLevel: number[]
  padUnlockLevels: Record<string, number>
  padUnlocksByLevel: Record<string, string[]>
  buildingUnlockLevels: Record<BuildingId, number>
  perBuildingLevelCaps: Record<BuildingId, number[]>
  producerUnitCapPerStrongholdLevel: number
  recruiterUnlockLevel: number
}

export interface LevelBuildingTuning {
  id: BuildingId
  name: string
  baseCost: number
  upgradeBase: number
  upgradeScale: number
  maxLevel: number
  combat?: {
    damage: number
    range: number
    cooldown: number
    projectileSpeed?: number
    projectileType?: string
  }
}

export interface LevelUnitTuning {
  type: UnitType
  baseCost: number
  squadSize: number
  productionTimeSec: number
  capPerProducerPerStrongholdLevel: number
}

export interface EnemyCatalogEntry {
  id: string
  name: string
  kind: 'unit' | 'elite'
}

export interface LevelWaveRules {
  miniBossAfterWave: number
  enforceFinalBossOnLastDay: boolean
}

export interface LevelHeroTuning {
  startingStats: HeroStats
  battleCryEnabled: boolean
  battleCryDurationSec: number
  vfxEnabled: boolean
}

export interface LevelModifiers {
  enemyHpMultiplier: number
  enemyAttackMultiplier: number
  playerDamageMultiplier: number
}

export interface LevelDefinition {
  version: number
  metadata: LevelMetadata
  economy: LevelEconomy
  padConstraints: PadConstraintRules
  producerDefaults: ProducerDefaults
  minibossRules: {
    suppressDay1MiniBoss: boolean
  }
  stronghold: LevelStrongholdTuning
  buildings: Record<BuildingId, LevelBuildingTuning>
  units: Record<UnitType, LevelUnitTuning>
  enemies: {
    catalog: EnemyCatalogEntry[]
  }
  waves: LevelWaveRules
  hero: LevelHeroTuning
  modifiers: LevelModifiers
  id: string
  name: string
  description: string
  startGold: number
  dayRewardGold: number
  dayRewardScale?: number
  heroLoadout: HeroLoadout
  bossId?: EliteId
  nightModifiers?: NightModifierDef[]
  allowedNightModifiersByNight?: Record<number, NightModifierId[]>
  perks?: PerkDef[]
  perkPool?: PerkId[]
  perkChoicesPerNight?: number
  perkMaxCount?: number
  enemyTraits?: EnemyTraitDef[]
  eliteConfig?: EliteConfig
  buildingPads: BuildingPad[]
  startingBuildings: { id: BuildingId; level: number; padId: string }[]
  goals: LevelGoal[]
  days: DayPlan[]
  map: {
    width: number
    height: number
    obstacleDensityMultiplier?: number
    obstacles: { x: number; y: number; w: number; h: number }[]
    playerSpawn: { x: number; y: number }
    enemySpawn: { x: number; y: number }
    playerHQ: { x: number; y: number }
  }
}

export const LEVEL_DEFINITION_VERSION = 6

type JsonSchema = Record<string, unknown>

// Used by the dashboard to render a lightweight, schema-driven editor surface.
export const LEVEL_DEFINITION_SCHEMA: JsonSchema = {
  $id: 'LevelDefinition',
  type: 'object',
  required: [
    'version',
    'metadata',
    'economy',
    'padConstraints',
    'producerDefaults',
    'minibossRules',
    'stronghold',
    'buildings',
    'units',
    'enemies',
    'hero',
    'id',
    'name',
    'days',
    'map'
  ],
  properties: {
    version: { type: 'number' },
    metadata: {
      type: 'object',
      required: ['id', 'name', 'description', 'difficulty', 'biome', 'theme'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        difficulty: { type: 'string' },
        biome: { type: 'string' },
        theme: { type: 'string' },
        seed: { type: 'number' }
      }
    },
    economy: {
      type: 'object',
      required: ['startingGold', 'endOfDayGoldBonus'],
      properties: {
        startingGold: { type: 'number', minimum: 0 },
        goldPerKill: { type: 'number', minimum: 0 },
        endOfDayGoldBonus: { type: 'number', minimum: 0 },
        endOfDayGoldScale: { type: 'number', minimum: 0 },
        buildPhaseDurationSec: { type: 'number', minimum: 0 }
      }
    },
    padConstraints: {
      type: 'object',
      properties: {
        minTowerPads: { type: 'number', minimum: 0 },
        maxUnitProducerPads: { type: 'number', minimum: 0 },
        maxHeroPads: { type: 'number', minimum: 0 }
      }
    },
    producerDefaults: {
      type: 'object',
      properties: {
        unitsOnBuild: { type: 'number', minimum: 0 },
        unitsPerUpgradeLevel: { type: 'number', minimum: 0 }
      }
    },
    minibossRules: {
      type: 'object',
      properties: {
        suppressDay1MiniBoss: { type: 'boolean' }
      }
    },
    buildingPads: { type: 'array' },
    days: { type: 'array' },
    nightModifiers: { type: 'array' },
    allowedNightModifiersByNight: { type: 'object' },
    perks: { type: 'array' },
    perkPool: { type: 'array' },
    perkChoicesPerNight: { type: 'number', minimum: 1 },
    perkMaxCount: { type: 'number', minimum: 1 },
    enemyTraits: { type: 'array' },
    eliteConfig: { type: 'object' }
  }
}

export type ValidationSeverity = 'error' | 'warning'

export interface LevelValidationIssue {
  severity: ValidationSeverity
  path: string
  message: string
}

export interface LevelValidationResult {
  errors: LevelValidationIssue[]
  warnings: LevelValidationIssue[]
  isValid: boolean
}

const DEFAULT_HERO_STATS: HeroStats = {
  hp: 2000,
  attack: 52,
  range: 110,
  speed: 140,
  cooldown: 0.6
}

const DEFAULT_HERO_LOADOUT: HeroLoadout = {
  id: 'vanguard',
  name: 'Vanguard',
  description: 'A hardened champion who anchors the defense each day.',
  baseStats: DEFAULT_HERO_STATS,
  growthPerDay: { hp: 140, attack: 8 },
  abilities: {
    q: {
      id: 'q',
      name: 'Cleave',
      description: 'A wide strike that damages nearby enemies.',
      cooldown: 8,
      damage: 220,
      radius: 170
    },
    e: {
      id: 'e',
      name: 'Second Wind',
      description: 'Recover health to stay in the fight.',
      cooldown: 12,
      heal: 300
    }
  }
}

const DEFAULT_LEVEL_ID = 'level_custom'

const clampNonNegative = (value: number, fallback = 0) => (Number.isFinite(value) ? Math.max(0, value) : fallback)

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})

const asNumber = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

const asString = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback)

const asArray = <T>(value: unknown, fallback: T[]): T[] => (Array.isArray(value) ? (value as T[]) : fallback)

const defaultStronghold = (): LevelStrongholdTuning => {
  const padUnlockLevels: Record<string, number> = {}
  const padUnlocksByLevel: Record<string, string[]> = {}
  const buildingUnlockLevels: Record<BuildingId, number> = Object.keys(BUILDING_DEFS).reduce((acc, id) => {
    acc[id as BuildingId] = 1
    return acc
  }, {} as Record<BuildingId, number>)

  STRONGHOLD_LEVELS.forEach((entry) => {
    const levelKey = String(entry.level)
    if (!padUnlocksByLevel[levelKey]) padUnlocksByLevel[levelKey] = []
    entry.unlockPads?.forEach((padId) => {
      padUnlockLevels[padId] = Math.min(padUnlockLevels[padId] ?? entry.level, entry.level)
      padUnlocksByLevel[levelKey].push(padId)
    })
    entry.unlockBuildingTypes.forEach((id) => {
      buildingUnlockLevels[id] = Math.min(buildingUnlockLevels[id] ?? entry.level, entry.level)
    })
  })

  return {
    startingLevel: 1,
    maxLevel: STRONGHOLD_LEVELS[STRONGHOLD_LEVELS.length - 1]?.level ?? 3,
    globalMaxBuildingLevelCap: 3,
    upgradeCostsByLevel: STRONGHOLD_LEVELS.map((entry) => entry.upgradeCost),
    padUnlockLevels,
    padUnlocksByLevel,
    buildingUnlockLevels,
    perBuildingLevelCaps: Object.keys(BUILDING_DEFS).reduce((acc, id) => {
      const key = id as BuildingId
      const cap = BUILDING_CAPS_BY_LEVEL[key]
      acc[key] = Array.isArray(cap) && cap.length > 0 ? cap.slice() : [1, 2, 3]
      return acc
    }, {} as Record<BuildingId, number[]>),
    producerUnitCapPerStrongholdLevel: 4,
    recruiterUnlockLevel: 3
  }
}

const defaultBuildings = (): Record<BuildingId, LevelBuildingTuning> =>
  Object.values(BUILDING_DEFS).reduce((acc, def) => {
    acc[def.id] = {
      id: def.id,
      name: def.name,
      baseCost: def.baseCost,
      upgradeBase: def.upgradeBase,
      upgradeScale: def.upgradeScale,
      maxLevel: def.maxLevel,
      combat: def.combat
        ? {
            damage: def.combat.damage,
            range: def.combat.range,
            cooldown: def.combat.cooldown,
            projectileSpeed: def.combat.projectileSpeed,
            projectileType: def.combat.projectileType
          }
        : undefined
    }
    return acc
  }, {} as Record<BuildingId, LevelBuildingTuning>)

const defaultUnits = (): Record<UnitType, LevelUnitTuning> =>
  Object.values(UNIT_DEFS).reduce((acc, unit) => {
    acc[unit.type] = {
      type: unit.type,
      baseCost: unit.baseCost,
      squadSize: unit.squadSize,
      productionTimeSec: 5,
      capPerProducerPerStrongholdLevel: 4
    }
    return acc
  }, {} as Record<UnitType, LevelUnitTuning>)

const defaultEnemyCatalog = (): EnemyCatalogEntry[] => [
  ...Object.values(UNIT_DEFS).map((entry) => ({ id: entry.type, name: entry.name, kind: 'unit' as const })),
  ...Object.values(ELITE_DEFS).map((entry) => ({ id: entry.id, name: entry.name, kind: 'elite' as const }))
]

const createDefaultMap = () => ({
  width: 1200,
  height: 800,
  obstacleDensityMultiplier: 1.2,
  obstacles: [] as { x: number; y: number; w: number; h: number }[],
  playerSpawn: { x: 320, y: 320 },
  enemySpawn: { x: 940, y: 380 },
  playerHQ: { x: 120, y: 340 }
})

const GOAL_TYPES: GoalType[] = [
  'survive_days',
  'defeat_boss_day',
  'total_gold_earned',
  'hq_hp_threshold',
  'stronghold_level'
]

const SPAWN_EDGES: SpawnEdge[] = ['N', 'E', 'S', 'W']

const isGoalType = (value: string): value is GoalType => GOAL_TYPES.includes(value as GoalType)

const isSpawnEdge = (value: string): value is SpawnEdge => SPAWN_EDGES.includes(value as SpawnEdge)

export const cloneLevelDefinition = (level: LevelDefinition): LevelDefinition => JSON.parse(JSON.stringify(level)) as LevelDefinition

export const createDefaultLevelDefinition = (id = DEFAULT_LEVEL_ID): LevelDefinition => {
  const stronghold = defaultStronghold()
  return {
    version: LEVEL_DEFINITION_VERSION,
    metadata: {
      id,
      name: 'New Level',
      description: 'A tuning sandbox level.',
      difficulty: 'normal',
      biome: 'frontier',
      theme: 'default'
    },
    economy: {
      startingGold: 60,
      goldPerKill: 0,
      endOfDayGoldBonus: 30,
      endOfDayGoldScale: 5,
      buildPhaseDurationSec: 0
    },
    padConstraints: { ...DEFAULT_PAD_CONSTRAINTS },
    producerDefaults: { ...DEFAULT_PRODUCER_DEFAULTS, unitStatScalingPerLevel: { ...DEFAULT_PRODUCER_DEFAULTS.unitStatScalingPerLevel } },
    minibossRules: {
      suppressDay1MiniBoss: true
    },
    stronghold,
    buildings: defaultBuildings(),
    units: defaultUnits(),
    enemies: {
      catalog: defaultEnemyCatalog()
    },
    waves: {
      miniBossAfterWave: 2,
      enforceFinalBossOnLastDay: true
    },
    hero: {
      startingStats: DEFAULT_HERO_LOADOUT.baseStats,
      battleCryEnabled: true,
      battleCryDurationSec: 1,
      vfxEnabled: true
    },
    modifiers: {
      enemyHpMultiplier: 1,
      enemyAttackMultiplier: 1,
      playerDamageMultiplier: 1
    },
    id,
    name: 'New Level',
    description: 'A tuning sandbox level.',
    startGold: 60,
    dayRewardGold: 30,
    dayRewardScale: 5,
    heroLoadout: DEFAULT_HERO_LOADOUT,
    bossId: 'boss',
    nightModifiers: DEFAULT_NIGHT_MODIFIERS.map((entry) => ({ ...entry, effects: { ...entry.effects } })),
    allowedNightModifiersByNight: {},
    perks: DEFAULT_PERKS.map((entry) => ({ ...entry, effects: { ...entry.effects } })),
    perkPool: DEFAULT_PERKS.map((entry) => entry.id),
    perkChoicesPerNight: 3,
    perkMaxCount: 5,
    enemyTraits: DEFAULT_ENEMY_TRAITS.map((entry) => ({ ...entry, effects: { ...entry.effects } })),
    eliteConfig: {
      ...DEFAULT_ELITE_CONFIG,
      outline: { ...DEFAULT_ELITE_CONFIG.outline }
    },
    buildingPads: [],
    startingBuildings: [],
    goals: [
      { id: 'goal_survive_3', type: 'survive_days', label: 'Survive until Day 3', target: 3 }
    ],
    days: [
      {
        day: 1,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1, attackMultiplier: 1 },
        waves: [
          {
            id: 'd1_w1',
            units: [{ type: 'infantry', squads: 2 }]
          }
        ]
      }
    ],
    map: createDefaultMap()
  }
}

const migrateMetadata = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelMetadata => {
  const metadata = asObject(legacy.metadata)
  return {
    id: asString(metadata.id, asString(legacy.id, fallback.id)),
    name: asString(metadata.name, asString(legacy.name, fallback.name)),
    description: asString(metadata.description, asString(legacy.description, fallback.description)),
    difficulty: asString(metadata.difficulty, 'normal'),
    biome: asString(metadata.biome, 'frontier'),
    theme: asString(metadata.theme, 'default'),
    seed: typeof metadata.seed === 'number' ? metadata.seed : undefined
  }
}

const migrateEconomy = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelEconomy => {
  const economy = asObject(legacy.economy)
  return {
    startingGold: clampNonNegative(asNumber(economy.startingGold, asNumber(legacy.startGold, fallback.startGold))),
    goldPerKill: clampNonNegative(asNumber(economy.goldPerKill, 0)),
    endOfDayGoldBonus: clampNonNegative(asNumber(economy.endOfDayGoldBonus, asNumber(legacy.dayRewardGold, fallback.dayRewardGold))),
    endOfDayGoldScale: clampNonNegative(asNumber(economy.endOfDayGoldScale, asNumber(legacy.dayRewardScale, fallback.dayRewardScale ?? 0))),
    buildPhaseDurationSec: clampNonNegative(asNumber(economy.buildPhaseDurationSec, 0))
  }
}

const migratePadConstraints = (legacy: Record<string, unknown>, fallback: LevelDefinition): PadConstraintRules => {
  const padConstraints = asObject(legacy.padConstraints)
  return {
    minTowerPads: clampNonNegative(asNumber(padConstraints.minTowerPads, fallback.padConstraints.minTowerPads), fallback.padConstraints.minTowerPads),
    maxUnitProducerPads: clampNonNegative(
      asNumber(padConstraints.maxUnitProducerPads, fallback.padConstraints.maxUnitProducerPads),
      fallback.padConstraints.maxUnitProducerPads
    ),
    maxHeroPads: clampNonNegative(asNumber(padConstraints.maxHeroPads, fallback.padConstraints.maxHeroPads), fallback.padConstraints.maxHeroPads)
  }
}

const migrateProducerDefaults = (legacy: Record<string, unknown>, fallback: LevelDefinition): ProducerDefaults => {
  const producerDefaults = asObject(legacy.producerDefaults)
  const scaling = asObject(producerDefaults.unitStatScalingPerLevel)
  return {
    unitsOnBuild: clampNonNegative(asNumber(producerDefaults.unitsOnBuild, fallback.producerDefaults.unitsOnBuild), fallback.producerDefaults.unitsOnBuild),
    unitsPerUpgradeLevel: clampNonNegative(
      asNumber(producerDefaults.unitsPerUpgradeLevel, fallback.producerDefaults.unitsPerUpgradeLevel),
      fallback.producerDefaults.unitsPerUpgradeLevel
    ),
    unitStatScalingPerLevel: {
      healthMultPerLevel: clampNonNegative(
        asNumber(scaling.healthMultPerLevel, fallback.producerDefaults.unitStatScalingPerLevel.healthMultPerLevel),
        fallback.producerDefaults.unitStatScalingPerLevel.healthMultPerLevel
      ),
      damageMultPerLevel: clampNonNegative(
        asNumber(scaling.damageMultPerLevel, fallback.producerDefaults.unitStatScalingPerLevel.damageMultPerLevel),
        fallback.producerDefaults.unitStatScalingPerLevel.damageMultPerLevel
      ),
      attackSpeedMultPerLevel: clampNonNegative(
        asNumber(scaling.attackSpeedMultPerLevel, fallback.producerDefaults.unitStatScalingPerLevel.attackSpeedMultPerLevel),
        fallback.producerDefaults.unitStatScalingPerLevel.attackSpeedMultPerLevel
      )
    }
  }
}

const migrateMinibossRules = (legacy: Record<string, unknown>, fallback: LevelDefinition) => {
  const minibossRules = asObject(legacy.minibossRules)
  return {
    suppressDay1MiniBoss:
      typeof minibossRules.suppressDay1MiniBoss === 'boolean'
        ? minibossRules.suppressDay1MiniBoss
        : fallback.minibossRules.suppressDay1MiniBoss
  }
}

const migrateStronghold = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelStrongholdTuning => {
  const stronghold = asObject(legacy.stronghold)
  const defaults = fallback.stronghold
  const nextPerBuildingCaps = { ...defaults.perBuildingLevelCaps }
  const rawPerBuildingCaps = asObject(stronghold.perBuildingLevelCaps)
  ;(Object.keys(BUILDING_DEFS) as BuildingId[]).forEach((id) => {
    const raw = asArray<number>(rawPerBuildingCaps[id], defaults.perBuildingLevelCaps[id])
    nextPerBuildingCaps[id] = raw.map((value, index) => clampNonNegative(asNumber(value, defaults.perBuildingLevelCaps[id][index] ?? 0)))
  })

  const rawPadUnlockLevels = asObject(stronghold.padUnlockLevels)
  const rawPadUnlocksByLevel = asObject(stronghold.padUnlocksByLevel) as Record<string, unknown>

  const nextPadUnlocksByLevel: Record<string, string[]> = {}
  Object.keys(defaults.padUnlocksByLevel).forEach((key) => {
    nextPadUnlocksByLevel[key] = defaults.padUnlocksByLevel[key].slice()
  })
  Object.keys(rawPadUnlocksByLevel).forEach((key) => {
    const ids = asArray<string>(rawPadUnlocksByLevel[key], [])
    nextPadUnlocksByLevel[key] = Array.from(new Set(ids.filter((id) => id.trim().length > 0)))
  })

  const normalizedRawPadUnlockLevels: Record<string, number> = {}
  Object.keys(rawPadUnlockLevels).forEach((padId) => {
    normalizedRawPadUnlockLevels[padId] = Math.max(1, Math.floor(asNumber(rawPadUnlockLevels[padId], 1)))
  })

  const byLevelDerivedUnlocks = buildPadUnlockLevelsFromByLevel(nextPadUnlocksByLevel)
  const nextPadUnlockLevels = {
    ...defaults.padUnlockLevels,
    ...normalizedRawPadUnlockLevels,
    ...byLevelDerivedUnlocks
  }
  const normalizedPadUnlocksByLevel = buildPadUnlocksByLevelFromLevels(nextPadUnlockLevels)
  const nextBuildingUnlockLevels = { ...defaults.buildingUnlockLevels }
  const rawBuildingUnlockLevels = asObject(stronghold.buildingUnlockLevels)
  ;(Object.keys(BUILDING_DEFS) as BuildingId[]).forEach((id) => {
    nextBuildingUnlockLevels[id] = clampNonNegative(
      asNumber(rawBuildingUnlockLevels[id], defaults.buildingUnlockLevels[id]),
      defaults.buildingUnlockLevels[id]
    )
  })

  return {
    startingLevel: clampNonNegative(asNumber(stronghold.startingLevel, defaults.startingLevel), defaults.startingLevel),
    maxLevel: clampNonNegative(asNumber(stronghold.maxLevel, defaults.maxLevel), defaults.maxLevel),
    globalMaxBuildingLevelCap: clampNonNegative(
      asNumber(stronghold.globalMaxBuildingLevelCap, defaults.globalMaxBuildingLevelCap),
      defaults.globalMaxBuildingLevelCap
    ),
    upgradeCostsByLevel: asArray<number>(stronghold.upgradeCostsByLevel, defaults.upgradeCostsByLevel).map((value, index) =>
      clampNonNegative(asNumber(value, defaults.upgradeCostsByLevel[index] ?? 0))
    ),
    padUnlockLevels: nextPadUnlockLevels,
    padUnlocksByLevel: normalizedPadUnlocksByLevel,
    buildingUnlockLevels: nextBuildingUnlockLevels,
    perBuildingLevelCaps: nextPerBuildingCaps,
    producerUnitCapPerStrongholdLevel: clampNonNegative(
      asNumber(stronghold.producerUnitCapPerStrongholdLevel, defaults.producerUnitCapPerStrongholdLevel),
      defaults.producerUnitCapPerStrongholdLevel
    ),
    recruiterUnlockLevel: clampNonNegative(asNumber(stronghold.recruiterUnlockLevel, defaults.recruiterUnlockLevel), defaults.recruiterUnlockLevel)
  }
}

const migrateBuildings = (legacy: Record<string, unknown>, fallback: LevelDefinition): Record<BuildingId, LevelBuildingTuning> => {
  const next: Record<BuildingId, LevelBuildingTuning> = { ...fallback.buildings }
  const raw = asObject(legacy.buildings)
  ;(Object.keys(BUILDING_DEFS) as BuildingId[]).forEach((id) => {
    const value = asObject(raw[id])
    const base = fallback.buildings[id]
    const rawCombat = asObject(value.combat)
    const baseCombat = base.combat
    next[id] = {
      id,
      name: asString(value.name, base.name),
      baseCost: clampNonNegative(asNumber(value.baseCost, base.baseCost), base.baseCost),
      upgradeBase: clampNonNegative(asNumber(value.upgradeBase, base.upgradeBase), base.upgradeBase),
      upgradeScale: clampNonNegative(asNumber(value.upgradeScale, base.upgradeScale), base.upgradeScale),
      maxLevel: clampNonNegative(asNumber(value.maxLevel, base.maxLevel), base.maxLevel),
      combat: baseCombat
        ? {
            damage: clampNonNegative(asNumber(rawCombat.damage, baseCombat.damage), baseCombat.damage),
            range: clampNonNegative(asNumber(rawCombat.range, baseCombat.range), baseCombat.range),
            cooldown: clampNonNegative(asNumber(rawCombat.cooldown, baseCombat.cooldown), baseCombat.cooldown),
            projectileSpeed:
              typeof rawCombat.projectileSpeed === 'number'
                ? clampNonNegative(rawCombat.projectileSpeed, baseCombat.projectileSpeed ?? 0)
                : baseCombat.projectileSpeed,
            projectileType:
              typeof rawCombat.projectileType === 'string' && rawCombat.projectileType.trim().length > 0
                ? rawCombat.projectileType
                : baseCombat.projectileType
          }
        : undefined
    }
  })
  return next
}

const migrateUnits = (legacy: Record<string, unknown>, fallback: LevelDefinition): Record<UnitType, LevelUnitTuning> => {
  const next: Record<UnitType, LevelUnitTuning> = { ...fallback.units }
  const raw = asObject(legacy.units)
  ;(Object.keys(UNIT_DEFS) as UnitType[]).forEach((id) => {
    const value = asObject(raw[id])
    const base = fallback.units[id]
    next[id] = {
      type: id,
      baseCost: clampNonNegative(asNumber(value.baseCost, base.baseCost), base.baseCost),
      squadSize: clampNonNegative(asNumber(value.squadSize, base.squadSize), base.squadSize),
      productionTimeSec: clampNonNegative(asNumber(value.productionTimeSec, base.productionTimeSec), base.productionTimeSec),
      capPerProducerPerStrongholdLevel: clampNonNegative(
        asNumber(value.capPerProducerPerStrongholdLevel, base.capPerProducerPerStrongholdLevel),
        base.capPerProducerPerStrongholdLevel
      )
    }
  })
  return next
}

const migrateEnemyCatalog = (legacy: Record<string, unknown>, fallback: LevelDefinition): EnemyCatalogEntry[] => {
  const enemies = asObject(legacy.enemies)
  const raw = asArray<unknown>(enemies.catalog, fallback.enemies.catalog as unknown[])
  if (raw.length === 0) return fallback.enemies.catalog
  return raw.map((rawEntry) => {
    const entry = asObject(rawEntry)
    const kind = asString(entry.kind, 'unit')
    return {
      id: asString(entry.id, ''),
      name: asString(entry.name, asString(entry.id, 'Unknown')),
      kind: kind === 'elite' ? 'elite' : 'unit'
    }
  })
}

const migrateHero = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelHeroTuning => {
  const hero = asObject(legacy.hero)
  const stats = asObject(hero.startingStats)
  const loadout = asObject(legacy.heroLoadout)
  const baseStats = asObject(loadout.baseStats)
  const fallbackStats = fallback.hero.startingStats
  return {
    startingStats: {
      hp: clampNonNegative(asNumber(stats.hp, asNumber(baseStats.hp, fallbackStats.hp)), fallbackStats.hp),
      attack: clampNonNegative(asNumber(stats.attack, asNumber(baseStats.attack, fallbackStats.attack)), fallbackStats.attack),
      range: clampNonNegative(asNumber(stats.range, asNumber(baseStats.range, fallbackStats.range)), fallbackStats.range),
      speed: clampNonNegative(asNumber(stats.speed, asNumber(baseStats.speed, fallbackStats.speed)), fallbackStats.speed),
      cooldown: clampNonNegative(asNumber(stats.cooldown, asNumber(baseStats.cooldown, fallbackStats.cooldown)), fallbackStats.cooldown)
    },
    battleCryEnabled: typeof hero.battleCryEnabled === 'boolean' ? hero.battleCryEnabled : fallback.hero.battleCryEnabled,
    battleCryDurationSec: clampNonNegative(
      asNumber(hero.battleCryDurationSec, fallback.hero.battleCryDurationSec),
      fallback.hero.battleCryDurationSec
    ),
    vfxEnabled: typeof hero.vfxEnabled === 'boolean' ? hero.vfxEnabled : fallback.hero.vfxEnabled
  }
}

const migrateWaves = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelWaveRules => {
  const waves = asObject(legacy.waves)
  return {
    miniBossAfterWave: clampNonNegative(asNumber(waves.miniBossAfterWave, fallback.waves.miniBossAfterWave), fallback.waves.miniBossAfterWave),
    enforceFinalBossOnLastDay:
      typeof waves.enforceFinalBossOnLastDay === 'boolean'
        ? waves.enforceFinalBossOnLastDay
        : fallback.waves.enforceFinalBossOnLastDay
  }
}

const migrateModifiers = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelModifiers => {
  const modifiers = asObject(legacy.modifiers)
  return {
    enemyHpMultiplier: clampNonNegative(asNumber(modifiers.enemyHpMultiplier, fallback.modifiers.enemyHpMultiplier), 1),
    enemyAttackMultiplier: clampNonNegative(asNumber(modifiers.enemyAttackMultiplier, fallback.modifiers.enemyAttackMultiplier), 1),
    playerDamageMultiplier: clampNonNegative(asNumber(modifiers.playerDamageMultiplier, fallback.modifiers.playerDamageMultiplier), 1)
  }
}

const normalizeNightModifier = (value: Record<string, unknown>, fallback?: NightModifierDef): NightModifierDef => {
  const effects = asObject(value.effects)
  return {
    id: asString(value.id, fallback?.id ?? ''),
    name: asString(value.name, fallback?.name ?? 'Night Modifier'),
    description: asString(value.description, fallback?.description ?? ''),
    rewardMultiplier: clampNonNegative(asNumber(value.rewardMultiplier, fallback?.rewardMultiplier ?? 1), 1),
    effects: {
      enemyCountMultiplier:
        typeof effects.enemyCountMultiplier === 'number'
          ? Math.max(-0.95, effects.enemyCountMultiplier)
          : fallback?.effects.enemyCountMultiplier,
      enemyMoveSpeedMultiplier:
        typeof effects.enemyMoveSpeedMultiplier === 'number'
          ? Math.max(-0.95, effects.enemyMoveSpeedMultiplier)
          : fallback?.effects.enemyMoveSpeedMultiplier,
      enemyHpMultiplier:
        typeof effects.enemyHpMultiplier === 'number'
          ? Math.max(-0.95, effects.enemyHpMultiplier)
          : fallback?.effects.enemyHpMultiplier,
      towersDisabled:
        typeof effects.towersDisabled === 'boolean' ? effects.towersDisabled : fallback?.effects.towersDisabled,
      goldStartPenalty:
        typeof effects.goldStartPenalty === 'number'
          ? clampNonNegative(effects.goldStartPenalty, 0)
          : fallback?.effects.goldStartPenalty,
      addExtraSpawnBorder:
        typeof effects.addExtraSpawnBorder === 'boolean'
          ? effects.addExtraSpawnBorder
          : fallback?.effects.addExtraSpawnBorder
    },
    icon: asString(value.icon, fallback?.icon ?? '')
  }
}

const migrateNightModifiers = (legacy: Record<string, unknown>, fallback: LevelDefinition): NightModifierDef[] => {
  const raw = asArray<unknown>(legacy.nightModifiers, fallback.nightModifiers ?? DEFAULT_NIGHT_MODIFIERS)
  if (raw.length === 0) {
    return DEFAULT_NIGHT_MODIFIERS.map((entry) => ({ ...entry, effects: { ...entry.effects } }))
  }
  return raw
    .map((entry, index) => normalizeNightModifier(asObject(entry), (fallback.nightModifiers ?? DEFAULT_NIGHT_MODIFIERS)[index]))
    .filter((entry) => entry.id.trim().length > 0)
}

const migrateAllowedNightModifiersByNight = (
  legacy: Record<string, unknown>,
  fallback: LevelDefinition,
  nightModifiers: NightModifierDef[]
): Record<number, NightModifierId[]> => {
  const fallbackMap = fallback.allowedNightModifiersByNight ?? {}
  const raw = asObject(legacy.allowedNightModifiersByNight)
  const allowedIds = new Set(nightModifiers.map((entry) => entry.id))
  const next: Record<number, NightModifierId[]> = {}
  Object.keys(raw).forEach((nightKey) => {
    const night = Math.max(1, Math.floor(asNumber(Number(nightKey), 1)))
    const ids = asArray<string>(raw[nightKey], [])
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && allowedIds.has(id))
    next[night] = Array.from(new Set(ids))
  })
  if (Object.keys(next).length > 0) return next
  return Object.keys(fallbackMap).reduce<Record<number, NightModifierId[]>>((acc, key) => {
    const night = Math.max(1, Math.floor(Number(key)))
    const ids = (fallbackMap[night] ?? fallbackMap[Number(key)] ?? []).filter((id) => allowedIds.has(id))
    if (ids.length > 0) acc[night] = Array.from(new Set(ids))
    return acc
  }, {})
}

const normalizePerk = (value: Record<string, unknown>, fallback?: PerkDef): PerkDef => {
  const effects = asObject(value.effects)
  return {
    id: asString(value.id, fallback?.id ?? ''),
    name: asString(value.name, fallback?.name ?? 'Perk'),
    description: asString(value.description, fallback?.description ?? ''),
    maxStacks:
      typeof value.maxStacks === 'number'
        ? Math.max(1, Math.floor(value.maxStacks))
        : fallback?.maxStacks,
    effects: {
      towerRangeMultiplier:
        typeof effects.towerRangeMultiplier === 'number' ? effects.towerRangeMultiplier : fallback?.effects.towerRangeMultiplier,
      towerDamageMultiplier:
        typeof effects.towerDamageMultiplier === 'number' ? effects.towerDamageMultiplier : fallback?.effects.towerDamageMultiplier,
      goldRewardMultiplier:
        typeof effects.goldRewardMultiplier === 'number' ? effects.goldRewardMultiplier : fallback?.effects.goldRewardMultiplier,
      buildingUpgradeCostMultiplier:
        typeof effects.buildingUpgradeCostMultiplier === 'number'
          ? effects.buildingUpgradeCostMultiplier
          : fallback?.effects.buildingUpgradeCostMultiplier,
      rangedUnitsDamageMultiplier:
        typeof effects.rangedUnitsDamageMultiplier === 'number'
          ? effects.rangedUnitsDamageMultiplier
          : fallback?.effects.rangedUnitsDamageMultiplier,
      wallHpMultiplier:
        typeof effects.wallHpMultiplier === 'number' ? effects.wallHpMultiplier : fallback?.effects.wallHpMultiplier,
      endOfNightBonusGoldPerStrongholdLevel:
        typeof effects.endOfNightBonusGoldPerStrongholdLevel === 'number'
          ? effects.endOfNightBonusGoldPerStrongholdLevel
          : fallback?.effects.endOfNightBonusGoldPerStrongholdLevel
    },
    icon: asString(value.icon, fallback?.icon ?? '')
  }
}

const migratePerks = (legacy: Record<string, unknown>, fallback: LevelDefinition): PerkDef[] => {
  const raw = asArray<unknown>(legacy.perks, fallback.perks ?? DEFAULT_PERKS)
  if (raw.length === 0) {
    return DEFAULT_PERKS.map((entry) => ({ ...entry, effects: { ...entry.effects } }))
  }
  return raw
    .map((entry, index) => normalizePerk(asObject(entry), (fallback.perks ?? DEFAULT_PERKS)[index]))
    .filter((entry) => entry.id.trim().length > 0)
}

const migratePerkPool = (legacy: Record<string, unknown>, fallback: LevelDefinition, perks: PerkDef[]): PerkId[] => {
  const allowed = new Set(perks.map((entry) => entry.id))
  const source = asArray<string>(
    legacy.perkPool,
    (fallback.perkPool && fallback.perkPool.length > 0 ? fallback.perkPool : perks.map((entry) => entry.id))
  )
  const normalized = source.map((id) => id.trim()).filter((id) => id.length > 0 && allowed.has(id))
  return Array.from(new Set(normalized))
}

const normalizeEnemyTrait = (value: Record<string, unknown>, fallback?: EnemyTraitDef): EnemyTraitDef => {
  const effects = asObject(value.effects)
  const onDeathExplosion = asObject(effects.onDeathExplosion)
  return {
    id: asString(value.id, fallback?.id ?? ''),
    name: asString(value.name, fallback?.name ?? 'Trait'),
    description: asString(value.description, fallback?.description ?? ''),
    icon: asString(value.icon, fallback?.icon ?? ''),
    effects: {
      rangedDamageTakenMultiplier:
        typeof effects.rangedDamageTakenMultiplier === 'number'
          ? clampNonNegative(effects.rangedDamageTakenMultiplier, 1)
          : fallback?.effects.rangedDamageTakenMultiplier,
      onDeathExplosion:
        typeof onDeathExplosion.radius === 'number' && typeof onDeathExplosion.damage === 'number'
          ? {
              radius: clampNonNegative(onDeathExplosion.radius, 0),
              damage: clampNonNegative(onDeathExplosion.damage, 0)
            }
          : fallback?.effects.onDeathExplosion,
      targetingPriority:
        effects.targetingPriority === 'TOWERS_FIRST' || effects.targetingPriority === 'DEFAULT'
          ? effects.targetingPriority
          : fallback?.effects.targetingPriority,
      ignoresWalls: typeof effects.ignoresWalls === 'boolean' ? effects.ignoresWalls : fallback?.effects.ignoresWalls
    }
  }
}

const migrateEnemyTraits = (legacy: Record<string, unknown>, fallback: LevelDefinition): EnemyTraitDef[] => {
  const raw = asArray<unknown>(legacy.enemyTraits, fallback.enemyTraits ?? DEFAULT_ENEMY_TRAITS)
  if (raw.length === 0) {
    return DEFAULT_ENEMY_TRAITS.map((entry) => ({ ...entry, effects: { ...entry.effects } }))
  }
  return raw
    .map((entry, index) => normalizeEnemyTrait(asObject(entry), (fallback.enemyTraits ?? DEFAULT_ENEMY_TRAITS)[index]))
    .filter((entry) => entry.id.trim().length > 0)
}

const migrateEliteConfig = (legacy: Record<string, unknown>, fallback: LevelDefinition): EliteConfig => {
  const value = asObject(legacy.eliteConfig)
  const outline = asObject(value.outline)
  const fallbackConfig = fallback.eliteConfig ?? DEFAULT_ELITE_CONFIG
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallbackConfig.enabled,
    hpMultiplier: clampNonNegative(asNumber(value.hpMultiplier, fallbackConfig.hpMultiplier), fallbackConfig.hpMultiplier),
    damageMultiplier: clampNonNegative(asNumber(value.damageMultiplier, fallbackConfig.damageMultiplier), fallbackConfig.damageMultiplier),
    moveSpeedMultiplier:
      typeof value.moveSpeedMultiplier === 'number'
        ? clampNonNegative(value.moveSpeedMultiplier, fallbackConfig.moveSpeedMultiplier ?? 1)
        : fallbackConfig.moveSpeedMultiplier,
    outline: {
      enabled: typeof outline.enabled === 'boolean' ? outline.enabled : fallbackConfig.outline.enabled,
      color: outline.color === 'YELLOW' ? 'YELLOW' : fallbackConfig.outline.color
    },
    announceInIntel:
      typeof value.announceInIntel === 'boolean' ? value.announceInIntel : fallbackConfig.announceInIntel,
    icon: asString(value.icon, fallbackConfig.icon ?? '')
  }
}

const migrateHeroLoadout = (legacy: Record<string, unknown>, fallback: LevelDefinition, hero: LevelHeroTuning): HeroLoadout => {
  const base = fallback.heroLoadout
  const raw = asObject(legacy.heroLoadout)
  const abilities = asObject(raw.abilities)
  const q = asObject(abilities.q)
  const e = asObject(abilities.e)
  return {
    id: asString(raw.id, base.id),
    name: asString(raw.name, base.name),
    description: asString(raw.description, base.description),
    baseStats: hero.startingStats,
    growthPerDay: (() => {
      const growth = asObject(raw.growthPerDay)
      const fallbackGrowth = base.growthPerDay ?? { hp: 0, attack: 0 }
      return {
        hp: clampNonNegative(asNumber(growth.hp, fallbackGrowth.hp), fallbackGrowth.hp),
        attack: clampNonNegative(asNumber(growth.attack, fallbackGrowth.attack), fallbackGrowth.attack)
      }
    })(),
    abilities: {
      q: {
        id: 'q',
        name: asString(q.name, base.abilities.q.name),
        description: asString(q.description, base.abilities.q.description),
        cooldown: clampNonNegative(asNumber(q.cooldown, base.abilities.q.cooldown), base.abilities.q.cooldown),
        damage: clampNonNegative(asNumber(q.damage, base.abilities.q.damage ?? 0), base.abilities.q.damage ?? 0),
        radius: clampNonNegative(asNumber(q.radius, base.abilities.q.radius ?? 0), base.abilities.q.radius ?? 0),
        heal: clampNonNegative(asNumber(q.heal, base.abilities.q.heal ?? 0), base.abilities.q.heal ?? 0),
        dash: clampNonNegative(asNumber(q.dash, base.abilities.q.dash ?? 0), base.abilities.q.dash ?? 0)
      },
      e: {
        id: 'e',
        name: asString(e.name, base.abilities.e.name),
        description: asString(e.description, base.abilities.e.description),
        cooldown: clampNonNegative(asNumber(e.cooldown, base.abilities.e.cooldown), base.abilities.e.cooldown),
        damage: clampNonNegative(asNumber(e.damage, base.abilities.e.damage ?? 0), base.abilities.e.damage ?? 0),
        radius: clampNonNegative(asNumber(e.radius, base.abilities.e.radius ?? 0), base.abilities.e.radius ?? 0),
        heal: clampNonNegative(asNumber(e.heal, base.abilities.e.heal ?? 0), base.abilities.e.heal ?? 0),
        dash: clampNonNegative(asNumber(e.dash, base.abilities.e.dash ?? 0), base.abilities.e.dash ?? 0)
      }
    }
  }
}

const migrateBuildingPads = (legacy: Record<string, unknown>, fallback: LevelDefinition): BuildingPad[] => {
  const raw = asArray<unknown>(legacy.buildingPads, fallback.buildingPads as unknown[])
  return raw.map((rawPad, index) => {
    const pad = asObject(rawPad)
    const position = asObject(pad.position)
    const rawAllowedTypes = asArray<BuildingId>(pad.allowedTypes, []).filter((id): id is BuildingId => Boolean(BUILDING_DEFS[id]))
    const rawAllowedBuildingType = asString(pad.allowedBuildingType, '') as BuildingId
    const fixedAllowedType = BUILDING_DEFS[rawAllowedBuildingType] ? rawAllowedBuildingType : undefined
    const normalizedInputAllowedTypes = fixedAllowedType ? [fixedAllowedType] : rawAllowedTypes
    const rawPadType = asString(pad.padType, '')
    const inferredPadType = inferPadType(normalizedInputAllowedTypes)
    const padType: PadType =
      rawPadType === 'UNIT_PRODUCER' || rawPadType === 'HERO' || rawPadType === 'TOWER_ONLY'
        ? (rawPadType as PadType)
        : inferredPadType
    const allowedTypes = Array.from(
      new Set(
        (normalizedInputAllowedTypes.length > 0
          ? normalizedInputAllowedTypes
          : getAllowedBuildingTypesForPadType(padType)).filter((buildingId) =>
          isBuildingAllowedOnPadType(padType, buildingId)
        )
      )
    )
    const normalizedAllowedTypes = allowedTypes.length > 0 ? [allowedTypes[0]] : getAllowedBuildingTypesForPadType(padType).slice(0, 1)
    const unlockLevelRaw = asNumber(pad.unlockLevel, NaN)
    const unlockLevel = Number.isFinite(unlockLevelRaw) ? Math.max(1, Math.floor(unlockLevelRaw)) : undefined
    return {
      id: asString(pad.id, `pad_${index}`),
      x: asNumber(position.x, asNumber(pad.x, 0)),
      y: asNumber(position.y, asNumber(pad.y, 0)),
      rotation: asNumber(pad.rotation, 0),
      padType,
      allowedBuildingType: normalizedAllowedTypes[0],
      allowedTypes: normalizedAllowedTypes,
      unlockLevel
    }
  })
}

const migrateStartingBuildings = (
  legacy: Record<string, unknown>,
  fallback: LevelDefinition
): Array<{ id: BuildingId; level: number; padId: string }> => {
  const raw = asArray<Record<string, unknown>>(legacy.startingBuildings, fallback.startingBuildings)
  return raw
    .map((item) => {
      const id = asString(item.id, '') as BuildingId
      if (!BUILDING_DEFS[id]) return null
      return {
        id,
        level: clampNonNegative(asNumber(item.level, 1), 1),
        padId: asString(item.padId, '')
      }
    })
    .filter((item): item is { id: BuildingId; level: number; padId: string } => Boolean(item))
}

const migrateGoals = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelGoal[] => {
  const raw = asArray<unknown>(legacy.goals, fallback.goals as unknown[])
  return raw.map((rawGoal, index) => {
    const goal = asObject(rawGoal)
    return {
    id: asString(goal.id, `goal_${index + 1}`),
    type: (() => {
      const value = asString(goal.type, 'survive_days')
      return isGoalType(value) ? value : 'survive_days'
    })(),
    label: asString(goal.label, 'Goal'),
    target: clampNonNegative(asNumber(goal.target, 1), 1),
    day: typeof goal.day === 'number' ? goal.day : undefined
    }
  })
}

const migrateSpawnEdges = (raw: unknown): SpawnEdgeConfig[] | undefined => {
  const entries = asArray<unknown>(raw, [])
  if (entries.length === 0) return undefined
  const seen = new Set<SpawnEdge>()
  const normalized: SpawnEdgeConfig[] = []
  entries.forEach((entry) => {
    if (typeof entry === 'string') {
      const edge = entry.trim().toUpperCase()
      if (isSpawnEdge(edge) && !seen.has(edge)) {
        seen.add(edge)
        normalized.push({ edge })
      }
      return
    }
    const value = asObject(entry)
    const edgeValue = asString(value.edge, '').trim().toUpperCase()
    if (!isSpawnEdge(edgeValue) || seen.has(edgeValue)) return
    seen.add(edgeValue)
    const weight = typeof value.weight === 'number' ? clampNonNegative(value.weight, 1) : undefined
    normalized.push({
      edge: edgeValue,
      weight: weight === 1 ? undefined : weight
    })
  })
  return normalized.length > 0 ? normalized : undefined
}

const migrateSpawnPointsPerEdge = (raw: unknown): SpawnPointCount | undefined => {
  if (typeof raw === 'number') {
    return Math.max(1, Math.floor(clampNonNegative(raw, 1)))
  }
  const value = asObject(raw)
  if (Object.keys(value).length === 0) return undefined
  const hasMin = typeof value.min === 'number'
  const hasMax = typeof value.max === 'number'
  if (!hasMin && !hasMax) return undefined
  const min = Math.max(1, Math.floor(asNumber(value.min, 1)))
  const max = Math.max(min, Math.floor(asNumber(value.max, min)))
  return { min, max }
}

const migrateTraitIds = (raw: unknown, traitIds: Set<string>): EnemyTraitId[] | undefined => {
  const entries = asArray<string>(raw, [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && traitIds.has(entry))
  if (entries.length === 0) return undefined
  return Array.from(new Set(entries))
}

const migrateDays = (
  legacy: Record<string, unknown>,
  fallback: LevelDefinition,
  enemyTraits: EnemyTraitDef[]
): DayPlan[] => {
  const traitIds = new Set(enemyTraits.map((entry) => entry.id))
  const rawDays = asArray<unknown>(legacy.days, fallback.days as unknown[])
  return rawDays.map((rawDay, index) => {
    const day = asObject(rawDay)
    const waves = asArray<Record<string, unknown>>(day.waves, []).map((wave, waveIndex) => ({
      id: asString(wave.id, `d${index + 1}_w${waveIndex + 1}`),
      units: asArray<Record<string, unknown>>(wave.units, []).map((unit) => ({
        type: (() => {
          const type = asString(unit.type, 'infantry')
          return UNIT_DEFS[type as UnitType] ? (type as UnitType) : 'infantry'
        })(),
        squads: clampNonNegative(asNumber(unit.squads, 1), 1),
        squadSize: typeof unit.squadSize === 'number' ? clampNonNegative(unit.squadSize, 1) : undefined
      })),
      traits: migrateTraitIds(wave.traits, traitIds),
      eliteChance: typeof wave.eliteChance === 'number' ? Math.min(1, clampNonNegative(wave.eliteChance, 0)) : undefined,
      groups: asArray<Record<string, unknown>>(wave.groups, []).map((group) => ({
        enemyTypeId: (() => {
          const type = asString(group.enemyTypeId, 'infantry')
          return UNIT_DEFS[type as UnitType] ? (type as UnitType) : 'infantry'
        })(),
        count: clampNonNegative(asNumber(group.count, 1), 1),
        traits: migrateTraitIds(group.traits, traitIds),
        eliteChance: typeof group.eliteChance === 'number' ? Math.min(1, clampNonNegative(group.eliteChance, 0)) : undefined
      })),
      spawnTimeSec: typeof wave.spawnTimeSec === 'number' ? clampNonNegative(wave.spawnTimeSec, 0) : undefined,
      elite: (() => {
        if (typeof wave.elite !== 'string') return undefined
        return ELITE_DEFS[wave.elite as EliteId] ? (wave.elite as EliteId) : undefined
      })(),
      eliteCount: typeof wave.eliteCount === 'number' ? clampNonNegative(wave.eliteCount, 1) : undefined,
      spawnEdges: migrateSpawnEdges(wave.spawnEdges),
      spawnPointsPerEdge: migrateSpawnPointsPerEdge(wave.spawnPointsPerEdge),
      spawnPadding: typeof wave.spawnPadding === 'number' ? clampNonNegative(wave.spawnPadding, 0) : undefined
    }))
    const enemyModifiers = asObject(day.enemyModifiers)
    return {
      day: clampNonNegative(asNumber(day.day, index + 1), index + 1),
      waveMode: asString(day.waveMode, 'sequential') as DayPlan['waveMode'],
      waveDelaySec: typeof day.waveDelaySec === 'number' ? clampNonNegative(day.waveDelaySec, 0) : undefined,
      enemyModifiers: {
        hpMultiplier: clampNonNegative(asNumber(enemyModifiers.hpMultiplier, 1), 1),
        attackMultiplier: clampNonNegative(asNumber(enemyModifiers.attackMultiplier, 1), 1)
      },
      miniBossAfterWave:
        typeof day.miniBossAfterWave === 'number' ? clampNonNegative(day.miniBossAfterWave, 0) : undefined,
      miniBossId: (() => {
        if (typeof day.miniBossId !== 'string') return undefined
        return ELITE_DEFS[day.miniBossId as EliteId] ? (day.miniBossId as EliteId) : undefined
      })(),
      waves
    }
  })
}

const migrateMap = (legacy: Record<string, unknown>, fallback: LevelDefinition): LevelDefinition['map'] => {
  const raw = asObject(legacy.map)
  const defaults = fallback.map
  return {
    width: clampNonNegative(asNumber(raw.width, defaults.width), defaults.width),
    height: clampNonNegative(asNumber(raw.height, defaults.height), defaults.height),
    obstacleDensityMultiplier:
      typeof raw.obstacleDensityMultiplier === 'number'
        ? clampNonNegative(asNumber(raw.obstacleDensityMultiplier, defaults.obstacleDensityMultiplier ?? 1.2), 1)
        : defaults.obstacleDensityMultiplier,
    obstacles: asArray<Record<string, unknown>>(raw.obstacles, defaults.obstacles).map((obs) => ({
      x: asNumber(obs.x, 0),
      y: asNumber(obs.y, 0),
      w: clampNonNegative(asNumber(obs.w, 1), 1),
      h: clampNonNegative(asNumber(obs.h, 1), 1)
    })),
    playerSpawn: {
      x: asNumber(asObject(raw.playerSpawn).x, defaults.playerSpawn.x),
      y: asNumber(asObject(raw.playerSpawn).y, defaults.playerSpawn.y)
    },
    enemySpawn: {
      x: asNumber(asObject(raw.enemySpawn).x, defaults.enemySpawn.x),
      y: asNumber(asObject(raw.enemySpawn).y, defaults.enemySpawn.y)
    },
    playerHQ: {
      x: asNumber(asObject(raw.playerHQ).x, defaults.playerHQ.x),
      y: asNumber(asObject(raw.playerHQ).y, defaults.playerHQ.y)
    }
  }
}

export const migrateLevelDefinition = (input: unknown): LevelDefinition => {
  const fallback = createDefaultLevelDefinition()
  const legacy = asObject(input)
  const metadata = migrateMetadata(legacy, fallback)
  const economy = migrateEconomy(legacy, fallback)
  const padConstraints = migratePadConstraints(legacy, fallback)
  const producerDefaults = migrateProducerDefaults(legacy, fallback)
  const minibossRules = migrateMinibossRules(legacy, fallback)
  const rawStronghold = migrateStronghold(legacy, fallback)
  const hero = migrateHero(legacy, fallback)
  const heroLoadout = migrateHeroLoadout(legacy, fallback, hero)
  const nightModifiers = migrateNightModifiers(legacy, fallback)
  const perks = migratePerks(legacy, fallback)
  const enemyTraits = migrateEnemyTraits(legacy, fallback)
  const eliteConfig = migrateEliteConfig(legacy, fallback)
  const allowedNightModifiersByNight = migrateAllowedNightModifiersByNight(legacy, fallback, nightModifiers)
  const perkPool = migratePerkPool(legacy, fallback, perks)
  const buildingPads = migrateBuildingPads(legacy, fallback)
  const normalizedPadUnlockLevels: Record<string, number> = {}
  buildingPads.forEach((pad) => {
    const fallbackUnlock = rawStronghold.padUnlockLevels[pad.id] ?? 1
    normalizedPadUnlockLevels[pad.id] =
      typeof pad.unlockLevel === 'number' ? Math.max(1, Math.floor(pad.unlockLevel)) : Math.max(1, Math.floor(fallbackUnlock))
  })
  const stronghold = {
    ...rawStronghold,
    padUnlockLevels: normalizedPadUnlockLevels,
    padUnlocksByLevel: buildPadUnlocksByLevelFromLevels(normalizedPadUnlockLevels)
  }
  const migrated: LevelDefinition = {
    version: LEVEL_DEFINITION_VERSION,
    metadata,
    economy,
    padConstraints,
    producerDefaults,
    minibossRules,
    stronghold,
    buildings: migrateBuildings(legacy, fallback),
    units: migrateUnits(legacy, fallback),
    enemies: { catalog: migrateEnemyCatalog(legacy, fallback) },
    waves: migrateWaves(legacy, fallback),
    hero,
    modifiers: migrateModifiers(legacy, fallback),
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    startGold: economy.startingGold,
    dayRewardGold: economy.endOfDayGoldBonus,
    dayRewardScale: economy.endOfDayGoldScale,
    heroLoadout,
    bossId: (() => {
      if (typeof legacy.bossId === 'string' && ELITE_DEFS[legacy.bossId as EliteId]) return legacy.bossId as EliteId
      return 'boss'
    })(),
    nightModifiers,
    allowedNightModifiersByNight,
    perks,
    perkPool,
    perkChoicesPerNight: clampNonNegative(asNumber(legacy.perkChoicesPerNight, fallback.perkChoicesPerNight ?? 3), 3),
    perkMaxCount: clampNonNegative(asNumber(legacy.perkMaxCount, fallback.perkMaxCount ?? 5), 5),
    enemyTraits,
    eliteConfig,
    buildingPads,
    startingBuildings: migrateStartingBuildings(legacy, fallback),
    goals: migrateGoals(legacy, fallback),
    days: migrateDays(legacy, fallback, enemyTraits),
    map: migrateMap(legacy, fallback)
  }
  return migrated
}

const pushIssue = (issues: LevelValidationIssue[], severity: ValidationSeverity, path: string, message: string) => {
  issues.push({ severity, path, message })
}

export const validateLevelDefinition = (level: LevelDefinition): LevelValidationResult => {
  const issues: LevelValidationIssue[] = []
  if (!level.id.trim()) {
    pushIssue(issues, 'error', 'id', 'Level id is required.')
  }
  if (!level.name.trim()) {
    pushIssue(issues, 'error', 'name', 'Level name is required.')
  }
  if (level.startGold < 0) {
    pushIssue(issues, 'error', 'startGold', 'Starting gold cannot be negative.')
  }
  if (level.dayRewardGold < 0) {
    pushIssue(issues, 'error', 'dayRewardGold', 'End-of-day bonus gold cannot be negative.')
  }

  const padIds = new Set<string>()
  const buildingIds = new Set<BuildingId>(Object.keys(BUILDING_DEFS) as BuildingId[])
  level.buildingPads.forEach((pad, index) => {
    if (!pad.id.trim()) pushIssue(issues, 'error', `buildingPads.${index}.id`, 'Pad id is required.')
    if (padIds.has(pad.id)) pushIssue(issues, 'error', `buildingPads.${index}.id`, `Duplicate pad id "${pad.id}".`)
    padIds.add(pad.id)
    if (pad.x < 0 || pad.x > level.map.width || pad.y < 0 || pad.y > level.map.height) {
      pushIssue(
        issues,
        'warning',
        `buildingPads.${index}`,
        `Pad "${pad.id}" is outside map bounds ${level.map.width}x${level.map.height}.`
      )
    }
    if (!Number.isFinite(pad.rotation ?? 0)) {
      pushIssue(issues, 'error', `buildingPads.${index}.rotation`, 'Pad rotation must be a finite number.')
    }
    if (pad.unlockLevel !== undefined && pad.unlockLevel < 1) {
      pushIssue(issues, 'error', `buildingPads.${index}.unlockLevel`, 'Pad unlock level must be >= 1.')
    }
    if (pad.allowedTypes.length !== 1) {
      pushIssue(
        issues,
        'warning',
        `buildingPads.${index}.allowedTypes`,
        'Pads are expected to have exactly one allowed building type.'
      )
    }
    if (pad.allowedBuildingType && !pad.allowedTypes.includes(pad.allowedBuildingType)) {
      pushIssue(
        issues,
        'warning',
        `buildingPads.${index}.allowedBuildingType`,
        'allowedBuildingType is not present in allowedTypes and will be normalized.'
      )
    }
    pad.allowedTypes.forEach((id, allowedIndex) => {
      if (!buildingIds.has(id)) {
        pushIssue(issues, 'error', `buildingPads.${index}.allowedTypes.${allowedIndex}`, `Unknown building type "${id}".`)
        return
      }
      if (!isBuildingAllowedOnPad(pad, id)) {
        pushIssue(
          issues,
          'warning',
          `buildingPads.${index}.allowedTypes.${allowedIndex}`,
          `Building "${id}" does not match pad type "${pad.padType}".`
        )
      }
    })
  })

  const padCounts = countPadsByType(level)
  if (padCounts.tower < level.padConstraints.minTowerPads) {
    pushIssue(
      issues,
      'error',
      'padConstraints.minTowerPads',
      `Tower-only pads are below minimum (${padCounts.tower}/${level.padConstraints.minTowerPads}).`
    )
  }
  if (padCounts.producer > level.padConstraints.maxUnitProducerPads) {
    pushIssue(
      issues,
      'error',
      'padConstraints.maxUnitProducerPads',
      `Unit producer pads exceed max (${padCounts.producer}/${level.padConstraints.maxUnitProducerPads}).`
    )
  }
  if (padCounts.hero > level.padConstraints.maxHeroPads) {
    pushIssue(
      issues,
      'error',
      'padConstraints.maxHeroPads',
      `Hero pads exceed max (${padCounts.hero}/${level.padConstraints.maxHeroPads}).`
    )
  }

  const unlockLevels = level.stronghold.padUnlockLevels
  Object.keys(unlockLevels).forEach((padId) => {
    const unlockLevel = unlockLevels[padId]
    if (!padIds.has(padId)) {
      pushIssue(issues, 'error', `stronghold.padUnlockLevels.${padId}`, `Pad "${padId}" does not exist in buildingPads.`)
    }
    if (unlockLevel < 1) {
      pushIssue(issues, 'error', `stronghold.padUnlockLevels.${padId}`, 'Pad unlock level must be >= 1.')
    }
    if (unlockLevel > level.stronghold.maxLevel) {
      pushIssue(
        issues,
        'warning',
        `stronghold.padUnlockLevels.${padId}`,
        `Pad unlock level (${unlockLevel}) is above stronghold max level (${level.stronghold.maxLevel}).`
      )
    }
  })

  const padLevelAssignments = new Map<string, number>()
  Object.keys(level.stronghold.padUnlocksByLevel).forEach((levelKey) => {
    const unlockLevel = Number(levelKey)
    if (!Number.isFinite(unlockLevel) || unlockLevel < 1) {
      pushIssue(issues, 'error', `stronghold.padUnlocksByLevel.${levelKey}`, 'Stronghold level key must be a number >= 1.')
      return
    }
    const entries = level.stronghold.padUnlocksByLevel[levelKey] ?? []
    const seenAtLevel = new Set<string>()
    entries.forEach((padId, index) => {
      if (!padIds.has(padId)) {
        pushIssue(issues, 'error', `stronghold.padUnlocksByLevel.${levelKey}.${index}`, `Pad "${padId}" does not exist in buildingPads.`)
      }
      if (seenAtLevel.has(padId)) {
        pushIssue(
          issues,
          'error',
          `stronghold.padUnlocksByLevel.${levelKey}.${index}`,
          `Pad "${padId}" is duplicated at stronghold level ${unlockLevel}.`
        )
      }
      seenAtLevel.add(padId)
      if (padLevelAssignments.has(padId)) {
        pushIssue(
          issues,
          'warning',
          `stronghold.padUnlocksByLevel.${levelKey}.${index}`,
          `Pad "${padId}" appears in multiple unlock levels (${padLevelAssignments.get(padId)} and ${unlockLevel}).`
        )
      } else {
        padLevelAssignments.set(padId, unlockLevel)
      }
    })
  })

  const derivedPadUnlockLevels = buildPadUnlockLevelsFromByLevel(level.stronghold.padUnlocksByLevel)
  Object.keys(derivedPadUnlockLevels).forEach((padId) => {
    const byLevelUnlock = derivedPadUnlockLevels[padId]
    const directUnlock = unlockLevels[padId]
    if (typeof directUnlock === 'number' && directUnlock !== byLevelUnlock) {
      pushIssue(
        issues,
        'warning',
        `stronghold.padUnlockLevels.${padId}`,
        `padUnlockLevels (${directUnlock}) does not match padUnlocksByLevel (${byLevelUnlock}); runtime will normalize it.`
      )
    }
  })

  level.startingBuildings.forEach((building, index) => {
    if (!buildingIds.has(building.id)) {
      pushIssue(issues, 'error', `startingBuildings.${index}.id`, `Unknown building id "${building.id}".`)
    }
    if (!padIds.has(building.padId)) {
      pushIssue(issues, 'error', `startingBuildings.${index}.padId`, `Unknown pad id "${building.padId}".`)
    } else {
      const pad = level.buildingPads.find((entry) => entry.id === building.padId)
      if (pad && !isBuildingAllowedOnPad(pad, building.id)) {
        pushIssue(
          issues,
          'error',
          `startingBuildings.${index}`,
          `Building "${building.id}" is not allowed on pad "${building.padId}".`
        )
      }
    }
    if (building.level < 1) {
      pushIssue(issues, 'error', `startingBuildings.${index}.level`, 'Starting level must be >= 1.')
    }
  })

  const enemyCatalog = new Set(level.enemies.catalog.map((entry) => entry.id))
  ;(Object.keys(UNIT_DEFS) as UnitType[]).forEach((id) => {
    if (!enemyCatalog.has(id)) {
      pushIssue(issues, 'warning', 'enemies.catalog', `Enemy catalog is missing unit type "${id}".`)
    }
  })

  const nightModifierIds = new Set<string>()
  ;(level.nightModifiers ?? []).forEach((entry, index) => {
    if (!entry.id.trim()) {
      pushIssue(issues, 'error', `nightModifiers.${index}.id`, 'Night modifier id is required.')
      return
    }
    if (nightModifierIds.has(entry.id)) {
      pushIssue(issues, 'error', `nightModifiers.${index}.id`, `Duplicate night modifier id "${entry.id}".`)
    }
    nightModifierIds.add(entry.id)
    if (entry.rewardMultiplier < 1) {
      pushIssue(issues, 'warning', `nightModifiers.${index}.rewardMultiplier`, 'Reward multiplier is expected to be >= 1.')
    }
  })

  Object.keys(level.allowedNightModifiersByNight ?? {}).forEach((nightKey) => {
    const night = Number(nightKey)
    if (!Number.isFinite(night) || night < 1) {
      pushIssue(issues, 'error', `allowedNightModifiersByNight.${nightKey}`, 'Night key must be a positive number.')
      return
    }
    const ids = (level.allowedNightModifiersByNight ?? {})[night] ?? []
    ids.forEach((id, index) => {
      if (!nightModifierIds.has(id)) {
        pushIssue(
          issues,
          'error',
          `allowedNightModifiersByNight.${nightKey}.${index}`,
          `Unknown night modifier "${id}".`
        )
      }
    })
  })

  const perkIds = new Set<string>()
  ;(level.perks ?? []).forEach((entry, index) => {
    if (!entry.id.trim()) {
      pushIssue(issues, 'error', `perks.${index}.id`, 'Perk id is required.')
      return
    }
    if (perkIds.has(entry.id)) {
      pushIssue(issues, 'error', `perks.${index}.id`, `Duplicate perk id "${entry.id}".`)
    }
    perkIds.add(entry.id)
  })
  ;(level.perkPool ?? []).forEach((perkId, index) => {
    if (!perkIds.has(perkId)) {
      pushIssue(issues, 'error', `perkPool.${index}`, `Unknown perk "${perkId}".`)
    }
  })
  if ((level.perkChoicesPerNight ?? 3) < 1) {
    pushIssue(issues, 'error', 'perkChoicesPerNight', 'perkChoicesPerNight must be >= 1.')
  }
  if ((level.perkMaxCount ?? 5) < 1) {
    pushIssue(issues, 'error', 'perkMaxCount', 'perkMaxCount must be >= 1.')
  }

  const enemyTraitIds = new Set<string>()
  ;(level.enemyTraits ?? []).forEach((trait, index) => {
    if (!trait.id.trim()) {
      pushIssue(issues, 'error', `enemyTraits.${index}.id`, 'Enemy trait id is required.')
      return
    }
    if (enemyTraitIds.has(trait.id)) {
      pushIssue(issues, 'error', `enemyTraits.${index}.id`, `Duplicate enemy trait id "${trait.id}".`)
    }
    enemyTraitIds.add(trait.id)
    if (
      trait.effects.rangedDamageTakenMultiplier !== undefined &&
      (trait.effects.rangedDamageTakenMultiplier < 0 || trait.effects.rangedDamageTakenMultiplier > 1)
    ) {
      pushIssue(
        issues,
        'warning',
        `enemyTraits.${index}.effects.rangedDamageTakenMultiplier`,
        'rangedDamageTakenMultiplier is expected to be in [0, 1].'
      )
    }
  })

  if (level.eliteConfig && level.eliteConfig.enabled) {
    if (level.eliteConfig.hpMultiplier < 1) {
      pushIssue(issues, 'warning', 'eliteConfig.hpMultiplier', 'Elite HP multiplier is expected to be >= 1.')
    }
    if (level.eliteConfig.damageMultiplier < 1) {
      pushIssue(issues, 'warning', 'eliteConfig.damageMultiplier', 'Elite damage multiplier is expected to be >= 1.')
    }
  }

  level.days.forEach((day, dayIndex) => {
    if (day.day <= 0) {
      pushIssue(issues, 'error', `days.${dayIndex}.day`, 'Day number must be >= 1.')
    }
    day.waves.forEach((wave, waveIndex) => {
      if (!wave.id.trim()) {
        pushIssue(issues, 'error', `days.${dayIndex}.waves.${waveIndex}.id`, 'Wave id is required.')
      }
      if (wave.spawnEdges && wave.spawnEdges.length === 0) {
        pushIssue(issues, 'warning', `days.${dayIndex}.waves.${waveIndex}.spawnEdges`, 'Spawn edges list is empty and will be ignored.')
      }
      wave.spawnEdges?.forEach((edge, edgeIndex) => {
        if (!SPAWN_EDGES.includes(edge.edge)) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.spawnEdges.${edgeIndex}.edge`,
            `Unknown spawn edge "${edge.edge}".`
          )
        }
        if (edge.weight !== undefined && edge.weight <= 0) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.spawnEdges.${edgeIndex}.weight`,
            'Spawn edge weight must be > 0.'
          )
        }
      })
      if (typeof wave.spawnPointsPerEdge === 'number' && wave.spawnPointsPerEdge < 1) {
        pushIssue(
          issues,
          'error',
          `days.${dayIndex}.waves.${waveIndex}.spawnPointsPerEdge`,
          'spawnPointsPerEdge must be >= 1 when using a number.'
        )
      }
      if (typeof wave.spawnPointsPerEdge === 'object') {
        if (wave.spawnPointsPerEdge.min < 1) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.spawnPointsPerEdge.min`,
            'spawnPointsPerEdge.min must be >= 1.'
          )
        }
        if (wave.spawnPointsPerEdge.max < wave.spawnPointsPerEdge.min) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.spawnPointsPerEdge.max`,
            'spawnPointsPerEdge.max must be >= min.'
          )
        }
      }
      wave.traits?.forEach((traitId, traitIndex) => {
        if (!enemyTraitIds.has(traitId)) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.traits.${traitIndex}`,
            `Unknown enemy trait "${traitId}".`
          )
        }
      })
      if (wave.eliteChance !== undefined && (wave.eliteChance < 0 || wave.eliteChance > 1)) {
        pushIssue(
          issues,
          'error',
          `days.${dayIndex}.waves.${waveIndex}.eliteChance`,
          'eliteChance must be in range [0, 1].'
        )
      }
      wave.units.forEach((unit, unitIndex) => {
        if (!UNIT_DEFS[unit.type]) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.units.${unitIndex}.type`,
            `Unknown enemy type "${unit.type}".`
          )
        }
        if (!enemyCatalog.has(unit.type)) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.units.${unitIndex}.type`,
            `Wave references "${unit.type}" but it is not in enemy catalog.`
          )
        }
        if (unit.squads < 1) {
          pushIssue(issues, 'error', `days.${dayIndex}.waves.${waveIndex}.units.${unitIndex}.squads`, 'Squad count must be >= 1.')
        }
      })
      wave.groups?.forEach((group, groupIndex) => {
        if (!UNIT_DEFS[group.enemyTypeId]) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.groups.${groupIndex}.enemyTypeId`,
            `Unknown enemy type "${group.enemyTypeId}".`
          )
        }
        if (!enemyCatalog.has(group.enemyTypeId)) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.groups.${groupIndex}.enemyTypeId`,
            `Wave group references "${group.enemyTypeId}" but it is not in enemy catalog.`
          )
        }
        if (group.count < 1) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.groups.${groupIndex}.count`,
            'Group count must be >= 1.'
          )
        }
        group.traits?.forEach((traitId, traitIndex) => {
          if (!enemyTraitIds.has(traitId)) {
            pushIssue(
              issues,
              'error',
              `days.${dayIndex}.waves.${waveIndex}.groups.${groupIndex}.traits.${traitIndex}`,
              `Unknown enemy trait "${traitId}".`
            )
          }
        })
        if (group.eliteChance !== undefined && (group.eliteChance < 0 || group.eliteChance > 1)) {
          pushIssue(
            issues,
            'error',
            `days.${dayIndex}.waves.${waveIndex}.groups.${groupIndex}.eliteChance`,
            'eliteChance must be in range [0, 1].'
          )
        }
      })
    })
  })

  if (!level.minibossRules.suppressDay1MiniBoss) {
    pushIssue(
      issues,
      'warning',
      'minibossRules.suppressDay1MiniBoss',
      'Day 1 miniboss suppression is disabled. Runtime design expects this rule to stay enabled.'
    )
  }

  const dayOne = level.days.find((day) => day.day === 1)
  if (dayOne && (dayOne.miniBossAfterWave ?? 0) > 0) {
    pushIssue(
      issues,
      'warning',
      'days',
      'Day 1 has a miniboss configured, but runtime suppresses miniboss spawns on day 1.'
    )
  }

  if (level.stronghold.globalMaxBuildingLevelCap > 3) {
    pushIssue(
      issues,
      'warning',
      'stronghold.globalMaxBuildingLevelCap',
      'Global max building level is above 3. Runtime supports this as a dev override only.'
    )
  }

  if (level.stronghold.maxLevel < level.stronghold.startingLevel) {
    pushIssue(issues, 'warning', 'stronghold', 'Stronghold max level is below starting level.')
  }

  ;(Object.keys(BUILDING_DEFS) as BuildingId[]).forEach((id) => {
    const caps = level.stronghold.perBuildingLevelCaps[id]
    if (!Array.isArray(caps) || caps.length < level.stronghold.maxLevel) {
      pushIssue(
        issues,
        'warning',
        `stronghold.perBuildingLevelCaps.${id}`,
        `Per-level cap for "${id}" has fewer entries than stronghold max level (${level.stronghold.maxLevel}).`
      )
      return
    }
    caps.forEach((cap, index) => {
      if (cap > level.stronghold.globalMaxBuildingLevelCap) {
        pushIssue(
          issues,
          'warning',
          `stronghold.perBuildingLevelCaps.${id}.${index}`,
          `Cap exceeds global max building level cap (${level.stronghold.globalMaxBuildingLevelCap}).`
        )
      }
    })
  })

  const minBossRuleMet = level.days.every((day) => day.miniBossAfterWave === undefined || day.miniBossAfterWave >= 2)
  if (!minBossRuleMet) {
    pushIssue(issues, 'warning', 'days', 'Mini-boss is configured before wave 2 on at least one day.')
  }

  if (level.waves.enforceFinalBossOnLastDay) {
    const lastDay = level.days.reduce((best, day) => (day.day > best.day ? day : best), level.days[0])
    if (lastDay && lastDay.waves.length > 0) {
      const hasBoss = lastDay.waves[lastDay.waves.length - 1]?.elite === (level.bossId ?? 'boss')
      if (!hasBoss) {
        pushIssue(issues, 'warning', 'days', 'Final day does not end with the configured boss wave.')
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return {
    errors,
    warnings,
    isValid: errors.length === 0
  }
}

export const parseLevelDefinitionJson = (
  json: string
): { level: LevelDefinition | null; validation: LevelValidationResult; parseError?: string } => {
  try {
    const parsed = JSON.parse(json)
    const level = migrateLevelDefinition(parsed)
    const validation = validateLevelDefinition(level)
    return { level, validation }
  } catch (error) {
    return {
      level: null,
      validation: { errors: [], warnings: [], isValid: false },
      parseError: error instanceof Error ? error.message : 'Invalid JSON.'
    }
  }
}
