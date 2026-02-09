export type EliteId = 'miniBoss' | 'boss'

export interface EliteDef {
  id: EliteId
  name: string
  hp: number
  attack: number
  range: number
  speed: number
  cooldown: number
  radius: number
}

export const ELITE_DEFS: Record<EliteId, EliteDef> = {
  miniBoss: {
    id: 'miniBoss',
    name: 'Mini Boss',
    hp: 1800,
    attack: 36,
    range: 90,
    speed: 60,
    cooldown: 1.15,
    radius: 22
  },
  boss: {
    id: 'boss',
    name: 'Boss',
    hp: 4200,
    attack: 58,
    range: 110,
    speed: 50,
    cooldown: 1,
    radius: 28
  }
}

export const ELITE_LIST = Object.values(ELITE_DEFS)
