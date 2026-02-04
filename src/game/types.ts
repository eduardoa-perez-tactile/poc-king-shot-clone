export type ResourceType = 'food' | 'wood' | 'stone' | 'gold'

export interface Resources {
  food: number
  wood: number
  stone: number
  gold: number
}

export type BuildingId =
  | 'town_hall'
  | 'farm'
  | 'lumber_mill'
  | 'quarry'
  | 'gold_mint'
  | 'barracks'
  | 'hero_hall'
  | 'research_lab'
  | 'watchtower'

export interface BuildingState {
  id: BuildingId
  level: number
}

export interface TownTile {
  x: number
  y: number
  buildingId?: BuildingId
}

export interface UpgradeQueue {
  buildingId: BuildingId
  startedAt: number
  endsAt: number
  buildTile?: { x: number; y: number }
}

export interface Timer {
  startedAt: number
  endsAt: number
}

export type HeroRole = 'Offense' | 'Defense' | 'Support'
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary'

export interface SkillDefinition {
  id: string
  name: string
  effect: 'damage' | 'shield' | 'heal' | 'buff'
  amount: number
  cooldown: number
  description: string
}

export interface HeroDefinition {
  id: string
  name: string
  role: HeroRole
  rarity: Rarity
  baseStats: {
    attack: number
    defense: number
    hp: number
  }
  skills: SkillDefinition[]
}

export interface HeroInstance {
  id: string
  level: number
  xp: number
  gear: {
    weapon?: string
    armor?: string
    charm?: string
  }
}

export interface GearDefinition {
  id: string
  name: string
  slot: 'weapon' | 'armor' | 'charm'
  rarity: Rarity
  stats: Partial<HeroStats>
}

export interface HeroStats {
  attack: number
  defense: number
  hp: number
}

export type TroopType = 'infantry' | 'archer' | 'cavalry'

export interface TroopDefinition {
  type: TroopType
  name: string
  attack: number
  hp: number
}

export interface TroopCounts {
  infantry: number
  archer: number
  cavalry: number
}

export interface TrainingQueue {
  type: TroopType
  amount: number
  startedAt: number
  endsAt: number
}

export interface Squad {
  leaderId?: string
  supportIds: string[]
  composition: TroopCounts
}

export interface Inventory {
  xpItems: number
  gear: string[]
  keys: {
    gold: number
    platinum: number
  }
}

export interface QuestTemplate {
  id: string
  title: string
  description: string
  target: number
  reward: Resources
}

export interface QuestProgress {
  id: string
  title: string
  description: string
  target: number
  progress: number
  completed: boolean
  claimed: boolean
  reward: Resources
}

export interface QuestState {
  daily: QuestProgress[]
  chapterIndex: number
  chapters: QuestProgress[]
  lastDailyReset: string
}

export interface EventState {
  startAt: number
  endAt: number
  points: number
  best: number
  claimedMilestones: number[]
}

export interface CombatLogEntry {
  round: number
  playerDamage: number
  enemyDamage: number
  notes: string[]
}

export interface CombatResult {
  victory: boolean
  rounds: number
  log: CombatLogEntry[]
  rewards: {
    resources: Resources
    xpItems: number
    gearDrops: string[]
    keys: { gold: number; platinum: number }
  }
  casualties: TroopCounts
}

export interface CombatEncounter {
  id: string
  name: string
  troops: TroopCounts
  power: number
}

export interface GameState {
  saveVersion: number
  resources: Resources
  banked: Resources
  buildings: BuildingState[]
  townTiles: TownTile[]
  upgradeQueue?: UpgradeQueue
  heroes: HeroInstance[]
  inventory: Inventory
  troops: TroopCounts
  trainingQueue?: TrainingQueue
  squad: Squad
  quests: QuestState
  event: EventState
  settings: {
    sound: boolean
  }
  tutorial: {
    steps: Record<string, boolean>
    dismissed: boolean
  }
  missions: {
    unlocked: number
    completed: string[]
    lastPlayed?: string
  }
  lastTick: number
  totalTroopsTrained: number
}
