import type { SpawnEdge, SpawnEdgeConfig } from '../config/levels'
import type { CombatDefinition, CombatWave, NextBattlePreview, SpawnTransform, Vec2 } from './types'
import { inferSpawnEdgeFromPoint, resolveSpawnTransforms } from './spawnResolver'

const DEFAULT_BORDER_PADDING = 48

const normalize = (vec: Vec2): Vec2 => {
  const length = Math.hypot(vec.x, vec.y)
  if (length <= 0.0001) return { x: 0, y: 1 }
  return {
    x: vec.x / length,
    y: vec.y / length
  }
}

const toBounds = (map: CombatDefinition['map']) => ({
  minX: 0,
  maxX: map.width,
  minY: 0,
  maxY: map.height
})

const getLegacySpawnTransform = (map: CombatDefinition['map']): SpawnTransform => {
  const center = { x: map.width * 0.5, y: map.height * 0.5 }
  return {
    position: { ...map.enemySpawn },
    forward: normalize({ x: center.x - map.enemySpawn.x, y: center.y - map.enemySpawn.y }),
    edge: inferSpawnEdgeFromPoint(map.enemySpawn, toBounds(map))
  }
}

export const resolveWaveSpawnTransforms = (
  wave: CombatWave,
  map: CombatDefinition['map'],
  rngSeed: string | number
): SpawnTransform[] => {
  const hasEdges = Boolean(wave.spawnEdges && wave.spawnEdges.length > 0)
  const hasBorderConfig = hasEdges || wave.spawnPointsPerEdge !== undefined || wave.spawnPadding !== undefined
  if (!hasBorderConfig) {
    return [getLegacySpawnTransform(map)]
  }

  const bounds = toBounds(map)
  const fallbackEdge = inferSpawnEdgeFromPoint(map.enemySpawn, bounds)
  const edges: SpawnEdgeConfig[] = hasEdges ? wave.spawnEdges! : [{ edge: fallbackEdge }]
  const resolved = resolveSpawnTransforms({
    edges,
    countPerEdge: wave.spawnPointsPerEdge,
    bounds,
    padding: Math.max(0, wave.spawnPadding ?? DEFAULT_BORDER_PADDING),
    rngSeed
  })

  if (resolved.length > 0) return resolved
  return [getLegacySpawnTransform(map)]
}

export const resolveCombatWaveSpawns = (
  waves: CombatWave[],
  map: CombatDefinition['map'],
  seedPrefix: string | number
): CombatWave[] =>
  waves.map((wave, index) => ({
    ...wave,
    resolvedSpawnTransforms: resolveWaveSpawnTransforms(wave, map, `${seedPrefix}:${wave.id}:${index}`)
  }))

const pushDistinct = (target: string[], value: string) => {
  if (!target.includes(value)) target.push(value)
}

export const buildNextBattlePreview = (waves: CombatWave[], map: CombatDefinition['map']): NextBattlePreview => {
  const previewEdges: SpawnEdge[] = []
  const previewEnemyTypesDistinct: string[] = []
  const previewSpawnTransforms: SpawnTransform[] = []
  const seenTransforms = new Set<string>()
  const legacy = getLegacySpawnTransform(map)

  waves.forEach((wave) => {
    wave.units.forEach((unit) => pushDistinct(previewEnemyTypesDistinct, unit.type))
    if (wave.elite) pushDistinct(previewEnemyTypesDistinct, wave.elite)

    const transforms = wave.resolvedSpawnTransforms && wave.resolvedSpawnTransforms.length > 0
      ? wave.resolvedSpawnTransforms
      : [legacy]

    transforms.forEach((transform) => {
      pushDistinct(previewEdges, transform.edge)
      const key = `${transform.edge}:${Math.round(transform.position.x)}:${Math.round(transform.position.y)}`
      if (seenTransforms.has(key)) return
      seenTransforms.add(key)
      previewSpawnTransforms.push(transform)
    })
  })

  if (previewEdges.length === 0) previewEdges.push(legacy.edge)
  if (previewSpawnTransforms.length === 0) previewSpawnTransforms.push(legacy)

  return {
    previewEdges,
    previewEnemyTypesDistinct,
    previewSpawnTransforms
  }
}
