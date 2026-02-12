import { Material } from '@babylonjs/core/Materials/material'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Scene } from '@babylonjs/core/scene'
import { BuildingId, BUILDING_DEFS } from '../../../config/buildings'
import { EntityState, Rect } from '../../types'
import { LabelCache } from './LabelCache'
import { MaterialRegistry } from './MaterialRegistry'

interface Size3D {
  width: number
  depth: number
  height: number
}

interface UnitStyle {
  key: string
  mesh: Size3D
  color: string
  label: string
}

export interface BuildingPrimitiveVisual {
  root: TransformNode
  mesh: InstancedMesh
  label: Mesh
  height: number
  setLevel: (level: number) => void
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

export interface UnitPrimitiveVisual {
  mesh: InstancedMesh
  label: Mesh
  height: number
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

const BUILDING_CATEGORIES: Record<BuildingId, 'economy' | 'military' | 'utility' | 'hero'> = {
  gold_mine: 'economy',
  house: 'utility',
  barracks: 'military',
  range: 'military',
  stable: 'utility',
  watchtower: 'military',
  wall: 'utility',
  blacksmith: 'utility',
  hero_recruiter: 'hero'
}

const BUILDING_COLORS: Record<BuildingId, string> = {
  gold_mine: '#a16207',
  house: '#475569',
  barracks: '#2563eb',
  range: '#0ea5e9',
  stable: '#0d9488',
  watchtower: '#1d4ed8',
  wall: '#334155',
  blacksmith: '#6b7280',
  hero_recruiter: '#f59e0b'
}

const toLabelToken = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .toUpperCase()

const getBuildingHeight = (buildingId: BuildingId, level: number) => {
  const category = BUILDING_CATEGORIES[buildingId]
  const base = category === 'hero' ? 20 : category === 'military' ? 17 : category === 'economy' ? 15 : 14
  const growth = category === 'hero' ? 2.2 : category === 'military' ? 1.8 : 1.4
  return base + Math.max(0, level - 1) * growth
}

const getBuildingFootprint = (buildingId: BuildingId, padSize: { w: number; h: number }, level: number): Size3D => {
  const wall = buildingId === 'wall'
  const width = wall ? padSize.w * 0.96 : padSize.w * 0.78
  const depth = wall ? padSize.h * 0.44 : padSize.h * 0.78
  return {
    width,
    depth,
    height: getBuildingHeight(buildingId, level)
  }
}

const getUnitStyle = (entity: EntityState): UnitStyle => {
  const baseFootprint = Math.max(10, entity.radius * 1.6)
  const baseHeight = Math.max(8, entity.radius)

  if (entity.kind === 'hq') {
    return {
      key: 'hq',
      mesh: { width: baseFootprint * 2, depth: baseFootprint * 1.4, height: Math.max(24, baseHeight * 1.8) },
      color: '#1d4ed8',
      label: 'STRONGHOLD'
    }
  }

  if (entity.tier === 'boss') {
    return {
      key: 'boss',
      mesh: { width: baseFootprint * 2.4, depth: baseFootprint * 2.4, height: baseHeight * 3.0 },
      color: '#111827',
      label: 'BOSS'
    }
  }

  if (entity.tier === 'miniBoss') {
    return {
      key: 'miniboss',
      mesh: { width: baseFootprint * 1.6, depth: baseFootprint * 1.6, height: baseHeight * 2.2 },
      color: '#7c3aed',
      label: 'MINIBOSS'
    }
  }

  if (entity.kind === 'hero') {
    const heroLabel = entity.heroId ? toLabelToken(entity.heroId) : 'HERO'
    return {
      key: `hero:${heroLabel}`,
      mesh: { width: baseFootprint * 1.2, depth: baseFootprint * 1.2, height: baseHeight * 1.8 },
      color: '#facc15',
      label: heroLabel
    }
  }

  if (entity.kind === 'cavalry') {
    return {
      key: `${entity.team}:cavalry`,
      mesh: { width: baseFootprint * 1.4, depth: baseFootprint * 1.2, height: baseHeight * 1.2 },
      color: entity.team === 'player' ? '#14b8a6' : '#be123c',
      label: 'CAVALRY'
    }
  }

  if (entity.kind === 'archer') {
    return {
      key: `${entity.team}:archer`,
      mesh: { width: baseFootprint, depth: baseFootprint, height: baseHeight },
      color: entity.team === 'player' ? '#22d3ee' : '#f97316',
      label: 'ARCHER'
    }
  }

  if (entity.kind === 'infantry') {
    return {
      key: `${entity.team}:infantry`,
      mesh: { width: baseFootprint, depth: baseFootprint, height: baseHeight },
      color: entity.team === 'player' ? '#3b82f6' : '#ef4444',
      label: 'SWORD'
    }
  }

  return {
    key: `${entity.team}:default`,
    mesh: { width: baseFootprint, depth: baseFootprint, height: baseHeight },
    color: entity.team === 'player' ? '#60a5fa' : '#f87171',
    label: toLabelToken(entity.kind)
  }
}

export class PrimitiveVisualFactory {
  private readonly materials: MaterialRegistry

  private readonly labels: LabelCache

  private readonly boxBases = new Map<string, Mesh>()

  private readonly labelBases = new Map<string, Mesh>()

  constructor(private readonly scene: Scene) {
    this.materials = new MaterialRegistry(scene)
    this.labels = new LabelCache(scene)
  }

  private getOrCreateBoxBase(key: string, size: Size3D, materialKey: string, color: string, alpha = 1) {
    const existing = this.boxBases.get(key)
    if (existing) return existing

    const material = this.materials.getOrCreateMaterial(materialKey, {
      color,
      emissive: 0.22,
      alpha,
      transparencyMode: alpha < 1 ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE,
      backFaceCulling: true
    })

    const mesh = MeshBuilder.CreateBox(`primitive_box_${key}`, size, this.scene)
    mesh.material = material
    mesh.isPickable = false
    mesh.setEnabled(false)
    mesh.renderingGroupId = 0
    this.boxBases.set(key, mesh)
    return mesh
  }

  createLabelPlane(
    key: string,
    lines: string[],
    options?: {
      planeWidth?: number
      planeHeight?: number
      fontSize?: number
      lineHeight?: number
      backgroundColor?: string
      instanceName?: string
    }
  ) {
    const planeWidth = options?.planeWidth ?? 64
    const planeHeight = options?.planeHeight ?? 24
    const baseKey = `${planeWidth}x${planeHeight}`

    let base = this.labelBases.get(baseKey)
    if (!base) {
      base = MeshBuilder.CreatePlane(`primitive_label_base_${baseKey}`, { width: planeWidth, height: planeHeight }, this.scene)
      base.isPickable = false
      base.setEnabled(false)
      base.renderingGroupId = 1
      this.labelBases.set(baseKey, base)
    }

    const label = base.clone(`primitive_label_${options?.instanceName ?? key}`)
    if (!label) throw new Error(`Failed to clone primitive label for key ${key}`)
    label.billboardMode = Mesh.BILLBOARDMODE_ALL
    label.isPickable = false
    label.renderingGroupId = 1
    label.material = this.labels.getOrCreateLabelMaterial(key, lines, {
      fontSize: options?.fontSize,
      lineHeight: options?.lineHeight,
      backgroundColor: options?.backgroundColor
    })
    label.setEnabled(true)
    return label
  }

  createBuildingPrimitive(buildingId: BuildingId, padSize: { w: number; h: number }, level: number, key: string): BuildingPrimitiveVisual {
    const size = getBuildingFootprint(buildingId, padSize, level)
    const base = this.getOrCreateBoxBase(
      `building:${buildingId}:${size.width.toFixed(2)}:${size.depth.toFixed(2)}:${size.height.toFixed(2)}`,
      size,
      `building:${buildingId}`,
      BUILDING_COLORS[buildingId],
      0.75
    )
    const instance = base.createInstance(`building_instance_${key}`)
    instance.position = new Vector3(0, size.height / 2, 0)
    instance.isPickable = true
    instance.renderingGroupId = 0

    const root = new TransformNode(`building_root_${key}`, this.scene)
    instance.parent = root

    const buildingName = toLabelToken(BUILDING_DEFS[buildingId].name)
    const createLevelMaterialKey = (nextLevel: number) => `building:${buildingId}:lv${Math.max(1, nextLevel)}`

    const label = this.createLabelPlane(createLevelMaterialKey(level), [buildingName, `Lv ${Math.max(1, level)}`], {
      planeWidth: Math.max(72, size.width * 1.6),
      planeHeight: 24,
      fontSize: 112,
      lineHeight: 126,
      backgroundColor: 'rgba(15, 23, 42, 0.48)',
      instanceName: `building_${key}`
    })
    label.position = new Vector3(0, size.height + 16, 0)
    label.parent = root

    const setLevel = (nextLevel: number) => {
      const clampedLevel = Math.max(1, nextLevel)
      const labelKey = createLevelMaterialKey(clampedLevel)
      label.material = this.labels.getOrCreateLabelMaterial(labelKey, [buildingName, `Lv ${clampedLevel}`], {
        fontSize: 112,
        lineHeight: 126,
        backgroundColor: 'rgba(15, 23, 42, 0.48)'
      })
    }

    setLevel(level)

    return {
      root,
      mesh: instance,
      label,
      height: size.height,
      setLevel,
      setEnabled: (enabled) => root.setEnabled(enabled),
      dispose: () => root.dispose()
    }
  }

  createUnitPrimitive(entity: EntityState): UnitPrimitiveVisual {
    const style = getUnitStyle(entity)
    const size = style.mesh
    const base = this.getOrCreateBoxBase(
      `unit:${style.key}:${size.width.toFixed(2)}:${size.depth.toFixed(2)}:${size.height.toFixed(2)}`,
      size,
      `unit:${style.key}`,
      style.color
    )
    const instance = base.createInstance(`unit_primitive_${entity.id}`)
    instance.position = new Vector3(0, size.height / 2, 0)
    instance.isPickable = true
    instance.renderingGroupId = 0

    const label = this.createLabelPlane(`unit:${style.label}`, [style.label], {
      planeWidth: Math.max(54, size.width * 1.45),
      planeHeight: 18,
      fontSize: 96,
      lineHeight: 108,
      backgroundColor: 'rgba(2, 6, 23, 0.45)',
      instanceName: `unit_${entity.id}`
    })
    label.position = new Vector3(0, size.height + 14, 0)
    label.parent = instance

    return {
      mesh: instance,
      label,
      height: size.height,
      setEnabled: (enabled) => {
        instance.setEnabled(enabled)
        label.setEnabled(enabled)
      },
      dispose: () => {
        label.dispose()
        instance.dispose()
      }
    }
  }

  createObstaclePrimitive(obstacle: Rect, key: string): AbstractMesh {
    const height = 18
    const size: Size3D = { width: obstacle.w, depth: obstacle.h, height }
    const base = this.getOrCreateBoxBase(
      `obstacle:${obstacle.w.toFixed(1)}:${obstacle.h.toFixed(1)}:${height}`,
      size,
      'obstacle',
      '#1f2937',
      0.88
    )
    const instance = base.createInstance(`obstacle_${key}`)
    instance.position = new Vector3(obstacle.x + obstacle.w / 2, height / 2, obstacle.y + obstacle.h / 2)
    instance.isPickable = false
    instance.renderingGroupId = 0
    return instance
  }

  dispose() {
    this.boxBases.forEach((mesh) => mesh.dispose())
    this.labelBases.forEach((mesh) => mesh.dispose())
    this.boxBases.clear()
    this.labelBases.clear()
    this.labels.dispose()
    this.materials.dispose()
  }
}
