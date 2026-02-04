import { MissionDefinition } from './types'

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_1',
    name: 'Frontier Trial',
    description: 'Hold the line and survive the raider waves for 3 minutes.',
    difficulty: 'Easy',
    objective: { type: 'survive', durationSec: 180 },
    rewards: {
      resources: { food: 80, wood: 80, stone: 40, gold: 20 },
      xpItems: 2,
      keys: { gold: 1, platinum: 0 }
    },
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
    },
    startingUnits: [
      { type: 'infantry', squads: 3, squadSize: 10 },
      { type: 'archer', squads: 2, squadSize: 8 },
      { type: 'cavalry', squads: 1, squadSize: 6 }
    ],
    waves: [
      { timeSec: 20, units: [{ type: 'infantry', squads: 2, squadSize: 10 }] },
      { timeSec: 60, units: [{ type: 'archer', squads: 2, squadSize: 8 }, { type: 'infantry', squads: 2, squadSize: 10 }] },
      { timeSec: 120, units: [{ type: 'cavalry', squads: 2, squadSize: 6 }, { type: 'infantry', squads: 2, squadSize: 12 }] },
      { timeSec: 160, units: [{ type: 'infantry', squads: 3, squadSize: 12 }, { type: 'archer', squads: 2, squadSize: 10 }] }
    ]
  },
  {
    id: 'mission_2',
    name: 'Break the Keep',
    description: 'Destroy the enemy HQ guarded by defenders.',
    difficulty: 'Medium',
    objective: { type: 'destroy_hq' },
    rewards: {
      resources: { food: 120, wood: 120, stone: 80, gold: 30 },
      xpItems: 3,
      keys: { gold: 1, platinum: 1 }
    },
    unlockAfter: 'mission_1',
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
      playerHQ: { x: 160, y: 400 },
      enemyHQ: { x: 1040, y: 400 }
    },
    startingUnits: [
      { type: 'infantry', squads: 4, squadSize: 12 },
      { type: 'archer', squads: 3, squadSize: 10 },
      { type: 'cavalry', squads: 2, squadSize: 8 }
    ],
    waves: [
      { timeSec: 25, units: [{ type: 'infantry', squads: 2, squadSize: 12 }] },
      { timeSec: 80, units: [{ type: 'archer', squads: 2, squadSize: 10 }, { type: 'infantry', squads: 2, squadSize: 12 }] },
      { timeSec: 140, units: [{ type: 'cavalry', squads: 2, squadSize: 8 }] }
    ]
  },
  {
    id: 'mission_3',
    name: 'Last Stand',
    description: 'Survive escalating waves for 6 minutes.',
    difficulty: 'Hard',
    objective: { type: 'survive', durationSec: 360 },
    rewards: {
      resources: { food: 180, wood: 180, stone: 120, gold: 50 },
      xpItems: 5,
      keys: { gold: 2, platinum: 1 }
    },
    unlockAfter: 'mission_2',
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
    },
    startingUnits: [
      { type: 'infantry', squads: 5, squadSize: 12 },
      { type: 'archer', squads: 4, squadSize: 10 },
      { type: 'cavalry', squads: 3, squadSize: 8 }
    ],
    waves: [
      { timeSec: 30, units: [{ type: 'infantry', squads: 3, squadSize: 12 }] },
      { timeSec: 90, units: [{ type: 'archer', squads: 3, squadSize: 12 }, { type: 'infantry', squads: 2, squadSize: 12 }] },
      { timeSec: 150, units: [{ type: 'cavalry', squads: 3, squadSize: 10 }] },
      { timeSec: 210, units: [{ type: 'infantry', squads: 4, squadSize: 14 }, { type: 'archer', squads: 3, squadSize: 12 }] },
      { timeSec: 270, units: [{ type: 'cavalry', squads: 4, squadSize: 10 }] },
      { timeSec: 330, units: [{ type: 'infantry', squads: 4, squadSize: 14 }, { type: 'archer', squads: 4, squadSize: 12 }] }
    ]
  }
]
