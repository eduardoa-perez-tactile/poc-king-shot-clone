import { BuildingId } from '../config/buildings'
import { HeroRecruitId } from '../config/heroes'
import { UnitType } from '../config/units'

export type RunPhase = 'build' | 'combat' | 'day_end' | 'win' | 'lose'

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

export interface RunState {
  levelId: string
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
}

export interface MetaState {
  unlockedLevels: string[]
  bestCompletion: Record<string, number>
  completedLevels: string[]
}
