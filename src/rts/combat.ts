import { getHeroRuntime, getRunDayPlan, getRunLevel } from '../run/runState'
import { EliteId } from '../config/elites'
import { getStrongholdHqBaseHp } from '../config/stronghold'
import {
  OBSTACLE_DENSITY_MULTIPLIER_DEFAULT,
  OBSTACLE_FOOTPRINT_SHRINK,
  OBSTACLE_WALL_CORRIDOR_MARGIN
} from '../config/rendering'
import { BuildingPad } from '../config/levels'
import { RunState } from '../run/types'
import { buildNightPlan, getBuffSnapshot, getEliteConfigForLevel, getEnemyTraitDefs } from '../run/nightSystems'
import { PAD_SIZE } from './pads'
import { CombatDefinition, CombatWave, Rect, Vec2 } from './types'
import { buildNextBattlePreview, resolveCombatWaveSpawns } from './waveSpawns'

const MIN_OBSTACLE_SIZE = 14
const OBSTACLE_GAP = 16
const DENSITY_JITTER = 96

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const hashSeed = (seed: string) => {
  let value = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

const createRng = (seed: string) => {
  let state = hashSeed(seed) || 0x811c9dc5
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

const shrinkObstacle = (obstacle: Rect, shrinkFactor: number): Rect => {
  const nextW = Math.max(MIN_OBSTACLE_SIZE, obstacle.w * shrinkFactor)
  const nextH = Math.max(MIN_OBSTACLE_SIZE, obstacle.h * shrinkFactor)
  return {
    x: obstacle.x + (obstacle.w - nextW) * 0.5,
    y: obstacle.y + (obstacle.h - nextH) * 0.5,
    w: nextW,
    h: nextH
  }
}

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const expandRect = (rect: Rect, margin: number): Rect => ({
  x: rect.x - margin,
  y: rect.y - margin,
  w: rect.w + margin * 2,
  h: rect.h + margin * 2
})

const distanceToSegment = (point: Vec2, a: Vec2, b: Vec2) => {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const wx = point.x - a.x
  const wy = point.y - a.y
  const lenSq = vx * vx + vy * vy
  if (lenSq <= 0.0001) return Math.hypot(wx, wy)
  const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1)
  const projX = a.x + vx * t
  const projY = a.y + vy * t
  return Math.hypot(point.x - projX, point.y - projY)
}

const buildReservedRects = (pads: BuildingPad[], map: CombatDefinition['map']) => {
  const padMargin = OBSTACLE_WALL_CORRIDOR_MARGIN
  const padRects = pads.map((pad) => ({
    x: pad.x - PAD_SIZE.w / 2 - padMargin,
    y: pad.y - PAD_SIZE.h / 2 - padMargin,
    w: PAD_SIZE.w + padMargin * 2,
    h: PAD_SIZE.h + padMargin * 2
  }))

  const pointRadius = OBSTACLE_WALL_CORRIDOR_MARGIN * 1.7
  const pointRects = [map.playerHQ, map.playerSpawn, map.enemySpawn].map((point) => ({
    x: point.x - pointRadius,
    y: point.y - pointRadius,
    w: pointRadius * 2,
    h: pointRadius * 2
  }))

  return [...padRects, ...pointRects]
}

const isObstaclePlacementValid = (
  candidate: Rect,
  placed: Rect[],
  reservedRects: Rect[],
  map: CombatDefinition['map'],
  corridor: { from: Vec2; to: Vec2; halfWidth: number }
) => {
  if (candidate.w < MIN_OBSTACLE_SIZE || candidate.h < MIN_OBSTACLE_SIZE) return false
  if (candidate.x < 0 || candidate.y < 0) return false
  if (candidate.x + candidate.w > map.width || candidate.y + candidate.h > map.height) return false

  if (reservedRects.some((reserved) => intersects(candidate, reserved))) return false

  const center = { x: candidate.x + candidate.w * 0.5, y: candidate.y + candidate.h * 0.5 }
  const diagHalf = Math.hypot(candidate.w, candidate.h) * 0.5
  if (distanceToSegment(center, corridor.from, corridor.to) <= corridor.halfWidth + diagHalf) return false

  const inflated = expandRect(candidate, OBSTACLE_GAP)
  if (placed.some((obstacle) => intersects(expandRect(obstacle, OBSTACLE_GAP), inflated))) return false

  return true
}

const preprocessCombatMap = (
  map: CombatDefinition['map'],
  pads: BuildingPad[],
  seed: string,
  obstacleDensityMultiplier?: number
): CombatDefinition['map'] => {
  const density = Math.max(1, obstacleDensityMultiplier ?? OBSTACLE_DENSITY_MULTIPLIER_DEFAULT)
  const corridor = {
    from: map.playerHQ,
    to: map.enemySpawn,
    halfWidth: OBSTACLE_WALL_CORRIDOR_MARGIN
  }
  const reservedRects = buildReservedRects(pads, map)

  const baseObstacles = map.obstacles
    .map((obstacle) => shrinkObstacle(obstacle, OBSTACLE_FOOTPRINT_SHRINK))
    .filter((candidate, index, arr) =>
      isObstaclePlacementValid(candidate, arr.filter((_, otherIndex) => otherIndex < index), reservedRects, map, corridor)
    )

  const targetCount = Math.max(baseObstacles.length, Math.round(baseObstacles.length * density))
  if (targetCount <= baseObstacles.length || baseObstacles.length === 0) {
    return {
      ...map,
      obstacles: baseObstacles
    }
  }

  const rng = createRng(seed)
  const obstacles = [...baseObstacles]
  let attempts = 0
  const maxAttempts = Math.max(40, targetCount * 30)

  while (obstacles.length < targetCount && attempts < maxAttempts) {
    attempts += 1
    const template = baseObstacles[Math.floor(rng() * baseObstacles.length)]
    if (!template) break

    const scale = 0.85 + rng() * 0.35
    const width = clamp(template.w * scale, MIN_OBSTACLE_SIZE, map.width * 0.25)
    const height = clamp(template.h * scale, MIN_OBSTACLE_SIZE, map.height * 0.25)

    const jitterX = (rng() - 0.5) * DENSITY_JITTER * 2
    const jitterY = (rng() - 0.5) * DENSITY_JITTER * 2
    const centerX = template.x + template.w * 0.5 + jitterX
    const centerY = template.y + template.h * 0.5 + jitterY

    const candidate: Rect = {
      x: clamp(centerX - width * 0.5, 0, map.width - width),
      y: clamp(centerY - height * 0.5, 0, map.height - height),
      w: width,
      h: height
    }

    if (!isObstaclePlacementValid(candidate, obstacles, reservedRects, map, corridor)) continue
    obstacles.push(candidate)
  }

  return {
    ...map,
    obstacles
  }
}

export const buildCombatDefinition = (run: RunState): CombatDefinition => {
  const level = getRunLevel(run)
  const dayPlan = getRunDayPlan(run)
  const buffs = getBuffSnapshot(level, run)
  const plan = run.nextNightPlan && run.nextNightPlan.nightIndex === run.dayNumber
    ? run.nextNightPlan
    : buildNightPlan(level, run, dayPlan.waves)

  const lastDay = Math.max(...level.days.map((day) => day.day))
  const miniBossAfterWave = dayPlan.miniBossAfterWave ?? 2
  const suppressDayOneMiniBoss = level.minibossRules.suppressDay1MiniBoss && run.dayNumber === 1
  const miniBossId: EliteId = dayPlan.miniBossId ?? 'miniBoss'
  const bossId: EliteId = level.bossId ?? 'boss'

  let waves: CombatWave[] = plan.waves.map((wave) => {
    const unitCounts = new Map<string, { squads: number; squadSize?: number }>()
    wave.spawns.forEach((spawn) => {
      const current = unitCounts.get(spawn.enemyTypeId)
      if (!current) {
        unitCounts.set(spawn.enemyTypeId, { squads: 1, squadSize: spawn.squadSize })
        return
      }
      unitCounts.set(spawn.enemyTypeId, { ...current, squads: current.squads + 1 })
    })
    return {
      id: wave.id,
      units: Array.from(unitCounts.entries()).map(([type, value]) => ({
        type: type as CombatWave['units'][number]['type'],
        squads: value.squads,
        squadSize: value.squadSize
      })),
      spawnTimeSec: wave.spawnTimeSec,
      elite: wave.legacyEliteId as EliteId | undefined,
      eliteCount: wave.legacyEliteCount,
      spawnEdges: wave.spawnEdges,
      spawnPointsPerEdge: wave.spawnPointsPerEdge,
      spawnPadding: wave.spawnPadding,
      plannedSpawns: wave.spawns.map((spawn) => ({ ...spawn })),
      spawnSeed: wave.spawnSeed
    }
  })

  if (!suppressDayOneMiniBoss && miniBossAfterWave > 0 && waves.length >= miniBossAfterWave) {
    const insertIndex = Math.min(waves.length, miniBossAfterWave)
    waves = [
      ...waves.slice(0, insertIndex),
      {
        id: `mini_${run.dayNumber}_${insertIndex}`,
        units: [],
        elite: miniBossId,
        eliteCount: 1
      },
      ...waves.slice(insertIndex)
    ]
  } else if (suppressDayOneMiniBoss && import.meta.env.DEV) {
    console.debug('[Combat] Day 1 miniboss suppressed by level rule.')
  }

  if (run.dayNumber === lastDay && waves.length > 0) {
    const finalIndex = waves.length - 1
    const finalWave = waves[finalIndex]
    waves[finalIndex] = { ...finalWave, elite: bossId, eliteCount: finalWave.eliteCount ?? 1 }
  }
  const map = preprocessCombatMap(
    level.map,
    level.buildingPads,
    `${run.runSeed}:map:${run.dayNumber}`,
    level.map.obstacleDensityMultiplier
  )
  const spawnSeed = `${run.runSeed}:spawns:${run.dayNumber}`
  const resolvedWaves = resolveCombatWaveSpawns(waves, map, spawnSeed)
  const nextBattlePreview = buildNextBattlePreview(resolvedWaves, map)

  if (import.meta.env.DEV) {
    console.debug(
      `[Combat] Day ${run.dayNumber} preview edges=${nextBattlePreview.previewEdges.join(',')} types=${nextBattlePreview.previewEnemyTypesDistinct.join(',')}`
    )
  }

  return {
    dayNumber: run.dayNumber,
    runSeed: run.runSeed,
    nightIndex: run.dayNumber,
    hero: getHeroRuntime(run),
    towersDisabled: buffs.towersDisabled,
    enemyTraitDefs: getEnemyTraitDefs(level),
    eliteConfig: getEliteConfigForLevel(level),
    map,
    waves: resolvedWaves,
    waveMode: dayPlan.waveMode ?? 'sequential',
    waveDelaySec: dayPlan.waveDelaySec ?? 5,
    enemyModifiers: {
      hpMultiplier: (dayPlan.enemyModifiers?.hpMultiplier ?? 1) * buffs.enemyHpMultiplier,
      attackMultiplier: dayPlan.enemyModifiers?.attackMultiplier ?? 1,
      moveSpeedMultiplier: buffs.enemyMoveSpeedMultiplier
    },
    hqBaseHp: getStrongholdHqBaseHp(run.strongholdLevel),
    nextBattlePreview
  }
}
