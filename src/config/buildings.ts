import { UnitType } from './units'

export type BuildingId =
  | 'gold_mine'
  | 'house'
  | 'barracks'
  | 'range'
  | 'stable'
  | 'watchtower'
  | 'blacksmith'
  | 'hero_recruiter'

export interface BuildingDef {
  id: BuildingId
  name: string
  description: string
  baseCost: number
  upgradeBase: number
  upgradeScale: number
  maxLevel: number
  income?: {
    base: number
    perLevel: number
  }
  unlocksUnit?: UnitType
  bonuses?: {
    squadCapPerLevel?: number
    hqHpPerLevel?: number
    unitAttackPctPerLevel?: number
    unitHpPctPerLevel?: number
    unitTypeAttackPctPerLevel?: Partial<Record<UnitType, number>>
    unitTypeHpPctPerLevel?: Partial<Record<UnitType, number>>
  }
  heroRecruiter?: {
    summonLimit: number
  }
}

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  gold_mine: {
    id: 'gold_mine',
    name: 'Gold Mine',
    description: 'Steady income to fund the war effort.',
    baseCost: 60,
    upgradeBase: 60,
    upgradeScale: 1.6,
    maxLevel: 3,
    income: { base: 30, perLevel: 20 }
  },
  house: {
    id: 'house',
    name: 'House',
    description: 'Shelter that supports more squads.',
    baseCost: 40,
    upgradeBase: 50,
    upgradeScale: 1.6,
    maxLevel: 3,
    income: { base: 10, perLevel: 10 },
    bonuses: {
      squadCapPerLevel: 1
    }
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    description: 'Trains infantry squads.',
    baseCost: 80,
    upgradeBase: 70,
    upgradeScale: 1.6,
    maxLevel: 3,
    unlocksUnit: 'infantry',
    bonuses: {
      unitTypeAttackPctPerLevel: { infantry: 0.08 },
      unitTypeHpPctPerLevel: { infantry: 0.06 }
    }
  },
  range: {
    id: 'range',
    name: 'Range',
    description: 'Trains archer squads.',
    baseCost: 90,
    upgradeBase: 80,
    upgradeScale: 1.6,
    maxLevel: 3,
    unlocksUnit: 'archer',
    bonuses: {
      unitTypeAttackPctPerLevel: { archer: 0.08 },
      unitTypeHpPctPerLevel: { archer: 0.06 }
    }
  },
  stable: {
    id: 'stable',
    name: 'Stable',
    description: 'Trains cavalry squads.',
    baseCost: 100,
    upgradeBase: 90,
    upgradeScale: 1.6,
    maxLevel: 3,
    unlocksUnit: 'cavalry',
    bonuses: {
      unitTypeAttackPctPerLevel: { cavalry: 0.08 },
      unitTypeHpPctPerLevel: { cavalry: 0.06 }
    }
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    description: 'Fortifies the HQ with extra defenses.',
    baseCost: 120,
    upgradeBase: 100,
    upgradeScale: 1.6,
    maxLevel: 3,
    bonuses: {
      hqHpPerLevel: 200
    }
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith',
    description: 'Improves weaponry across all squads.',
    baseCost: 130,
    upgradeBase: 110,
    upgradeScale: 1.6,
    maxLevel: 3,
    bonuses: {
      unitAttackPctPerLevel: 0.06,
      unitHpPctPerLevel: 0.06
    }
  },
  hero_recruiter: {
    id: 'hero_recruiter',
    name: 'Hero Recruiter',
    description: 'Summon a legendary ally to lead your squads.',
    baseCost: 180,
    upgradeBase: 140,
    upgradeScale: 1.5,
    maxLevel: 3,
    heroRecruiter: {
      summonLimit: 1
    }
  }
}

export const BUILDING_LIST = Object.values(BUILDING_DEFS)
