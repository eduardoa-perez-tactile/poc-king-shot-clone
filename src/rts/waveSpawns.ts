import type { SpawnEdge, SpawnEdgeConfig } from '../config/levels'
import type { EnemyTraitId } from '../config/nightContent'
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
  const previewTraitIdsDistinct: EnemyTraitId[] = []
  const previewWaves: NextBattlePreview['previewWaves'] = []
  const previewSpawnTransforms: SpawnTransform[] = []
  const seenTransforms = new Set<string>()
  const legacy = getLegacySpawnTransform(map)
  let hasEliteVariantWarning = false

  waves.forEach((wave) => {
    const waveEnemyTypes: string[] = []
    const waveTraitIds: EnemyTraitId[] = []
    const waveEdges: SpawnEdge[] = []
    const waveHasElite = Boolean(
      wave.plannedSpawns?.some((spawn) => spawn.isEliteVariant) ||
      (typeof wave.eliteChance === 'number' && wave.eliteChance > 0) ||
      wave.groups?.some((group) => (group.eliteChance ?? 0) > 0)
    )
    if (waveHasElite) hasEliteVariantWarning = true
    wave.units.forEach((unit) => pushDistinct(previewEnemyTypesDistinct, unit.type))
    wave.units.forEach((unit) => pushDistinct(waveEnemyTypes, unit.type))
    if (wave.elite) pushDistinct(previewEnemyTypesDistinct, wave.elite)

    wave.traits?.forEach((traitId) => {
      pushDistinct(previewTraitIdsDistinct, traitId)
      pushDistinct(waveTraitIds, traitId)
    })
    wave.groups?.forEach((group) => {
      pushDistinct(previewEnemyTypesDistinct, group.enemyTypeId)
      pushDistinct(waveEnemyTypes, group.enemyTypeId)
      group.traits?.forEach((traitId) => {
        pushDistinct(previewTraitIdsDistinct, traitId)
        pushDistinct(waveTraitIds, traitId)
      })
      if ((group.eliteChance ?? 0) > 0) hasEliteVariantWarning = true
    })
    wave.plannedSpawns?.forEach((spawn) => {
      pushDistinct(previewEnemyTypesDistinct, spawn.enemyTypeId)
      pushDistinct(waveEnemyTypes, spawn.enemyTypeId)
      spawn.traits.forEach((traitId) => {
        pushDistinct(previewTraitIdsDistinct, traitId)
        pushDistinct(waveTraitIds, traitId)
      })
      if (spawn.isEliteVariant) hasEliteVariantWarning = true
    })

    const transforms = wave.resolvedSpawnTransforms && wave.resolvedSpawnTransforms.length > 0
      ? wave.resolvedSpawnTransforms
      : [legacy]

    transforms.forEach((transform) => {
      pushDistinct(previewEdges, transform.edge)
      pushDistinct(waveEdges, transform.edge)
      const key = `${transform.edge}:${Math.round(transform.position.x)}:${Math.round(transform.position.y)}`
      if (seenTransforms.has(key)) return
      seenTransforms.add(key)
      previewSpawnTransforms.push(transform)
    })

    previewWaves.push({
      id: wave.id,
      enemyTypes: waveEnemyTypes,
      traitIds: waveTraitIds,
      hasEliteVariant: waveHasElite,
      spawnEdges: waveEdges.length > 0 ? waveEdges : [legacy.edge]
    })
  })

  if (previewEdges.length === 0) previewEdges.push(legacy.edge)
  if (previewSpawnTransforms.length === 0) previewSpawnTransforms.push(legacy)

  return {
    previewEdges,
    previewEnemyTypesDistinct,
    previewTraitIdsDistinct,
    previewWaves,
    hasEliteVariantWarning,
    previewSpawnTransforms
  }
}
