import type { SpawnEdge, SpawnEdgeConfig, SpawnPointCount } from '../config/levels'
import type { SpawnTransform, Vec2 } from './types'

export interface SpawnBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ResolveSpawnTransformsInput {
  edges: Array<SpawnEdge | SpawnEdgeConfig>
  countPerEdge?: SpawnPointCount
  bounds: SpawnBounds
  padding?: number
  minDistance?: number
  rngSeed?: string | number
}

const DEFAULT_PADDING = 36
const DEFAULT_MIN_DISTANCE = 60
const EDGE_ORDER: SpawnEdge[] = ['N', 'E', 'S', 'W']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const hashSeed = (seed: string | number | undefined) => {
  const text = String(seed ?? 'spawn_seed')
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createRng = (seed: string | number | undefined) => {
  let state = hashSeed(seed) || 1
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const normalizeBounds = (bounds: SpawnBounds): SpawnBounds => ({
  minX: Math.min(bounds.minX, bounds.maxX),
  maxX: Math.max(bounds.minX, bounds.maxX),
  minY: Math.min(bounds.minY, bounds.maxY),
  maxY: Math.max(bounds.minY, bounds.maxY)
})

const normalizeEdges = (edges: Array<SpawnEdge | SpawnEdgeConfig>) => {
  const seen = new Set<SpawnEdge>()
  const normalized: SpawnEdgeConfig[] = []
  edges.forEach((entry) => {
    const config: SpawnEdgeConfig = typeof entry === 'string' ? { edge: entry } : entry
    if (!EDGE_ORDER.includes(config.edge) || seen.has(config.edge)) return
    seen.add(config.edge)
    normalized.push({ edge: config.edge, weight: typeof config.weight === 'number' ? Math.max(0.1, config.weight) : undefined })
  })
  return normalized
}

const resolveCount = (countPerEdge: SpawnPointCount | undefined, weight: number | undefined, rng: () => number) => {
  const raw =
    typeof countPerEdge === 'number'
      ? Math.max(1, Math.floor(countPerEdge))
      : countPerEdge
        ? Math.max(
            Math.floor(countPerEdge.min),
            Math.floor(countPerEdge.min) + Math.floor(rng() * (Math.max(countPerEdge.min, countPerEdge.max) - countPerEdge.min + 1))
          )
        : 1
  const weighted = raw * (weight ?? 1)
  return Math.max(1, Math.round(weighted))
}

const pointOnEdge = (edge: SpawnEdge, t: number, bounds: SpawnBounds, padding: number): Vec2 => {
  const clampedT = clamp(t, 0.05, 0.95)
  if (edge === 'N') {
    return {
      x: bounds.minX + (bounds.maxX - bounds.minX) * clampedT,
      y: bounds.minY - padding
    }
  }
  if (edge === 'S') {
    return {
      x: bounds.minX + (bounds.maxX - bounds.minX) * clampedT,
      y: bounds.maxY + padding
    }
  }
  if (edge === 'W') {
    return {
      x: bounds.minX - padding,
      y: bounds.minY + (bounds.maxY - bounds.minY) * clampedT
    }
  }
  return {
    x: bounds.maxX + padding,
    y: bounds.minY + (bounds.maxY - bounds.minY) * clampedT
  }
}

const forwardForEdge = (edge: SpawnEdge): Vec2 => {
  if (edge === 'N') return { x: 0, y: 1 }
  if (edge === 'S') return { x: 0, y: -1 }
  if (edge === 'W') return { x: 1, y: 0 }
  return { x: -1, y: 0 }
}

const isTooClose = (candidate: Vec2, positions: Vec2[], minDistance: number) => {
  const minDistSq = minDistance * minDistance
  return positions.some((entry) => {
    const dx = entry.x - candidate.x
    const dy = entry.y - candidate.y
    return dx * dx + dy * dy < minDistSq
  })
}

const minDistanceSquared = (candidate: Vec2, positions: Vec2[]) => {
  if (positions.length === 0) return Infinity
  let best = Infinity
  positions.forEach((entry) => {
    const dx = entry.x - candidate.x
    const dy = entry.y - candidate.y
    const distSq = dx * dx + dy * dy
    if (distSq < best) best = distSq
  })
  return best
}

export const inferSpawnEdgeFromPoint = (point: Vec2, bounds: SpawnBounds): SpawnEdge => {
  const normalized = normalizeBounds(bounds)
  const distances: Array<{ edge: SpawnEdge; distance: number }> = [
    { edge: 'N', distance: Math.abs(point.y - normalized.minY) },
    { edge: 'E', distance: Math.abs(normalized.maxX - point.x) },
    { edge: 'S', distance: Math.abs(normalized.maxY - point.y) },
    { edge: 'W', distance: Math.abs(point.x - normalized.minX) }
  ]
  distances.sort((a, b) => a.distance - b.distance)
  return distances[0]?.edge ?? 'E'
}

export const resolveSpawnTransforms = ({
  edges,
  countPerEdge,
  bounds,
  padding = DEFAULT_PADDING,
  minDistance = DEFAULT_MIN_DISTANCE,
  rngSeed
}: ResolveSpawnTransformsInput): SpawnTransform[] => {
  const normalizedBounds = normalizeBounds(bounds)
  const normalizedEdges = normalizeEdges(edges)
  if (normalizedEdges.length === 0) return []

  const rng = createRng(rngSeed)
  const transforms: SpawnTransform[] = []
  const takenPositions: Vec2[] = []

  normalizedEdges.forEach((edgeConfig) => {
    const count = resolveCount(countPerEdge, edgeConfig.weight, rng)
    for (let index = 0; index < count; index += 1) {
      const targetT = count === 1 ? 0.5 : (index + 1) / (count + 1)
      let selected = pointOnEdge(edgeConfig.edge, targetT, normalizedBounds, padding)
      const jitterSpan = count === 1 ? 0.35 : Math.min(0.25, 0.85 / (count + 1))
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const jitter = (rng() - 0.5) * jitterSpan * 2
        const candidate = pointOnEdge(edgeConfig.edge, targetT + jitter, normalizedBounds, padding)
        if (!isTooClose(candidate, takenPositions, minDistance)) {
          selected = candidate
          break
        }
      }
      if (isTooClose(selected, takenPositions, minDistance)) {
        let bestCandidate = selected
        let bestDistSq = minDistanceSquared(selected, takenPositions)
        for (let slot = 0; slot < 16; slot += 1) {
          const scanT = (slot + 0.5) / 16
          const candidate = pointOnEdge(edgeConfig.edge, scanT, normalizedBounds, padding)
          const distSq = minDistanceSquared(candidate, takenPositions)
          if (distSq > bestDistSq) {
            bestDistSq = distSq
            bestCandidate = candidate
          }
        }
        selected = bestCandidate
      }
      takenPositions.push(selected)
      transforms.push({
        position: selected,
        forward: forwardForEdge(edgeConfig.edge),
        edge: edgeConfig.edge
      })
    }
  })

  return transforms
}
