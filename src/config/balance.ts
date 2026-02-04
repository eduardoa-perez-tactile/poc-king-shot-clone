import { BuildingId, CombatEncounter, GearDefinition, HeroDefinition, QuestTemplate, Resources, TroopDefinition } from '../game/types'

export const TOWN_SIZE = 6

export const STARTING_RESOURCES: Resources = {
  food: 200,
  wood: 200,
  stone: 100,
  gold: 50
}

export const STARTING_KEYS = {
  gold: 3,
  platinum: 0
}

export const STARTING_BUILDINGS: BuildingId[] = [
  'town_hall',
  'farm',
  'lumber_mill',
  'barracks',
  'hero_hall'
]

export const BUILDING_DEFS: Record<BuildingId, {
  name: string
  maxLevel: number
  baseCost: Resources
  costScale: number
  baseTimeSec: number
  timeScale: number
  productionPerMin?: Partial<Resources>
  effect: string
}> = {
  town_hall: {
    name: 'Town Hall',
    maxLevel: 10,
    baseCost: { food: 0, wood: 120, stone: 80, gold: 0 },
    costScale: 1.6,
    baseTimeSec: 30,
    timeScale: 1.5,
    effect: 'Unlocks buildings and boosts overall efficiency.'
  },
  farm: {
    name: 'Farm',
    maxLevel: 10,
    baseCost: { food: 0, wood: 50, stone: 20, gold: 0 },
    costScale: 1.45,
    baseTimeSec: 20,
    timeScale: 1.4,
    productionPerMin: { food: 12 },
    effect: 'Produces food over time.'
  },
  lumber_mill: {
    name: 'Lumber Mill',
    maxLevel: 10,
    baseCost: { food: 0, wood: 40, stone: 30, gold: 0 },
    costScale: 1.45,
    baseTimeSec: 20,
    timeScale: 1.4,
    productionPerMin: { wood: 10 },
    effect: 'Produces wood over time.'
  },
  quarry: {
    name: 'Quarry',
    maxLevel: 10,
    baseCost: { food: 0, wood: 70, stone: 40, gold: 0 },
    costScale: 1.5,
    baseTimeSec: 25,
    timeScale: 1.45,
    productionPerMin: { stone: 8 },
    effect: 'Produces stone over time.'
  },
  gold_mint: {
    name: 'Gold Mint',
    maxLevel: 10,
    baseCost: { food: 0, wood: 80, stone: 60, gold: 0 },
    costScale: 1.55,
    baseTimeSec: 25,
    timeScale: 1.45,
    productionPerMin: { gold: 6 },
    effect: 'Produces gold over time.'
  },
  barracks: {
    name: 'Barracks',
    maxLevel: 10,
    baseCost: { food: 0, wood: 90, stone: 70, gold: 0 },
    costScale: 1.5,
    baseTimeSec: 25,
    timeScale: 1.45,
    effect: 'Increases troop capacity and training speed.'
  },
  hero_hall: {
    name: 'Hero Hall',
    maxLevel: 10,
    baseCost: { food: 0, wood: 100, stone: 60, gold: 0 },
    costScale: 1.5,
    baseTimeSec: 25,
    timeScale: 1.45,
    effect: 'Unlocks stronger heroes and gear.'
  },
  research_lab: {
    name: 'Research Lab',
    maxLevel: 10,
    baseCost: { food: 0, wood: 120, stone: 90, gold: 0 },
    costScale: 1.55,
    baseTimeSec: 30,
    timeScale: 1.5,
    effect: 'Boosts production and combat efficiency.'
  },
  watchtower: {
    name: 'Watchtower',
    maxLevel: 10,
    baseCost: { food: 0, wood: 90, stone: 90, gold: 0 },
    costScale: 1.5,
    baseTimeSec: 30,
    timeScale: 1.45,
    effect: 'Improves raid rewards and defense.'
  }
}

export const HERO_DEFS: HeroDefinition[] = [
  {
    id: 'aria',
    name: 'Aria',
    role: 'Offense',
    rarity: 'Rare',
    baseStats: { attack: 14, defense: 6, hp: 90 },
    skills: [
      { id: 'aria_1', name: 'Arrow Flurry', effect: 'damage', amount: 22, cooldown: 3, description: 'Deals burst damage.' },
      { id: 'aria_2', name: 'Focus', effect: 'buff', amount: 0.1, cooldown: 4, description: 'Boosts squad attack.' }
    ]
  },
  {
    id: 'brom',
    name: 'Brom',
    role: 'Defense',
    rarity: 'Common',
    baseStats: { attack: 8, defense: 12, hp: 120 },
    skills: [
      { id: 'brom_1', name: 'Shield Wall', effect: 'shield', amount: 18, cooldown: 3, description: 'Reduces incoming damage.' },
      { id: 'brom_2', name: 'Taunt', effect: 'buff', amount: 0.08, cooldown: 4, description: 'Improves defense.' }
    ]
  },
  {
    id: 'selene',
    name: 'Selene',
    role: 'Support',
    rarity: 'Rare',
    baseStats: { attack: 9, defense: 7, hp: 100 },
    skills: [
      { id: 'selene_1', name: 'Mend', effect: 'heal', amount: 20, cooldown: 3, description: 'Heals troops.' },
      { id: 'selene_2', name: 'Blessing', effect: 'buff', amount: 0.12, cooldown: 4, description: 'Improves attack and defense.' }
    ]
  },
  {
    id: 'kael',
    name: 'Kael',
    role: 'Offense',
    rarity: 'Epic',
    baseStats: { attack: 18, defense: 8, hp: 110 },
    skills: [
      { id: 'kael_1', name: 'Blade Rush', effect: 'damage', amount: 28, cooldown: 3, description: 'High burst strike.' },
      { id: 'kael_2', name: 'War Cry', effect: 'buff', amount: 0.15, cooldown: 4, description: 'Raises troop attack.' }
    ]
  },
  {
    id: 'mira',
    name: 'Mira',
    role: 'Support',
    rarity: 'Epic',
    baseStats: { attack: 11, defense: 10, hp: 120 },
    skills: [
      { id: 'mira_1', name: 'Sanctuary', effect: 'heal', amount: 26, cooldown: 3, description: 'Heals and shields.' },
      { id: 'mira_2', name: 'Ward', effect: 'shield', amount: 20, cooldown: 4, description: 'Reduces damage.' }
    ]
  },
  {
    id: 'ragnar',
    name: 'Ragnar',
    role: 'Defense',
    rarity: 'Rare',
    baseStats: { attack: 10, defense: 14, hp: 140 },
    skills: [
      { id: 'ragnar_1', name: 'Stone Skin', effect: 'shield', amount: 24, cooldown: 3, description: 'Shrugs off damage.' },
      { id: 'ragnar_2', name: 'Hold Line', effect: 'buff', amount: 0.1, cooldown: 4, description: 'Defense up.' }
    ]
  },
  {
    id: 'lyra',
    name: 'Lyra',
    role: 'Offense',
    rarity: 'Legendary',
    baseStats: { attack: 22, defense: 10, hp: 130 },
    skills: [
      { id: 'lyra_1', name: 'Starfall', effect: 'damage', amount: 36, cooldown: 3, description: 'Massive burst.' },
      { id: 'lyra_2', name: 'Momentum', effect: 'buff', amount: 0.2, cooldown: 4, description: 'Attack surge.' }
    ]
  },
  {
    id: 'taro',
    name: 'Taro',
    role: 'Support',
    rarity: 'Common',
    baseStats: { attack: 7, defense: 8, hp: 100 },
    skills: [
      { id: 'taro_1', name: 'Quick Patch', effect: 'heal', amount: 16, cooldown: 3, description: 'Minor heal.' },
      { id: 'taro_2', name: 'Rally', effect: 'buff', amount: 0.06, cooldown: 4, description: 'Small attack boost.' }
    ]
  }
]

export const GEAR_DEFS: GearDefinition[] = [
  { id: 'bronze_sword', name: 'Bronze Sword', slot: 'weapon', rarity: 'Common', stats: { attack: 3 } },
  { id: 'oak_bow', name: 'Oak Bow', slot: 'weapon', rarity: 'Rare', stats: { attack: 5 } },
  { id: 'steel_axe', name: 'Steel Axe', slot: 'weapon', rarity: 'Epic', stats: { attack: 8 } },
  { id: 'sunblade', name: 'Sunblade', slot: 'weapon', rarity: 'Legendary', stats: { attack: 12 } },
  { id: 'leather_armor', name: 'Leather Armor', slot: 'armor', rarity: 'Common', stats: { defense: 3, hp: 10 } },
  { id: 'scale_mail', name: 'Scale Mail', slot: 'armor', rarity: 'Rare', stats: { defense: 5, hp: 20 } },
  { id: 'guardian_plate', name: 'Guardian Plate', slot: 'armor', rarity: 'Epic', stats: { defense: 8, hp: 30 } },
  { id: 'royal_plate', name: 'Royal Plate', slot: 'armor', rarity: 'Legendary', stats: { defense: 12, hp: 45 } },
  { id: 'lucky_charm', name: 'Lucky Charm', slot: 'charm', rarity: 'Common', stats: { hp: 8 } },
  { id: 'war_banner', name: 'War Banner', slot: 'charm', rarity: 'Rare', stats: { attack: 4, defense: 2 } },
  { id: 'phoenix_emblem', name: 'Phoenix Emblem', slot: 'charm', rarity: 'Legendary', stats: { attack: 6, defense: 4, hp: 20 } }
]

export const TROOP_DEFS: Record<'infantry' | 'archer' | 'cavalry', TroopDefinition> = {
  infantry: { type: 'infantry', name: 'Infantry', attack: 4, hp: 18 },
  archer: { type: 'archer', name: 'Archers', attack: 6, hp: 12 },
  cavalry: { type: 'cavalry', name: 'Cavalry', attack: 8, hp: 20 }
}

export const TRAINING_BASE = {
  cost: {
    infantry: { food: 10, wood: 4, stone: 2, gold: 0 },
    archer: { food: 8, wood: 8, stone: 2, gold: 0 },
    cavalry: { food: 12, wood: 6, stone: 6, gold: 0 }
  },
  timeSec: {
    infantry: 6,
    archer: 7,
    cavalry: 9
  }
}

export const QUEST_DAILY: QuestTemplate[] = [
  { id: 'daily_upgrade', title: 'Upgrade a building', description: 'Complete 1 upgrade.', target: 1, reward: { gold: 10, food: 40, wood: 40, stone: 20 } },
  { id: 'daily_train', title: 'Train 50 troops', description: 'Train 50 total troops.', target: 50, reward: { gold: 8, food: 30, wood: 30, stone: 15 } },
  { id: 'daily_raid', title: 'Win 1 raid', description: 'Win a raid encounter.', target: 1, reward: { gold: 12, food: 20, wood: 20, stone: 20 } }
]

export const QUEST_CHAPTERS: QuestTemplate[] = [
  { id: 'chapter_th3', title: 'Reach Town Hall Lv 3', description: 'Upgrade Town Hall to Lv 3.', target: 3, reward: { gold: 20, food: 80, wood: 80, stone: 40 } },
  { id: 'chapter_troops', title: 'Train 120 troops', description: 'Train 120 total troops.', target: 120, reward: { gold: 25, food: 120, wood: 120, stone: 60 } },
  { id: 'chapter_waves', title: 'Win 1 Waves battle', description: 'Survive a Waves encounter.', target: 1, reward: { gold: 30, food: 80, wood: 80, stone: 80 } }
]

export const EVENT_CONFIG = {
  name: 'Governor Sprint',
  durationMin: 30,
  milestones: [
    { points: 50, reward: { gold: 10, food: 40, wood: 40, stone: 20 } },
    { points: 120, reward: { gold: 20, food: 80, wood: 80, stone: 40 } },
    { points: 220, reward: { gold: 35, food: 120, wood: 120, stone: 60 } }
  ]
}

export const SUMMON_RATES = {
  gold: [
    { rarity: 'Common', weight: 70 },
    { rarity: 'Rare', weight: 25 },
    { rarity: 'Epic', weight: 4 },
    { rarity: 'Legendary', weight: 1 }
  ],
  platinum: [
    { rarity: 'Common', weight: 40 },
    { rarity: 'Rare', weight: 35 },
    { rarity: 'Epic', weight: 20 },
    { rarity: 'Legendary', weight: 5 }
  ]
}

export const REWARD_TABLE = {
  raid: {
    base: { food: 40, wood: 40, stone: 20, gold: 8 },
    xpItems: 1,
    gearChance: 0.2,
    keyChance: 0.12
  },
  waves: {
    base: { food: 60, wood: 60, stone: 40, gold: 12 },
    xpItems: 2,
    gearChance: 0.35,
    keyChance: 0.2
  }
}

export const ENEMIES: CombatEncounter[] = [
  { id: 'raiders', name: 'Border Raiders', troops: { infantry: 40, archer: 25, cavalry: 15 }, power: 1 },
  { id: 'warlord', name: 'Warlord Band', troops: { infantry: 60, archer: 40, cavalry: 20 }, power: 1.2 },
  { id: 'beasts', name: 'Wild Beasts', troops: { infantry: 30, archer: 20, cavalry: 30 }, power: 1.1 }
]
