export type UnitType = 'infantry' | 'archer' | 'cavalry'

export interface UnitDef {
  type: UnitType
  name: string
  description: string
  baseCost: number
  squadSize: number
  stats: {
    hp: number
    attack: number
    range: number
    speed: number
    cooldown: number
  }
}

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  infantry: {
    type: 'infantry',
    name: 'Infantry',
    description: 'Frontline melee squads that soak damage and hold ground.',
    baseCost: 20,
    squadSize: 10,
    stats: {
      hp: 18,
      attack: 4,
      range: 50,
      speed: 70,
      cooldown: 1
    }
  },
  archer: {
    type: 'archer',
    name: 'Archers',
    description: 'Ranged squads that punish from afar but crumble in close quarters.',
    baseCost: 25,
    squadSize: 8,
    stats: {
      hp: 12,
      attack: 6,
      range: 160,
      speed: 60,
      cooldown: 1.2
    }
  },
  cavalry: {
    type: 'cavalry',
    name: 'Cavalry',
    description: 'Fast shock troops that flank quickly and hit hard.',
    baseCost: 30,
    squadSize: 6,
    stats: {
      hp: 20,
      attack: 8,
      range: 55,
      speed: 100,
      cooldown: 0.9
    }
  }
}
