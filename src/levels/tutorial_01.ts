import type { BuildingPad, HeroLoadout } from '../config/levels'

const TUTORIAL_HERO: HeroLoadout = {
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

const TUTORIAL_PADS: BuildingPad[] = [
  {
    id: 'tut_pad_tower_1',
    x: 520,
    y: 300,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'tut_pad_tower_2',
    x: 680,
    y: 300,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'tut_pad_tower_3',
    x: 520,
    y: 500,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'tut_pad_tower_4',
    x: 680,
    y: 500,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'watchtower',
    allowedTypes: ['watchtower'],
    unlockLevel: 1
  },
  {
    id: 'tut_pad_barracks',
    x: 450,
    y: 420,
    rotation: 0,
    padType: 'UNIT_PRODUCER',
    allowedBuildingType: 'barracks',
    allowedTypes: ['barracks'],
    unlockLevel: 1
  },
  {
    id: 'tut_pad_archer',
    x: 750,
    y: 420,
    rotation: 0,
    padType: 'UNIT_PRODUCER',
    allowedBuildingType: 'range',
    allowedTypes: ['range'],
    unlockLevel: 2
  },
  {
    id: 'tut_pad_wall',
    x: 730,
    y: 400,
    rotation: 0,
    padType: 'TOWER_ONLY',
    allowedBuildingType: 'wall',
    allowedTypes: ['wall'],
    unlockLevel: 1
  }
]

export const TUTORIAL_LEVEL_RAW = {
  id: 'tutorial_01',
  name: 'Frontier Drill',
  description: 'Guided tutorial: learn controls, construction, and the day-night defense loop.',
  startGold: 340,
  dayRewardGold: 30,
  dayRewardScale: 3,
  heroLoadout: TUTORIAL_HERO,
  bossId: 'boss',
  buildingPads: TUTORIAL_PADS,
  startingBuildings: [],
  goals: [
    { id: 'goal_tutorial_survive_2', type: 'survive_days', label: 'Survive until Day 2', target: 2 }
  ],
  nightModifiers: [
    {
      id: 'tutorial_low_risk_i',
      name: 'Skirmish Tax',
      description: 'Slightly more enemies for a small score multiplier.',
      rewardMultiplier: 1.05,
      effects: {
        enemyCountMultiplier: 0.06
      }
    },
    {
      id: 'tutorial_low_risk_ii',
      name: 'Reinforced Scouts',
      description: 'Enemies are a bit tougher for a medium score multiplier.',
      rewardMultiplier: 1.1,
      effects: {
        enemyHpMultiplier: 0.08
      }
    },
    {
      id: 'tutorial_low_risk_iii',
      name: 'Rapid Advance',
      description: 'Enemies move faster for the highest tutorial multiplier.',
      rewardMultiplier: 1.15,
      effects: {
        enemyMoveSpeedMultiplier: 0.1
      }
    }
  ],
  allowedNightModifiersByNight: {
    1: ['tutorial_low_risk_i', 'tutorial_low_risk_ii', 'tutorial_low_risk_iii']
  },
  days: [
    {
      day: 1,
      waveMode: 'sequential',
      waveDelaySec: 6,
      enemyModifiers: { hpMultiplier: 1, attackMultiplier: 1 },
      waves: [
        {
          id: 'tutorial_d1_w1',
          spawnEdges: ['E'],
          spawnPointsPerEdge: 1,
          units: [{ type: 'infantry', squads: 2 }]
        },
        {
          id: 'tutorial_d1_w2',
          spawnEdges: ['E'],
          spawnPointsPerEdge: 1,
          units: [{ type: 'infantry', squads: 2 }, { type: 'archer', squads: 1 }]
        }
      ]
    },
    {
      day: 2,
      waveMode: 'sequential',
      waveDelaySec: 6,
      enemyModifiers: { hpMultiplier: 1.08, attackMultiplier: 1.05 },
      waves: [
        {
          id: 'tutorial_d2_w1',
          spawnEdges: ['N'],
          spawnPointsPerEdge: 1,
          units: [{ type: 'infantry', squads: 2 }, { type: 'archer', squads: 1 }]
        },
        {
          id: 'tutorial_d2_w2',
          spawnEdges: [{ edge: 'W', weight: 1 }, { edge: 'E', weight: 1 }],
          spawnPointsPerEdge: 1,
          units: [{ type: 'infantry', squads: 3 }, { type: 'archer', squads: 2 }]
        }
      ]
    }
  ],
  map: {
    width: 1200,
    height: 800,
    obstacles: [
      { x: 300, y: 250, w: 120, h: 120 },
      { x: 300, y: 430, w: 120, h: 120 }
    ],
    playerSpawn: { x: 600, y: 470 },
    enemySpawn: { x: 1030, y: 400 },
    playerHQ: { x: 600, y: 400 }
  }
}
