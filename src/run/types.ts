import { BuildingId } from '../config/buildings'
import { EnemyTraitId, NightModifierId, PerkId } from '../config/nightContent'
import { HeroRecruitId } from '../config/heroes'
import { UnitType } from '../config/units'
import { SpawnEdge, SpawnEdgeConfig, SpawnPointCount } from '../config/levels'

export type RunPhase = 'build' | 'battle_cry' | 'combat' | 'day_end' | 'win' | 'lose'

export interface RunBuilding {
  id: BuildingId
  level: number
  padId: string
  hp: number
  maxHp: number
  purchasedUnitsCount?: number
  heroSummonUsed?: number
}

export interface RunSquad {
  id: string
  type: UnitType
  size: number
  spawnPos?: { x: number; y: number }
  spawnPadId?: string
  ownerBuildingPadId?: string
  ownerBuildingId?: BuildingId
  ownerBuildingLevel?: number
}

export interface RunHero {
  id: string
  heroId: HeroRecruitId
  spawnPos?: { x: number; y: number }
  spawnPadId?: string
}

export interface IncomeLineItem {
  id: BuildingId
  name: string
  level: number
  amount: number
}

export interface IncomeBreakdown {
  total: number
  items: IncomeLineItem[]
  bonuses: number
  reward: number
  buildingTotal: number
}

export interface NightPlanSpawn {
  enemyTypeId: UnitType
  squadSize?: number
  traits: EnemyTraitId[]
  isEliteVariant: boolean
  eliteRoll: number
}

export interface NightPlanWave {
  id: string
  spawnTimeSec?: number
  spawnEdges?: SpawnEdgeConfig[]
  spawnPointsPerEdge?: SpawnPointCount
  spawnPadding?: number
  spawnSeed: string
  spawns: NightPlanSpawn[]
  legacyEliteId?: string
  legacyEliteCount?: number
}

export interface NextNightIntelWave {
  id: string
  spawnEdges: SpawnEdge[]
  enemyTypes: string[]
  traits: EnemyTraitId[]
  hasEliteVariant: boolean
}

export interface NightPlan {
  nightIndex: number
  rewardMultiplierPreview: number
  spawnEdges: SpawnEdge[]
  enemyTypesDistinct: string[]
  traitIdsDistinct: EnemyTraitId[]
  hasEliteWarning: boolean
  waves: NightPlanWave[]
  intel: NextNightIntelWave[]
}

export interface RunDebugOverrides {
  forceNightModifierId?: NightModifierId
  forcePerkId?: PerkId
  forceEnemyTraitId?: EnemyTraitId
  forceEliteVariant?: boolean
}

export interface RunState {
  levelId: string
  runSeed: number
  dayNumber: number
  daysSurvived: number
  gold: number
  totalGoldEarned: number
  strongholdLevel: number
  strongholdUpgradeInProgress?: null
  buildings: RunBuilding[]
  unitRoster: RunSquad[]
  heroRoster: RunHero[]
  heroChoice?: string
  heroProgress?: { hp: number; attack: number }
  goalsProgress: Record<string, number | boolean>
  bossDefeatedDays: number[]
  hqHpByDay: Record<number, number>
  lastIncome?: IncomeBreakdown
  difficultyScaling?: number
  activeNightModifier?: NightModifierId
  perks: Record<PerkId, { stacks: number }>
  nextNightPlan?: NightPlan
  debugOverrides?: RunDebugOverrides
}

export interface MetaState {
  unlockedLevels: string[]
  bestCompletion: Record<string, number>
  completedLevels: string[]
}
