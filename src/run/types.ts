import { BuildingId } from '../config/buildings'
import { UnitType } from '../config/units'

export type RunPhase = 'build' | 'combat' | 'day_end' | 'win' | 'lose'

export interface RunBuilding {
  id: BuildingId
  level: number
  padId: string
}

export interface RunSquad {
  id: string
  type: UnitType
  size: number
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
  buildings: RunBuilding[]
  unitRoster: RunSquad[]
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
