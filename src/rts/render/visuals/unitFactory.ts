import { Scene } from '@babylonjs/core/scene'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

export interface SpecialUnitVisual {
  root: TransformNode
  primary: Mesh
  materials: StandardMaterial[]
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

const createMaterial = (scene: Scene, name: string, color: Color3, emissive = 0.2) => {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(emissive)
  mat.specularColor = new Color3(0.12, 0.12, 0.12)
  return mat
}

export const createUnitFactory = (scene: Scene) => {
  const materials = {
    hq: createMaterial(scene, 'u_hq', Color3.FromHexString('#2563eb'), 0.35),
    hero: createMaterial(scene, 'u_hero', Color3.FromHexString('#f59e0b'), 0.4),
    boss: createMaterial(scene, 'u_boss', Color3.FromHexString('#991b1b'), 0.35),
    miniBoss: createMaterial(scene, 'u_miniboss', Color3.FromHexString('#f97316'), 0.35),
    accent: createMaterial(scene, 'u_accent', Color3.FromHexString('#e2e8f0'), 0.2)
  }

  const createHq = (id: string): SpecialUnitVisual => {
    const root = new TransformNode(`hq_root_${id}`, scene)
    const base = MeshBuilder.CreateBox(`hq_base_${id}`, { size: 1 }, scene)
    base.material = materials.hq
    base.parent = root
    base.isPickable = false
    const tower = MeshBuilder.CreateCylinder(`hq_tower_${id}`, { diameter: 0.4, height: 1.4, tessellation: 12 }, scene)
    tower.material = materials.accent
    tower.position = new Vector3(0.3, 0.7, 0.2)
    tower.isPickable = false
    tower.parent = root
    const banner = MeshBuilder.CreatePlane(`hq_banner_${id}`, { width: 0.4, height: 0.25 }, scene)
    banner.material = materials.accent
    banner.position = new Vector3(0.5, 0.95, 0.2)
    banner.isPickable = false
    banner.parent = root
    return {
      root,
      primary: base,
      materials: [materials.hq, materials.accent],
      setEnabled: (enabled) => root.setEnabled(enabled),
      dispose: () => root.dispose()
    }
  }

  const createHero = (id: string): SpecialUnitVisual => {
    const root = new TransformNode(`hero_root_${id}`, scene)
    const body = MeshBuilder.CreateCylinder(`hero_body_${id}`, { diameter: 0.8, height: 1.2, tessellation: 10 }, scene)
    body.material = materials.hero
    body.position.y = 0.6
    body.parent = root
    body.isPickable = false
    const ring = MeshBuilder.CreateTorus(`hero_ring_${id}`, { diameter: 1, thickness: 0.08, tessellation: 24 }, scene)
    ring.material = materials.accent
    ring.rotation.x = Math.PI / 2
    ring.position = new Vector3(0, 1.05, 0)
    ring.isPickable = false
    ring.parent = root
    return {
      root,
      primary: body,
      materials: [materials.hero, materials.accent],
      setEnabled: (enabled) => root.setEnabled(enabled),
      dispose: () => root.dispose()
    }
  }

  const createElite = (id: string, tier: 'boss' | 'miniBoss'): SpecialUnitVisual => {
    const root = new TransformNode(`elite_root_${id}`, scene)
    const mat = tier === 'boss' ? materials.boss : materials.miniBoss
    const body = MeshBuilder.CreateBox(`elite_body_${id}`, { size: 1 }, scene)
    body.material = mat
    body.position.y = 0.5
    body.parent = root
    body.isPickable = false
    const spike = MeshBuilder.CreateCylinder(`elite_spike_${id}`, { diameter: 0.2, height: 0.6, tessellation: 6 }, scene)
    spike.material = materials.accent
    spike.position = new Vector3(0.4, 1.1, 0)
    spike.isPickable = false
    spike.parent = root
    return {
      root,
      primary: body,
      materials: [mat, materials.accent],
      setEnabled: (enabled) => root.setEnabled(enabled),
      dispose: () => root.dispose()
    }
  }

  return { materials, createHq, createHero, createElite }
}
