import { getPlaytestLevel } from '../game/runtime/playtest'
import { getTuningOverrideById, getTuningOverrides } from '../game/tuning/tuningStore'
import { TUTORIAL_LEVEL_RAW } from '../levels/tutorial_01'
import { getTutorialScriptForLevelId } from '../tutorial/tutorialScripts'
import type { TutorialScript } from '../tutorial/tutorialTypes'
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
  NightModifierDef,
  NightModifierId,
  PerkDef,
  PerkId,
  EnemyTraitDef,
  EnemyTraitId,
  EliteConfig,
  LevelStrongholdTuning,
  LevelValidationIssue,
  LevelValidationResult,
  LevelWaveRules,
  SpawnEdge,
  SpawnEdgeConfig,
  SpawnPointCount,
  SpawnPointCountRange,
  WaveUnitGroup
} from '../game/types/LevelDefinition'

const LEVEL_1_PADS: BuildingPad[] = [
  {
    id: 'pad_barracks',
    x: 228,
    y: 192,
    rotation: 0,
    padType: 'UNIT_PRODUCER',
    allowedBuildingType: 'barracks',
    allowedTypes: ['barracks'],
    unlockLevel: 1
  },
  {
    id: 'pad_archer',
    x: 318,
    y: 674,
    rotation: 0,
    padType: 'UNIT_PRODUCER',
    allowedBuildingType: 'range',
    allowedTypes: ['range'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_nw',
    x: 498,
    y: 164,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_ne',
    x: 708,
    y: 172,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_sw',
    x: 482,
    y: 572,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_se',
    x: 722,
    y: 548,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_west_mid',
    x: 240,
    y: 400,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_east_mid',
    x: 960,
    y: 400,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_north_mid',
    x: 600,
    y: 104,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_tower_south_mid',
    x: 600,
    y: 696,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'pad_wall_gate',
    x: 430,
    y: 418,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'wall',
    allowedTypes: ['wall'],
    unlockLevel: 1
  },
  {
    id: 'pad_hero',
    x: 624,
    y: 340,
    rotation: 0,
    padType: 'HERO',
    allowedBuildingType: 'hero_recruiter',
    allowedTypes: ['hero_recruiter'],
    unlockLevel: 3
  }
]

const DEFAULT_PADS: BuildingPad[] = LEVEL_1_PADS

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

const MIN_WATCHTOWER_PADS = 4
const MIN_PAD_SPACING = 86

const isWatchtowerPad = (pad: BuildingPad) =>
  pad.padType === 'TOWER_ONLY' && pad.allowedBuildingType === 'watchtower' && pad.allowedTypes.includes('watchtower')

const createWatchtowerPad = (id: string, x: number, y: number): BuildingPad => ({
  id,
  x,
  y,
  rotation: 0,
  padType: 'TOWER_ONLY',
  allowedBuildingType: 'watchtower',
  allowedTypes: ['watchtower'],
  unlockLevel: 1
})

const buildTowerPadCandidates = (map: LevelDefinition['map']) => [
  { x: map.width * 0.42, y: map.height * 0.22 },
  { x: map.width * 0.58, y: map.height * 0.22 },
  { x: map.width * 0.42, y: map.height * 0.72 },
  { x: map.width * 0.58, y: map.height * 0.72 },
  { x: map.width * 0.32, y: map.height * 0.42 },
  { x: map.width * 0.68, y: map.height * 0.42 },
  { x: map.width * 0.32, y: map.height * 0.6 },
  { x: map.width * 0.68, y: map.height * 0.6 }
]

const isTooCloseToOtherPads = (pads: BuildingPad[], x: number, y: number) =>
  pads.some((pad) => {
    const dx = pad.x - x
    const dy = pad.y - y
    return Math.hypot(dx, dy) < MIN_PAD_SPACING
  })

const ensureMinimumTowerPads = (level: LevelDefinition): LevelDefinition => {
  const towerPads = level.buildingPads.filter(isWatchtowerPad)
  const minTowerPads = Math.max(level.padConstraints.minTowerPads, MIN_WATCHTOWER_PADS)
  if (towerPads.length >= MIN_WATCHTOWER_PADS && minTowerPads === level.padConstraints.minTowerPads) return level

  const pads = level.buildingPads.map((pad) => ({ ...pad, allowedTypes: [...pad.allowedTypes] }))
  const existingIds = new Set(pads.map((pad) => pad.id))
  const addedPadIds: string[] = []
  let nextTowerCount = towerPads.length
  let autoIndex = 1

  const addTowerPad = (x: number, y: number) => {
    if (nextTowerCount >= MIN_WATCHTOWER_PADS) return
    const clampedX = Math.max(40, Math.min(level.map.width - 40, Math.round(x)))
    const clampedY = Math.max(40, Math.min(level.map.height - 40, Math.round(y)))
    if (isTooCloseToOtherPads(pads, clampedX, clampedY)) return
    while (existingIds.has(`pad_tower_auto_${autoIndex}`)) {
      autoIndex += 1
    }
    const id = `pad_tower_auto_${autoIndex}`
    existingIds.add(id)
    pads.push(createWatchtowerPad(id, clampedX, clampedY))
    addedPadIds.push(id)
    nextTowerCount += 1
  }

  buildTowerPadCandidates(level.map).forEach((candidate) => addTowerPad(candidate.x, candidate.y))

  if (nextTowerCount < MIN_WATCHTOWER_PADS) {
    const centerX = level.map.width * 0.52
    const centerY = level.map.height * 0.48
    const radius = Math.min(level.map.width, level.map.height) * 0.22
    for (let i = 0; i < 16 && nextTowerCount < MIN_WATCHTOWER_PADS; i += 1) {
      const angle = (Math.PI * 2 * i) / 16
      addTowerPad(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius)
    }
  }

  const padUnlockLevels = { ...level.stronghold.padUnlockLevels }
  addedPadIds.forEach((padId) => {
    padUnlockLevels[padId] = 1
  })

  const padUnlocksByLevel = Object.entries(level.stronghold.padUnlocksByLevel).reduce<Record<string, string[]>>((acc, [lv, ids]) => {
    acc[lv] = [...ids]
    return acc
  }, {})
  const levelOneUnlocks = new Set(padUnlocksByLevel['1'] ?? [])
  addedPadIds.forEach((padId) => levelOneUnlocks.add(padId))
  padUnlocksByLevel['1'] = Array.from(levelOneUnlocks)

  return {
    ...level,
    padConstraints: {
      ...level.padConstraints,
      minTowerPads
    },
    buildingPads: pads,
    stronghold: {
      ...level.stronghold,
      padUnlockLevels,
      padUnlocksByLevel
    }
  }
}

type RuntimeLevelDefinition = LevelDefinition & {
  tutorialScript?: TutorialScript
}

const withTutorialScript = <T extends LevelDefinition>(level: T): T & { tutorialScript?: TutorialScript } => {
  const tutorialScript = getTutorialScriptForLevelId(level.id)
  if (!tutorialScript) return level as T & { tutorialScript?: TutorialScript }
  return {
    ...level,
    tutorialScript
  }
}

const RAW_LEVELS = [
  TUTORIAL_LEVEL_RAW,
  {
    id: 'level_1',
    name: 'Frontier Dawn',
    description: 'Stabilize the frontier through three brutal days.',
    startGold: 1000,
    dayRewardGold: 30,
    dayRewardScale: 5,
    heroLoadout: DEFAULT_HERO,
    bossId: 'boss',
    buildingPads: LEVEL_1_PADS,
    startingBuildings: [],
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
            spawnEdges: ['N', 'E'],
            spawnPointsPerEdge: 1,
            units: [
              { type: 'infantry', squads: 2 },
              { type: 'archer', squads: 1 }
            ]
          },
          {
            id: 'd1_w2',
            spawnEdges: ['S'],
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
            spawnEdges: [
              { edge: 'W', weight: 1.4 },
              { edge: 'N', weight: 1 }
            ],
            spawnPointsPerEdge: { min: 1, max: 2 },
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
    startGold: 1000,
    dayRewardGold: 40,
    dayRewardScale: 6,
    heroLoadout: DEFAULT_HERO,
    bossId: 'boss',
    buildingPads: DEFAULT_PADS,
    startingBuildings: [],
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
    startGold: 1000,
    dayRewardGold: 50,
    dayRewardScale: 8,
    heroLoadout: DEFAULT_HERO,
    bossId: 'boss',
    buildingPads: DEFAULT_PADS,
    startingBuildings: [],
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

export const BASE_LEVELS: RuntimeLevelDefinition[] = RAW_LEVELS.map((raw) =>
  withTutorialScript(ensureMinimumTowerPads(migrateLevelDefinition(raw)))
)

export const getBaseLevels = () => BASE_LEVELS.slice()

export const getLevels = (): RuntimeLevelDefinition[] => {
  const overrides = getTuningOverrides()
  const baseResolved = BASE_LEVELS.map((base) => withTutorialScript(ensureMinimumTowerPads(overrides[base.id] ?? base)))
  const extraOverrides = Object.keys(overrides)
    .filter((id) => !BASE_LEVELS.some((level) => level.id === id))
    .map((id) => withTutorialScript(ensureMinimumTowerPads(overrides[id])))
  return [...baseResolved, ...extraOverrides]
}

// Legacy export kept for compatibility. Prefer getLevels() for runtime-aware lookup.
export const LEVELS: RuntimeLevelDefinition[] = getLevels()

export const getBaseLevelById = (levelId: string) => BASE_LEVELS.find((level) => level.id === levelId)

export const getLevelById = (levelId: string) => {
  const playtest = getPlaytestLevel()
  if (playtest && playtest.id === levelId) return withTutorialScript(playtest)
  const override = getTuningOverrideById(levelId)
  if (override) return withTutorialScript(override)
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
      })),
      groups: wave.groups?.map((group) => ({
        ...group,
        count: Math.max(1, Math.round(group.count * scale))
      }))
    }))
  }
}
