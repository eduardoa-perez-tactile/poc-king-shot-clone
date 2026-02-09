import '@babylonjs/core/Culling/ray'
import type { Scene } from '@babylonjs/core/scene'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo'
import type { Vec2 } from '../types'

export type PickMeta =
  | { kind: 'pad'; padId: string }
  | { kind: 'building'; padId: string }
  | { kind: 'unit'; entityId: string }
  | { kind: 'unitGroup'; groupKey: string }
  | { kind: 'hq' }
  | { kind: 'ground' }

export type PickInfo =
  | { kind: 'none' }
  | { kind: 'pad'; padId: string }
  | { kind: 'unit'; entityId: string }
  | { kind: 'hq' }
  | { kind: 'ground'; point: Vec2 }

export interface PickContext {
  scene: Scene
  resolveThinInstance: (groupKey: string, index: number) => string | null
}

const getMeta = (mesh?: AbstractMesh | null) => (mesh?.metadata ?? null) as PickMeta | null

const getHits = (ctx: PickContext, x: number, y: number): PickingInfo[] => ctx.scene.multiPick(x, y) ?? []

const resolveHitUnit = (ctx: PickContext, hit: PickingInfo): PickInfo => {
  const meta = getMeta(hit.pickedMesh)
  if (!meta) return { kind: 'none' }
  if (meta.kind === 'hq') return { kind: 'hq' }
  if (meta.kind === 'unit') return { kind: 'unit', entityId: meta.entityId }
  if (meta.kind === 'unitGroup' && typeof hit.thinInstanceIndex === 'number') {
    const resolved = ctx.resolveThinInstance(meta.groupKey, hit.thinInstanceIndex)
    if (resolved) return { kind: 'unit', entityId: resolved }
  }
  return { kind: 'none' }
}

export const pickAt = (ctx: PickContext, x: number, y: number): PickInfo => {
  const hits = getHits(ctx, x, y)
  for (const hit of hits) {
    if (!hit.pickedMesh || !hit.hit) continue
    const meta = getMeta(hit.pickedMesh)
    if (!meta) continue
    if (meta.kind === 'ground') continue
    if (meta.kind === 'pad' || meta.kind === 'building') {
      return { kind: 'pad', padId: meta.padId }
    }
    if (meta.kind === 'hq') {
      return { kind: 'hq' }
    }
    if (meta.kind === 'unit') {
      return { kind: 'unit', entityId: meta.entityId }
    }
    if (meta.kind === 'unitGroup' && typeof hit.thinInstanceIndex === 'number') {
      const resolved = ctx.resolveThinInstance(meta.groupKey, hit.thinInstanceIndex)
      if (resolved) return { kind: 'unit', entityId: resolved }
    }
  }
  for (const hit of hits) {
    if (!hit.pickedMesh || !hit.hit || !hit.pickedPoint) continue
    const meta = getMeta(hit.pickedMesh)
    if (meta?.kind === 'ground') {
      return { kind: 'ground', point: { x: hit.pickedPoint.x, y: hit.pickedPoint.z } }
    }
  }
  return { kind: 'none' }
}

export const pickPadAt = (ctx: PickContext, x: number, y: number): string | null => {
  const hits = getHits(ctx, x, y)
  for (const hit of hits) {
    if (!hit.pickedMesh || !hit.hit) continue
    const meta = getMeta(hit.pickedMesh)
    if (meta?.kind === 'pad' || meta?.kind === 'building') return meta.padId
  }
  return null
}

export const pickUnitAt = (ctx: PickContext, x: number, y: number): PickInfo => {
  const hits = getHits(ctx, x, y)
  for (const hit of hits) {
    if (!hit.pickedMesh || !hit.hit) continue
    const resolved = resolveHitUnit(ctx, hit)
    if (resolved.kind !== 'none') return resolved
  }
  return { kind: 'none' }
}
