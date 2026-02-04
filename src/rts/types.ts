import { HeroRuntime } from '../config/levels'
import { UnitType } from '../config/units'

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

export type EntityKind = UnitType | 'hq' | 'hero'

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
  squadId?: string
  isBoss?: boolean
}

export interface Projectile {
  id: string
  pos: Vec2
  targetId: string
  speed: number
  damage: number
  team: Team
}

export interface WaveUnitGroup {
  type: UnitType
  squads: number
  squadSize?: number
}

export interface CombatWave {
  id: string
  units: WaveUnitGroup[]
  spawnTimeSec?: number
  isBoss?: boolean
}

export interface CombatDefinition {
  dayNumber: number
  hero: HeroRuntime
  map: {
    width: number
    height: number
    obstacles: Rect[]
    playerSpawn: Vec2
    enemySpawn: Vec2
    playerHQ: Vec2
  }
  waves: CombatWave[]
  waveMode: 'sequential' | 'timed'
  waveDelaySec: number
  enemyModifiers: {
    hpMultiplier: number
    attackMultiplier: number
  }
  hqBaseHp: number
}

export interface CombatStats {
  time: number
  kills: number
  losses: number
  lostSquads: string[]
}

export interface CombatResult {
  victory: boolean
  stats: CombatStats
  lostSquadIds: string[]
  bossDefeated: boolean
  hqHpPercent: number
}

export interface SimState {
  time: number
  status: 'running' | 'win' | 'lose'
  entities: EntityState[]
  projectiles: Projectile[]
  combat: CombatDefinition
  stats: CombatStats
  waveIndex: number
  nextWaveAt: number
  bossDefeated: boolean
  heroEntityId?: string
  heroAbilityCooldowns: { q: number; e: number }
}
