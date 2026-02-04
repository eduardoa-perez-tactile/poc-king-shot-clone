import { BuildingId } from './buildings'
import { UnitType } from './units'

export interface WaveUnitGroup {
  type: UnitType
  squads: number
  squadSize?: number
}

export interface DayWave {
  id: string
  units: WaveUnitGroup[]
  spawnTimeSec?: number
  isBoss?: boolean
}

export interface DayPlan {
  day: number
  waveMode?: 'sequential' | 'timed'
  waveDelaySec?: number
  enemyModifiers?: {
    hpMultiplier: number
    attackMultiplier: number
  }
  waves: DayWave[]
}

export interface HeroAbilityDef {
  id: 'q' | 'e'
  name: string
  description: string
  cooldown: number
  damage?: number
  radius?: number
  heal?: number
  dash?: number
}

export interface HeroStats {
  hp: number
  attack: number
  range: number
  speed: number
  cooldown: number
}

export interface HeroLoadout {
  id: string
  name: string
  description: string
  baseStats: HeroStats
  growthPerDay?: { hp: number; attack: number }
  abilities: {
    q: HeroAbilityDef
    e: HeroAbilityDef
  }
}

export interface HeroRuntime {
  id: string
  name: string
  description: string
  stats: HeroStats
  abilities: {
    q: HeroAbilityDef
    e: HeroAbilityDef
  }
}

export interface BuildingPad {
  id: string
  x: number
  y: number
  allowedTypes: BuildingId[]
}

export type GoalType =
  | 'survive_days'
  | 'defeat_boss_day'
  | 'total_gold_earned'
  | 'hq_hp_threshold'

export interface LevelGoal {
  id: string
  type: GoalType
  label: string
  target: number
  day?: number
}

export interface LevelDefinition {
  id: string
  name: string
  description: string
  startGold: number
  dayRewardGold: number
  dayRewardScale?: number
  heroLoadout: HeroLoadout
  buildingPads: BuildingPad[]
  startingBuildings: { id: BuildingId; level: number; padId: string }[]
  goals: LevelGoal[]
  days: DayPlan[]
  map: {
    width: number
    height: number
    obstacles: { x: number; y: number; w: number; h: number }[]
    playerSpawn: { x: number; y: number }
    enemySpawn: { x: number; y: number }
    playerHQ: { x: number; y: number }
  }
}

const DEFAULT_PADS: BuildingPad[] = [
  {
    id: 'pad_a',
    x: 200,
    y: 260,
    allowedTypes: ['barracks', 'range', 'stable']
  },
  {
    id: 'pad_b',
    x: 200,
    y: 340,
    allowedTypes: ['gold_mine', 'house', 'watchtower']
  },
  {
    id: 'pad_c',
    x: 200,
    y: 420,
    allowedTypes: ['gold_mine', 'house', 'blacksmith']
  },
  {
    id: 'pad_d',
    x: 260,
    y: 260,
    allowedTypes: ['barracks', 'range', 'stable']
  },
  {
    id: 'pad_e',
    x: 260,
    y: 340,
    allowedTypes: ['house', 'watchtower', 'blacksmith']
  },
  {
    id: 'pad_f',
    x: 260,
    y: 420,
    allowedTypes: ['gold_mine', 'blacksmith', 'stable']
  }
]

const DEFAULT_HERO: HeroLoadout = {
  id: 'vanguard',
  name: 'Vanguard',
  description: 'A hardened champion who anchors the defense each day.',
  baseStats: {
    hp: 320,
    attack: 16,
    range: 70,
    speed: 120,
    cooldown: 0.8
  },
  growthPerDay: { hp: 22, attack: 2 },
  abilities: {
    q: {
      id: 'q',
      name: 'Cleave',
      description: 'A wide strike that damages nearby enemies.',
      cooldown: 8,
      damage: 90,
      radius: 120
    },
    e: {
      id: 'e',
      name: 'Second Wind',
      description: 'Recover health to stay in the fight.',
      cooldown: 12,
      heal: 80
    }
  }
}

export const LEVELS: LevelDefinition[] = [
  {
    id: 'level_1',
    name: 'Frontier Dawn',
    description: 'Stabilize the frontier through three brutal days.',
    startGold: 50,
    dayRewardGold: 30,
    dayRewardScale: 5,
    heroLoadout: DEFAULT_HERO,
    buildingPads: DEFAULT_PADS,
    startingBuildings: [
      { id: 'gold_mine', level: 1, padId: 'pad_c' },
      { id: 'house', level: 1, padId: 'pad_b' },
      { id: 'barracks', level: 1, padId: 'pad_a' }
    ],
    goals: [
      { id: 'goal_survive_3', type: 'survive_days', label: 'Survive until Day 3', target: 3 },
      { id: 'goal_gold_120', type: 'total_gold_earned', label: 'Earn 120 total gold', target: 120 }
    ],
    days: [
      {
        day: 1,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1, attackMultiplier: 1 },
        waves: [
          {
            id: 'd1_w1',
            units: [
              { type: 'infantry', squads: 2 },
              { type: 'archer', squads: 1 }
            ]
          },
          {
            id: 'd1_w2',
            units: [
              { type: 'infantry', squads: 2 },
              { type: 'archer', squads: 1 }
            ]
          }
        ]
      },
      {
        day: 2,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.1, attackMultiplier: 1.05 },
        waves: [
          {
            id: 'd2_w1',
            units: [
              { type: 'infantry', squads: 3 },
              { type: 'archer', squads: 1 }
            ]
          },
          {
            id: 'd2_w2',
            units: [
              { type: 'infantry', squads: 2 },
              { type: 'archer', squads: 2 }
            ]
          },
          {
            id: 'd2_w3',
            units: [
              { type: 'cavalry', squads: 1 },
              { type: 'infantry', squads: 2 }
            ]
          }
        ]
      },
      {
        day: 3,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.2, attackMultiplier: 1.1 },
        waves: [
          {
            id: 'd3_w1',
            units: [
              { type: 'infantry', squads: 3 },
              { type: 'archer', squads: 2 }
            ]
          },
          {
            id: 'd3_w2',
            units: [
              { type: 'archer', squads: 3 },
              { type: 'cavalry', squads: 1 }
            ]
          },
          {
            id: 'd3_w3',
            units: [
              { type: 'infantry', squads: 4 },
              { type: 'cavalry', squads: 2 }
            ]
          }
        ]
      }
    ],
    map: {
      width: 1200,
      height: 800,
      obstacles: [
        { x: 420, y: 220, w: 120, h: 140 },
        { x: 680, y: 420, w: 140, h: 120 },
        { x: 220, y: 520, w: 160, h: 80 }
      ],
      playerSpawn: { x: 220, y: 400 },
      enemySpawn: { x: 980, y: 400 },
      playerHQ: { x: 160, y: 400 }
    }
  },
  {
    id: 'level_2',
    name: 'Iron Reprisal',
    description: 'Hold the line and crush the boss raid on Day 4.',
    startGold: 70,
    dayRewardGold: 40,
    dayRewardScale: 6,
    heroLoadout: DEFAULT_HERO,
    buildingPads: DEFAULT_PADS,
    startingBuildings: [
      { id: 'gold_mine', level: 1, padId: 'pad_c' },
      { id: 'house', level: 1, padId: 'pad_b' },
      { id: 'barracks', level: 1, padId: 'pad_a' },
      { id: 'range', level: 1, padId: 'pad_d' }
    ],
    goals: [
      { id: 'goal_survive_4', type: 'survive_days', label: 'Survive until Day 4', target: 4 },
      { id: 'goal_boss_4', type: 'defeat_boss_day', label: 'Defeat the Boss on Day 4', target: 1, day: 4 }
    ],
    days: [
      {
        day: 1,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.05, attackMultiplier: 1.05 },
        waves: [
          { id: 'l2_d1_w1', units: [{ type: 'infantry', squads: 3 }, { type: 'archer', squads: 2 }] },
          { id: 'l2_d1_w2', units: [{ type: 'infantry', squads: 2 }, { type: 'cavalry', squads: 1 }] }
        ]
      },
      {
        day: 2,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.15, attackMultiplier: 1.1 },
        waves: [
          { id: 'l2_d2_w1', units: [{ type: 'infantry', squads: 3 }, { type: 'archer', squads: 2 }] },
          { id: 'l2_d2_w2', units: [{ type: 'archer', squads: 3 }, { type: 'cavalry', squads: 2 }] },
          { id: 'l2_d2_w3', units: [{ type: 'infantry', squads: 3 }] }
        ]
      },
      {
        day: 3,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.25, attackMultiplier: 1.15 },
        waves: [
          { id: 'l2_d3_w1', units: [{ type: 'infantry', squads: 4 }, { type: 'archer', squads: 2 }] },
          { id: 'l2_d3_w2', units: [{ type: 'cavalry', squads: 2 }, { type: 'archer', squads: 2 }] },
          { id: 'l2_d3_w3', units: [{ type: 'infantry', squads: 4 }] }
        ]
      },
      {
        day: 4,
        waveMode: 'sequential',
        waveDelaySec: 8,
        enemyModifiers: { hpMultiplier: 1.35, attackMultiplier: 1.2 },
        waves: [
          { id: 'l2_d4_w1', units: [{ type: 'infantry', squads: 4 }, { type: 'archer', squads: 3 }] },
          { id: 'l2_d4_w2', units: [{ type: 'cavalry', squads: 3 }, { type: 'archer', squads: 3 }] },
          {
            id: 'l2_d4_boss',
            isBoss: true,
            units: [
              { type: 'infantry', squads: 1, squadSize: 18 },
              { type: 'cavalry', squads: 1, squadSize: 12 }
            ]
          }
        ]
      }
    ],
    map: {
      width: 1200,
      height: 800,
      obstacles: [
        { x: 520, y: 120, w: 140, h: 160 },
        { x: 520, y: 520, w: 140, h: 160 },
        { x: 300, y: 320, w: 120, h: 160 }
      ],
      playerSpawn: { x: 240, y: 400 },
      enemySpawn: { x: 960, y: 400 },
      playerHQ: { x: 160, y: 400 }
    }
  },
  {
    id: 'level_3',
    name: 'Last Rampart',
    description: 'Endure five days and build a war chest.',
    startGold: 90,
    dayRewardGold: 50,
    dayRewardScale: 8,
    heroLoadout: DEFAULT_HERO,
    buildingPads: DEFAULT_PADS,
    startingBuildings: [
      { id: 'gold_mine', level: 1, padId: 'pad_c' },
      { id: 'house', level: 1, padId: 'pad_b' },
      { id: 'barracks', level: 1, padId: 'pad_a' },
      { id: 'range', level: 1, padId: 'pad_d' },
      { id: 'stable', level: 1, padId: 'pad_f' }
    ],
    goals: [
      { id: 'goal_survive_5', type: 'survive_days', label: 'Survive until Day 5', target: 5 },
      { id: 'goal_gold_400', type: 'total_gold_earned', label: 'Earn 400 total gold', target: 400 }
    ],
    days: [
      {
        day: 1,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.1, attackMultiplier: 1.05 },
        waves: [
          { id: 'l3_d1_w1', units: [{ type: 'infantry', squads: 3 }, { type: 'archer', squads: 2 }] },
          { id: 'l3_d1_w2', units: [{ type: 'infantry', squads: 3 }, { type: 'cavalry', squads: 1 }] }
        ]
      },
      {
        day: 2,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.2, attackMultiplier: 1.1 },
        waves: [
          { id: 'l3_d2_w1', units: [{ type: 'infantry', squads: 4 }, { type: 'archer', squads: 3 }] },
          { id: 'l3_d2_w2', units: [{ type: 'archer', squads: 3 }, { type: 'cavalry', squads: 2 }] },
          { id: 'l3_d2_w3', units: [{ type: 'infantry', squads: 4 }] }
        ]
      },
      {
        day: 3,
        waveMode: 'sequential',
        waveDelaySec: 6,
        enemyModifiers: { hpMultiplier: 1.3, attackMultiplier: 1.15 },
        waves: [
          { id: 'l3_d3_w1', units: [{ type: 'infantry', squads: 5 }, { type: 'archer', squads: 3 }] },
          { id: 'l3_d3_w2', units: [{ type: 'archer', squads: 3 }, { type: 'cavalry', squads: 2 }] },
          { id: 'l3_d3_w3', units: [{ type: 'infantry', squads: 4 }, { type: 'cavalry', squads: 2 }] }
        ]
      },
      {
        day: 4,
        waveMode: 'sequential',
        waveDelaySec: 7,
        enemyModifiers: { hpMultiplier: 1.4, attackMultiplier: 1.2 },
        waves: [
          { id: 'l3_d4_w1', units: [{ type: 'infantry', squads: 5 }, { type: 'archer', squads: 4 }] },
          { id: 'l3_d4_w2', units: [{ type: 'cavalry', squads: 3 }, { type: 'archer', squads: 3 }] },
          { id: 'l3_d4_w3', units: [{ type: 'infantry', squads: 5 }] }
        ]
      },
      {
        day: 5,
        waveMode: 'sequential',
        waveDelaySec: 8,
        enemyModifiers: { hpMultiplier: 1.5, attackMultiplier: 1.25 },
        waves: [
          { id: 'l3_d5_w1', units: [{ type: 'infantry', squads: 6 }, { type: 'archer', squads: 4 }] },
          { id: 'l3_d5_w2', units: [{ type: 'cavalry', squads: 3 }, { type: 'archer', squads: 4 }] },
          { id: 'l3_d5_w3', units: [{ type: 'infantry', squads: 6 }, { type: 'cavalry', squads: 3 }] }
        ]
      }
    ],
    map: {
      width: 1200,
      height: 800,
      obstacles: [
        { x: 420, y: 260, w: 160, h: 120 },
        { x: 700, y: 440, w: 160, h: 120 }
      ],
      playerSpawn: { x: 220, y: 400 },
      enemySpawn: { x: 980, y: 400 },
      playerHQ: { x: 160, y: 400 }
    }
  }
]

export const getLevelById = (levelId: string) => LEVELS.find((level) => level.id === levelId)

export const getDayPlan = (level: LevelDefinition, dayNumber: number): DayPlan => {
  const exact = level.days.find((day) => day.day === dayNumber)
  if (exact) return exact
  const last = level.days[level.days.length - 1]
  const extra = Math.max(0, dayNumber - last.day)
  const scale = 1 + extra * 0.2
  return {
    ...last,
    day: dayNumber,
    enemyModifiers: {
      hpMultiplier: last.enemyModifiers ? last.enemyModifiers.hpMultiplier * scale : scale,
      attackMultiplier: last.enemyModifiers ? last.enemyModifiers.attackMultiplier * (1 + extra * 0.15) : 1 + extra * 0.15
    },
    waves: last.waves.map((wave) => ({
      ...wave,
      units: wave.units.map((unit) => ({
        ...unit,
        squads: Math.max(1, Math.round(unit.squads * scale))
      }))
    }))
  }
}
