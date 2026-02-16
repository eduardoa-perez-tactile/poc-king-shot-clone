import { HeroRuntime, SpawnEdge, SpawnEdgeConfig, SpawnPointCount } from '../config/levels'
import { EliteConfig, EnemyTraitDef, EnemyTraitId } from '../config/nightContent'
import { EliteId } from '../config/elites'
import { HeroRecruitId } from '../config/heroes'
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

export type EntityKind = UnitType | 'hq' | 'hero' | 'elite' | 'tower' | 'wall'

export type EntityTier = 'normal' | 'miniBoss' | 'boss' | 'hero'

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
  typeName: string
  level: number
  pos: Vec2
  radius: number
  hudOffsetY: number
  tier: EntityTier
  idLabel?: string
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
  ownerBuildingId?: string
  ownerBuildingPadId?: string
  heroId?: HeroRecruitId | string
  heroName?: string
  heroDescription?: string
  heroInstanceId?: string
  heroSpecial?: {
    type: 'splash' | 'slam' | 'breath'
    radius: number
    damageMultiplier?: number
  }
  canFly?: boolean
  lastHitTime?: number
  lastDamageNumberAt?: number
  isStructure?: boolean
  structurePadId?: string
  structureSize?: { w: number; h: number }
  projectileSpeed?: number
  projectileType?: string
  enemyTraits?: EnemyTraitId[]
  rangedDamageTakenMultiplier?: number
  onDeathExplosion?: { radius: number; damage: number }
  targetingPriority?: 'DEFAULT' | 'TOWERS_FIRST'
  ignoresWalls?: boolean
  eliteVariant?: boolean
}

export interface PlayerPositionSnapshot {
  hero?: Vec2
  squads: Record<string, Vec2>
  heroes: Record<string, Vec2>
}

export interface Projectile {
  id: string
  pos: Vec2
  targetId: string
  speed: number
  damage: number
  team: Team
  sourceId?: string
  projectileType?: string
  special?: EntityState['heroSpecial']
}

export interface WaveUnitGroup {
  type: UnitType
  squads: number
  squadSize?: number
}

export interface SpawnTransform {
  position: Vec2
  forward: Vec2
  edge: SpawnEdge
}

export interface CombatWave {
  id: string
  units: WaveUnitGroup[]
  traits?: EnemyTraitId[]
  eliteChance?: number
  groups?: Array<{
    enemyTypeId: UnitType
    count: number
    squadSize?: number
    traits?: EnemyTraitId[]
    eliteChance?: number
  }>
  plannedSpawns?: Array<{
    enemyTypeId: UnitType
    squadSize?: number
    traits: EnemyTraitId[]
    isEliteVariant: boolean
    eliteRoll: number
  }>
  spawnSeed?: string
  spawnTimeSec?: number
  elite?: EliteId
  eliteCount?: number
  spawnEdges?: SpawnEdgeConfig[]
  spawnPointsPerEdge?: SpawnPointCount
  spawnPadding?: number
  resolvedSpawnTransforms?: SpawnTransform[]
}

export interface NextBattlePreview {
  previewEdges: SpawnEdge[]
  previewEnemyTypesDistinct: string[]
  previewTraitIdsDistinct: EnemyTraitId[]
  previewWaves: Array<{
    id: string
    enemyTypes: string[]
    traitIds: EnemyTraitId[]
    hasEliteVariant: boolean
    spawnEdges: SpawnEdge[]
  }>
  hasEliteVariantWarning: boolean
  previewSpawnTransforms: SpawnTransform[]
}

export interface CombatDefinition {
  dayNumber: number
  runSeed: number
  hero: HeroRuntime
  towersDisabled?: boolean
  nightIndex?: number
  enemyTraitDefs?: EnemyTraitDef[]
  eliteConfig?: EliteConfig
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
    moveSpeedMultiplier?: number
  }
  hqBaseHp: number
  nextBattlePreview?: NextBattlePreview
}

export interface CombatStats {
  time: number
  kills: number
  losses: number
  lostSquads: string[]
  lostHeroes: string[]
}

export interface CombatEffect {
  kind: 'hit' | 'aoe' | 'heal' | 'slash'
  pos: Vec2
  radius: number
  color: string
  bornAt: number
  expiresAt: number
  from?: Vec2
  to?: Vec2
}

export interface DamageNumber {
  x: number
  y: number
  text: string
  ttl: number
  life: number
  vy: number
  size: number
  color: string
}

export interface CombatResult {
  victory: boolean
  stats: CombatStats
  lostSquadIds: string[]
  lostHeroIds: string[]
  destroyedWallPadIds: string[]
  bossDefeated: boolean
  hqHpPercent: number
  playerPositions: PlayerPositionSnapshot
}

export interface SimState {
  time: number
  status: 'running' | 'win' | 'lose'
  entities: EntityState[]
  projectiles: Projectile[]
  effects: CombatEffect[]
  damageNumbers: DamageNumber[]
  combat: CombatDefinition
  stats: CombatStats
  waveIndex: number
  nextWaveAt: number
  bossDefeated: boolean
  destroyedWallPadIds: string[]
  heroEntityId?: string
  heroAbilityCooldowns: { q: number; e: number }
}
