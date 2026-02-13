export type NightModifierId = string
export type PerkId = string
export type EnemyTraitId = string

export interface NightModifierDef {
  id: NightModifierId
  name: string
  description: string
  rewardMultiplier: number
  effects: {
    enemyCountMultiplier?: number
    enemyMoveSpeedMultiplier?: number
    enemyHpMultiplier?: number
    towersDisabled?: boolean
    goldStartPenalty?: number
    addExtraSpawnBorder?: boolean
  }
  icon?: string
}

export interface PerkDef {
  id: PerkId
  name: string
  description: string
  maxStacks?: number
  effects: {
    towerRangeMultiplier?: number
    towerDamageMultiplier?: number
    goldRewardMultiplier?: number
    buildingUpgradeCostMultiplier?: number
    rangedUnitsDamageMultiplier?: number
    wallHpMultiplier?: number
    endOfNightBonusGoldPerStrongholdLevel?: number
  }
  icon?: string
}

export interface EnemyTraitDef {
  id: EnemyTraitId
  name: string
  description: string
  icon?: string
  effects: {
    rangedDamageTakenMultiplier?: number
    onDeathExplosion?: {
      radius: number
      damage: number
    }
    targetingPriority?: 'DEFAULT' | 'TOWERS_FIRST'
    ignoresWalls?: boolean
  }
}

export interface EliteConfig {
  enabled: boolean
  hpMultiplier: number
  damageMultiplier: number
  moveSpeedMultiplier?: number
  outline: {
    enabled: boolean
    color?: 'YELLOW'
  }
  announceInIntel: boolean
  icon?: string
}

export const DEFAULT_NIGHT_MODIFIERS: NightModifierDef[] = [
  {
    id: 'more_hordes',
    name: 'More Hordes',
    description: 'More enemies spawn this night.',
    rewardMultiplier: 1.2,
    effects: {
      enemyCountMultiplier: 0.25
    },
    icon: 'mod_hordes'
  },
  {
    id: 'fast_march',
    name: 'Fast March',
    description: 'Enemies move faster this night.',
    rewardMultiplier: 1.15,
    effects: {
      enemyMoveSpeedMultiplier: 0.2
    },
    icon: 'mod_speed'
  },
  {
    id: 'armored',
    name: 'Armored',
    description: 'Enemies are tougher this night.',
    rewardMultiplier: 1.15,
    effects: {
      enemyHpMultiplier: 0.2
    },
    icon: 'mod_armor'
  },
  {
    id: 'no_towers_tonight',
    name: 'No Towers Tonight',
    description: 'Towers are disabled for this battle cycle.',
    rewardMultiplier: 1.35,
    effects: {
      towersDisabled: true
    },
    icon: 'mod_no_towers'
  },
  {
    id: 'leaky_purse',
    name: 'Leaky Purse',
    description: 'Lose gold before battle starts.',
    rewardMultiplier: 1.3,
    effects: {
      goldStartPenalty: 20
    },
    icon: 'mod_gold_penalty'
  },
  {
    id: 'double_spawn',
    name: 'Double Spawn',
    description: 'Waves use an extra spawn border when possible.',
    rewardMultiplier: 1.25,
    effects: {
      addExtraSpawnBorder: true
    },
    icon: 'mod_double_spawn'
  }
]

export const DEFAULT_PERKS: PerkDef[] = [
  {
    id: 'arcane_towers',
    name: 'Arcane Towers',
    description: 'Tower range and damage increase.',
    effects: {
      towerRangeMultiplier: 0.2,
      towerDamageMultiplier: 0.33
    },
    icon: 'perk_arcane_towers'
  },
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Earn extra end-of-night reward gold.',
    effects: {
      goldRewardMultiplier: 0.15
    },
    icon: 'perk_treasure_hunter'
  },
  {
    id: 'architects_council',
    name: 'Architects Council',
    description: 'Building upgrades cost less.',
    effects: {
      buildingUpgradeCostMultiplier: -0.1
    },
    icon: 'perk_architects_council'
  },
  {
    id: 'ranged_drill',
    name: 'Ranged Drill',
    description: 'Ranged units deal more damage.',
    effects: {
      rangedUnitsDamageMultiplier: 0.15
    },
    icon: 'perk_ranged_drill'
  },
  {
    id: 'thick_walls',
    name: 'Thick Walls',
    description: 'Walls gain extra health.',
    effects: {
      wallHpMultiplier: 0.25
    },
    icon: 'perk_thick_walls'
  },
  {
    id: 'interest',
    name: 'Interest',
    description: 'Gain bonus gold based on stronghold level each night.',
    maxStacks: 3,
    effects: {
      endOfNightBonusGoldPerStrongholdLevel: 5
    },
    icon: 'perk_interest'
  }
]

export const DEFAULT_ENEMY_TRAITS: EnemyTraitDef[] = [
  {
    id: 'shielded',
    name: 'Shielded',
    description: 'Takes reduced ranged damage.',
    icon: 'trait_shielded',
    effects: {
      rangedDamageTakenMultiplier: 0.75
    }
  },
  {
    id: 'explosive',
    name: 'Explosive',
    description: 'Explodes on death and damages player units.',
    icon: 'trait_explosive',
    effects: {
      onDeathExplosion: {
        radius: 80,
        damage: 90
      }
    }
  },
  {
    id: 'tower_hunter',
    name: 'Tower Hunter',
    description: 'Prioritizes towers when selecting targets.',
    icon: 'trait_tower_hunter',
    effects: {
      targetingPriority: 'TOWERS_FIRST'
    }
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Ignores wall blockers while pathing.',
    icon: 'trait_unstoppable',
    effects: {
      ignoresWalls: true
    }
  }
]

export const DEFAULT_ELITE_CONFIG: EliteConfig = {
  enabled: true,
  hpMultiplier: 4,
  damageMultiplier: 3,
  moveSpeedMultiplier: 1,
  outline: {
    enabled: true,
    color: 'YELLOW'
  },
  announceInIntel: true,
  icon: 'elite_warning'
}

export const NIGHT_MODIFIER_ICON_LABELS: Record<NightModifierId, string> = {
  more_hordes: 'HORDES',
  fast_march: 'FAST',
  armored: 'ARMOR',
  no_towers_tonight: 'NO TWR',
  leaky_purse: 'GOLD-',
  double_spawn: '2X SPAWN'
}

export const ENEMY_TRAIT_ICON_LABELS: Record<EnemyTraitId, string> = {
  shielded: 'SHD',
  explosive: 'EXP',
  tower_hunter: 'T-H',
  unstoppable: 'UNS'
}
