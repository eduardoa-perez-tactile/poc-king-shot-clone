import { getPlaytestLevel } from '../game/runtime/playtest'
import { getTuningOverrideById, getTuningOverrides } from '../game/tuning/tuningStore'
import {
  BuildingPad,
  DayPlan,
  HeroLoadout,
  LevelDefinition,
  migrateLevelDefinition
} from '../game/types/LevelDefinition'

export type {
  BuildingPad,
  DayPlan,
  DayWave,
  EnemyCatalogEntry,
  GoalType,
  HeroAbilityDef,
  HeroLoadout,
  HeroRuntime,
  HeroStats,
  LevelEconomy,
  LevelDefinition,
  LevelGoal,
  LevelMetadata,
  LevelModifiers,
  LevelStrongholdTuning,
  LevelValidationIssue,
  LevelValidationResult,
  LevelWaveRules,
  WaveUnitGroup
} from '../game/types/LevelDefinition'

const DEFAULT_PADS: BuildingPad[] = [
  {
    id: 'pad_a',
    x: 220,
    y: 180,
    allowedTypes: ['barracks', 'range', 'stable']
  },
  {
    id: 'pad_b',
    x: 360,
    y: 320,
    allowedTypes: ['gold_mine', 'house', 'watchtower']
  },
  {
    id: 'pad_c',
    x: 520,
    y: 140,
    allowedTypes: ['gold_mine', 'house', 'blacksmith']
  },
  {
    id: 'pad_d',
    x: 320,
    y: 620,
    allowedTypes: ['barracks', 'range', 'stable']
  },
  {
    id: 'pad_e',
    x: 620,
    y: 340,
    allowedTypes: ['house', 'watchtower', 'blacksmith', 'hero_recruiter']
  },
  {
    id: 'pad_f',
    x: 840,
    y: 220,
    allowedTypes: ['gold_mine', 'blacksmith', 'stable']
  }
]

const DEFAULT_HERO: HeroLoadout = {
  id: 'vanguard',
  name: 'Vanguard',
  description: 'A hardened champion who anchors the defense each day.',
  baseStats: {
    hp: 2000,
    attack: 52,
    range: 110,
    speed: 140,
    cooldown: 0.6
  },
  growthPerDay: { hp: 140, attack: 8 },
  abilities: {
    q: {
      id: 'q',
      name: 'Cleave',
      description: 'A wide strike that damages nearby enemies.',
      cooldown: 8,
      damage: 220,
      radius: 170
    },
    e: {
      id: 'e',
      name: 'Second Wind',
      description: 'Recover health to stay in the fight.',
      cooldown: 12,
      heal: 300
    }
  }
}

const RAW_LEVELS = [
  {
    id: 'level_1',
    name: 'Frontier Dawn',
    description: 'Stabilize the frontier through three brutal days.',
    startGold: 50,
    dayRewardGold: 30,
    dayRewardScale: 5,
    heroLoadout: DEFAULT_HERO,
    bossId: 'boss',
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
            elite: 'boss',
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
      playerSpawn: { x: 340, y: 340 },
      enemySpawn: { x: 980, y: 400 },
      playerHQ: { x: 120, y: 340 }
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
    bossId: 'boss',
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
        waves: [
          { id: 'l2_d4_w1', units: [{ type: 'infantry', squads: 4 }, { type: 'archer', squads: 3 }] },
          { id: 'l2_d4_w2', units: [{ type: 'cavalry', squads: 3 }, { type: 'archer', squads: 3 }] },
          {
            id: 'l2_d4_boss',
            elite: 'boss',
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
      playerSpawn: { x: 340, y: 340 },
      enemySpawn: { x: 960, y: 400 },
      playerHQ: { x: 120, y: 340 }
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
    bossId: 'boss',
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
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
        miniBossAfterWave: 2,
        waves: [
          { id: 'l3_d5_w1', units: [{ type: 'infantry', squads: 6 }, { type: 'archer', squads: 4 }] },
          { id: 'l3_d5_w2', units: [{ type: 'cavalry', squads: 3 }, { type: 'archer', squads: 4 }] },
          { id: 'l3_d5_w3', elite: 'boss', units: [{ type: 'infantry', squads: 6 }, { type: 'cavalry', squads: 3 }] }
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
      playerSpawn: { x: 340, y: 340 },
      enemySpawn: { x: 980, y: 400 },
      playerHQ: { x: 120, y: 340 }
    }
  }
]

export const BASE_LEVELS: LevelDefinition[] = RAW_LEVELS.map((raw) => migrateLevelDefinition(raw))

export const getBaseLevels = () => BASE_LEVELS.slice()

export const getLevels = (): LevelDefinition[] => {
  const overrides = getTuningOverrides()
  const baseResolved = BASE_LEVELS.map((base) => overrides[base.id] ?? base)
  const extraOverrides = Object.keys(overrides)
    .filter((id) => !BASE_LEVELS.some((level) => level.id === id))
    .map((id) => overrides[id])
  return [...baseResolved, ...extraOverrides]
}

// Legacy export kept for compatibility. Prefer getLevels() for runtime-aware lookup.
export const LEVELS: LevelDefinition[] = getLevels()

export const getBaseLevelById = (levelId: string) => BASE_LEVELS.find((level) => level.id === levelId)

export const getLevelById = (levelId: string) => {
  const playtest = getPlaytestLevel()
  if (playtest && playtest.id === levelId) return playtest
  const override = getTuningOverrideById(levelId)
  if (override) return override
  return getBaseLevelById(levelId)
}

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
    miniBossAfterWave: last.miniBossAfterWave ?? 2,
    miniBossId: last.miniBossId ?? 'miniBoss',
    waves: last.waves.map((wave) => ({
      ...wave,
      units: wave.units.map((unit) => ({
        ...unit,
        squads: Math.max(1, Math.round(unit.squads * scale))
      }))
    }))
  }
}
