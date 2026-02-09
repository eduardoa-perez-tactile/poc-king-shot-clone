export type HeroRecruitId = 'mage' | 'golem' | 'dragon'

export interface HeroRecruitDef {
  id: HeroRecruitId
  name: string
  description: string
  cost: number
  stats: {
    hp: number
    attack: number
    range: number
    speed: number
    cooldown: number
  }
  special: {
    type: 'splash' | 'slam' | 'breath'
    radius: number
    damageMultiplier?: number
  }
  traits?: {
    flying?: boolean
  }
}

export const HERO_RECRUIT_DEFS: Record<HeroRecruitId, HeroRecruitDef> = {
  mage: {
    id: 'mage',
    name: 'Mage',
    description: 'Arcane artillery that launches bolts with splash damage.',
    cost: 180,
    stats: {
      hp: 900,
      attack: 48,
      range: 220,
      speed: 120,
      cooldown: 1
    },
    special: {
      type: 'splash',
      radius: 80,
      damageMultiplier: 0.6
    }
  },
  golem: {
    id: 'golem',
    name: 'Rock Golem',
    description: 'A hulking tank that smashes foes with shockwaves.',
    cost: 200,
    stats: {
      hp: 2200,
      attack: 60,
      range: 70,
      speed: 70,
      cooldown: 1.3
    },
    special: {
      type: 'slam',
      radius: 120,
      damageMultiplier: 0.5
    }
  },
  dragon: {
    id: 'dragon',
    name: 'Dragon',
    description: 'A fast airborne terror with sweeping breath attacks.',
    cost: 240,
    stats: {
      hp: 1600,
      attack: 72,
      range: 190,
      speed: 170,
      cooldown: 1.1
    },
    special: {
      type: 'breath',
      radius: 140,
      damageMultiplier: 0.45
    },
    traits: {
      flying: true
    }
  }
}

export const HERO_RECRUIT_LIST = Object.values(HERO_RECRUIT_DEFS)
