import { Resources, TroopType } from '../game/types'

export type Team = 'player' | 'enemy'

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type EntityKind = TroopType | 'hero' | 'hq'

export interface Order {
  type: 'move' | 'attack' | 'attackMove' | 'stop'
  targetPos?: Vec2
  targetId?: string
}

export interface EntityBuff {
  type: 'attack'
  multiplier: number
  expiresAt: number
}

export interface EntityState {
  id: string
  team: Team
  kind: EntityKind
  pos: Vec2
  radius: number
  hp: number
  maxHp: number
  attack: number
  range: number
  speed: number
  cooldown: number
  cooldownLeft: number
  order: Order
  targetId?: string
  path: Vec2[]
  troopCount?: number
  buffs: EntityBuff[]
}

export interface Projectile {
  id: string
  pos: Vec2
  targetId: string
  speed: number
  damage: number
  team: Team
}

export interface HeroAbility {
  id: string
  name: string
  description: string
  cooldown: number
  cooldownLeft: number
  type: 'area' | 'target'
  radius: number
}

export interface HeroState {
  entityId: string
  abilities: HeroAbility[]
  aura: {
    radius: number
    attackMultiplier: number
  }
}

export interface MissionObjectiveSurvive {
  type: 'survive'
  durationSec: number
}

export interface MissionObjectiveDestroyHQ {
  type: 'destroy_hq'
}

export type MissionObjective = MissionObjectiveSurvive | MissionObjectiveDestroyHQ

export interface MissionUnitGroup {
  type: TroopType
  squads: number
  squadSize: number
}

export interface MissionWave {
  timeSec: number
  units: MissionUnitGroup[]
}

export interface MissionDefinition {
  id: string
  name: string
  description: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  objective: MissionObjective
  rewards: {
    resources: Resources
    xpItems: number
    keys: { gold: number; platinum: number }
  }
  unlockAfter?: string
  map: {
    width: number
    height: number
    obstacles: Rect[]
    playerSpawn: Vec2
    enemySpawn: Vec2
    playerHQ: Vec2
    enemyHQ?: Vec2
  }
  startingUnits: MissionUnitGroup[]
  waves: MissionWave[]
}

export interface MissionStats {
  time: number
  kills: number
  losses: number
  casualties: { infantry: number; archer: number; cavalry: number }
}

export interface MissionResult {
  victory: boolean
  stats: MissionStats
  rewards: {
    resources: Resources
    xpItems: number
    keys: { gold: number; platinum: number }
  }
}

export interface SimState {
  time: number
  status: 'running' | 'win' | 'lose'
  entities: EntityState[]
  projectiles: Projectile[]
  hero?: HeroState
  mission: MissionDefinition
  stats: MissionStats
  waveIndex: number
}
