import '@babylonjs/core/Culling/ray'
import type { Scene } from '@babylonjs/core/scene'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
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

export const pickAt = (ctx: PickContext, x: number, y: number): PickInfo => {
  const hit = ctx.scene.pick(x, y, (mesh) => {
    if (!mesh.isPickable) return false
    const meta = getMeta(mesh)
    return meta?.kind !== 'ground'
  })
  if (!hit?.hit || !hit.pickedMesh) {
    const groundHit = ctx.scene.pick(x, y, (mesh) => {
      if (!mesh.isPickable) return false
      const meta = getMeta(mesh)
      return meta?.kind === 'ground'
    })
    if (groundHit?.hit && groundHit.pickedPoint) {
      return { kind: 'ground', point: { x: groundHit.pickedPoint.x, y: groundHit.pickedPoint.z } }
    }
    return { kind: 'none' }
  }
  if (!hit?.hit || !hit.pickedMesh) return { kind: 'none' }
  const meta = getMeta(hit.pickedMesh)
  if (!meta) return { kind: 'none' }
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
  if (meta.kind === 'ground' && hit.pickedPoint) {
    return { kind: 'ground', point: { x: hit.pickedPoint.x, y: hit.pickedPoint.z } }
  }
  return { kind: 'none' }
}

export const pickPadAt = (ctx: PickContext, x: number, y: number): string | null => {
  const hit = ctx.scene.pick(x, y, (mesh) => {
    const meta = getMeta(mesh)
    return meta?.kind === 'pad' || meta?.kind === 'building'
  })
  if (!hit?.hit || !hit.pickedMesh) return null
  const meta = getMeta(hit.pickedMesh)
  if (meta?.kind === 'pad' || meta?.kind === 'building') return meta.padId
  return null
}

export const pickUnitAt = (ctx: PickContext, x: number, y: number): PickInfo => {
  const hit = ctx.scene.pick(x, y, (mesh) => {
    const meta = getMeta(mesh)
    return meta?.kind === 'unit' || meta?.kind === 'unitGroup' || meta?.kind === 'hq'
  })
  if (!hit?.hit || !hit.pickedMesh) return { kind: 'none' }
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
