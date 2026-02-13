export type WorldBiome = 'grass' | 'desert' | 'snow' | 'swamp'

export type WorldVec3 = { x: number; y: number; z: number }

export type MissionNodeDef = {
  id: string
  levelId: string
  name: string
  biome: WorldBiome
  tileIndex: number
  position: WorldVec3
  unlocks: string[]
  start?: boolean
  difficulty: 1 | 2 | 3 | 4 | 5
  waves: number
}

export type WorldTileDef = {
  index: number
  biome: WorldBiome
  position: WorldVec3
  size: { w: number; h: number }
  height: number
}

export const WORLD_TILES: WorldTileDef[] = [
  { index: 0, biome: 'grass', position: { x: 0, y: 0, z: 0 }, size: { w: 18, h: 10 }, height: 0.2 }
]

export const WORLD_MISSIONS: MissionNodeDef[] = [
  {
    id: 'frontier_dawn',
    levelId: 'level_1',
    name: 'Frontier Dawn',
    biome: 'grass',
    tileIndex: 0,
    position: { x: -5, y: 0.55, z: 0 },
    unlocks: ['iron_reprisal'],
    start: true,
    difficulty: 1,
    waves: 8
  },
  {
    id: 'iron_reprisal',
    levelId: 'level_2',
    name: 'Iron Reprisal',
    biome: 'desert',
    tileIndex: 0,
    position: { x: 0, y: 0.55, z: 0 },
    unlocks: ['last_rampart'],
    difficulty: 3,
    waves: 10
  },
  {
    id: 'last_rampart',
    levelId: 'level_3',
    name: 'Last Rampart',
    biome: 'snow',
    tileIndex: 0,
    position: { x: 5, y: 0.55, z: 0 },
    unlocks: [],
    difficulty: 5,
    waves: 14
  }
]
