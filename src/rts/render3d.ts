import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { PAD_SIZE } from './pads'
import type { BuildingPad } from '../config/levels'
import type { RunBuilding } from '../run/types'
import type { Camera as Camera2D } from './render'
import type { EntityState, SimState, Vec2 } from './types'
import type { PickMeta } from './input/input3d'

const HIT_FLASH_DURATION = 0.14
const UNIT_SCALE = 1.6
const BASE_UNIT_HEIGHT = 2
const BASE_UNIT_RADIUS = 1
const BASE_BUILDING_HEIGHT = 10
const BASE_BUILDING_PADDING = 0.72
const LABEL_TEXTURE_SIZE = 256

type UnitGroupKey = string

interface ThinGroup {
  mesh: Mesh
  ids: string[]
  matrices: Float32Array
  colors: Float32Array
  capacity: number
  baseColor: Color3
}

interface LabelMesh {
  mesh: Mesh
  texture: DynamicTexture
  text: string
}

export interface Render3DOverlays {
  pads: BuildingPad[]
  buildings: RunBuilding[]
  hoveredPadId: string | null
  selectedPadId?: string | null
  padUnlockLevels?: Record<string, number>
  strongholdLevel?: number
}

export interface Render3DOptions {
  showLabels?: boolean
}

export interface Render3DUpdateInput {
  sim: SimState
  camera: Camera2D
  selection: string[]
  overlays: Render3DOverlays
  options?: Render3DOptions
}

export interface PickContext3D {
  scene: Scene
  resolveThinInstance: (groupKey: string, index: number) => string | null
}

export interface Renderer3D {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
  update: (input: Render3DUpdateInput) => void
  render: () => void
  resize: (width: number, height: number) => void
  dispose: () => void
  setMap: (map: SimState['combat']['map']) => void
  getPickContext: () => PickContext3D
  projectToScreen: (pos: Vec2) => { x: number; y: number } | null
}

const toWorld = (pos: Vec2) => new Vector3(pos.x, 0, pos.y)

const createMaterial = (scene: Scene, color: Color3, emissive = 0.1) => {
  const mat = new StandardMaterial('mat', scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(emissive)
  mat.specularColor = new Color3(0.15, 0.15, 0.15)
  return mat
}

const createLabel = (scene: Scene, name: string) => {
  const texture = new DynamicTexture(name, { width: LABEL_TEXTURE_SIZE, height: LABEL_TEXTURE_SIZE / 2 }, scene, true)
  texture.hasAlpha = true
  const mat = new StandardMaterial(`${name}_mat`, scene)
  mat.diffuseTexture = texture
  mat.opacityTexture = texture
  mat.emissiveColor = Color3.White()
  mat.backFaceCulling = false
  const mesh = MeshBuilder.CreatePlane(name, { width: 18, height: 9 }, scene)
  mesh.material = mat
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
  mesh.isPickable = false
  return { mesh, texture }
}

const drawLabel = (texture: DynamicTexture, text: string, color: string, fontSize: number) => {
  const size = texture.getSize()
  const ctx = texture.getContext()
  ctx.clearRect(0, 0, size.width, size.height)
  ctx.font = `${fontSize}px 'Space Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, fontSize * 0.18)
  ctx.strokeStyle = '#0f172a'
  ctx.strokeText(text, size.width / 2, size.height / 2)
  ctx.fillStyle = color
  ctx.fillText(text, size.width / 2, size.height / 2)
  texture.update()
}

const getGroupColor = (team: EntityState['team'], kind: EntityState['kind']) => {
  if (team === 'player') {
    if (kind === 'infantry') return Color3.FromHexString('#38bdf8')
    if (kind === 'archer') return Color3.FromHexString('#22d3ee')
    if (kind === 'cavalry') return Color3.FromHexString('#2dd4bf')
  }
  if (team === 'enemy') {
    if (kind === 'infantry') return Color3.FromHexString('#ef4444')
    if (kind === 'archer') return Color3.FromHexString('#f97316')
    if (kind === 'cavalry') return Color3.FromHexString('#fb7185')
  }
  return Color3.FromHexString('#94a3b8')
}

const buildLabelMap = (sim: SimState) => {
  const labelMap = new Map<string, string>()
  const grouped: Record<'infantry' | 'archer' | 'cavalry' | 'hero', EntityState[]> = {
    infantry: [],
    archer: [],
    cavalry: [],
    hero: []
  }
  sim.entities.forEach((entity) => {
    if (entity.kind === 'hq') return
    if (entity.team === 'player') {
      if (entity.kind === 'hero') grouped.hero.push(entity)
      if (entity.kind === 'infantry') grouped.infantry.push(entity)
      if (entity.kind === 'archer') grouped.archer.push(entity)
      if (entity.kind === 'cavalry') grouped.cavalry.push(entity)
    } else if (entity.tier === 'boss' || entity.tier === 'miniBoss') {
      if (entity.idLabel) labelMap.set(entity.id, entity.idLabel)
    }
  })

  ;(Object.keys(grouped) as Array<keyof typeof grouped>).forEach((key) => {
    const list = grouped[key].sort((a, b) => a.id.localeCompare(b.id))
    list.forEach((entity, index) => {
      if (!entity.idLabel) return
      const label = list.length > 1 ? `${entity.idLabel}${index + 1}` : entity.idLabel
      labelMap.set(entity.id, label)
    })
  })

  return labelMap
}

export const initRenderer3D = (canvas: HTMLCanvasElement, map: SimState['combat']['map']): Renderer3D => {
  const engine = new Engine(canvas, true, { antialias: true })
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.04, 0.07, 0.13, 1)

  const camera = new ArcRotateCamera('rts_camera', -Math.PI / 4, 0.95532, 220, new Vector3(0, 0, 0), scene)
  camera.mode = BabylonCamera.ORTHOGRAPHIC_CAMERA
  camera.inputs.clear()
  camera.minZ = 0.1
  camera.maxZ = 2000

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.75
  const dir = new DirectionalLight('dir', new Vector3(-0.4, -1, -0.2), scene)
  dir.intensity = 0.6

  const groundMaterial = createMaterial(scene, Color3.FromHexString('#0b1220'), 0.2)
  const padMaterial = createMaterial(scene, Color3.FromHexString('#1f2937'), 0.2)
  const padHoverMaterial = createMaterial(scene, Color3.FromHexString('#0ea5e9'), 0.5)
  const padSelectedMaterial = createMaterial(scene, Color3.FromHexString('#38bdf8'), 0.6)
  const padLockedMaterial = createMaterial(scene, Color3.FromHexString('#334155'), 0.1)
  const padEmptyMaterial = createMaterial(scene, Color3.FromHexString('#111827'), 0.2)
  const buildingMaterial = createMaterial(scene, Color3.FromHexString('#1f2937'), 0.2)
  const hqMaterial = createMaterial(scene, Color3.FromHexString('#2563eb'), 0.5)
  const heroMaterial = createMaterial(scene, Color3.FromHexString('#f59e0b'), 0.6)
  const bossMaterial = createMaterial(scene, Color3.FromHexString('#991b1b'), 0.4)
  const miniBossMaterial = createMaterial(scene, Color3.FromHexString('#f97316'), 0.4)
  const selectionMaterial = createMaterial(scene, Color3.FromHexString('#22c55e'), 0.8)
  const projectileMaterial = createMaterial(scene, Color3.FromHexString('#f97316'), 0.8)

  let ground: Mesh | null = null
  let obstacles: Mesh[] = []
  const padMeshes = new Map<string, Mesh>()
  const buildingMeshes = new Map<string, Mesh>()
  const unitGroups = new Map<UnitGroupKey, ThinGroup>()
  const specialMeshes = new Map<string, Mesh>()
  const labelMeshes = new Map<string, LabelMesh>()
  const damageLabels: LabelMesh[] = []
  const selectionRings: Mesh[] = []

  const projectileGroup: ThinGroup = {
    mesh: MeshBuilder.CreateSphere('projectile_base', { diameter: 2 }, scene),
    ids: [],
    matrices: new Float32Array(0),
    colors: new Float32Array(0),
    capacity: 0,
    baseColor: Color3.FromHexString('#f97316')
  }
  projectileGroup.mesh.material = projectileMaterial
  projectileGroup.mesh.isPickable = false
  projectileGroup.mesh.thinInstanceEnablePicking = false

  const ensureGround = (nextMap: SimState['combat']['map']) => {
    ground?.dispose()
    obstacles.forEach((mesh) => mesh.dispose())
    obstacles = []
    ground = MeshBuilder.CreateGround('ground', { width: nextMap.width, height: nextMap.height }, scene)
    ground.material = groundMaterial
    ground.position = new Vector3(nextMap.width / 2, 0, nextMap.height / 2)
    ground.isPickable = true
    ground.metadata = { kind: 'ground' } as PickMeta
    nextMap.obstacles.forEach((ob, index) => {
      const height = 18
      const mesh = MeshBuilder.CreateBox(`obstacle_${index}`, { width: ob.w, depth: ob.h, height }, scene)
      mesh.position = new Vector3(ob.x + ob.w / 2, height / 2, ob.y + ob.h / 2)
      mesh.material = createMaterial(scene, Color3.FromHexString('#1f2937'), 0.15)
      mesh.isPickable = false
      obstacles.push(mesh)
    })
  }

  const ensurePadMesh = (pad: BuildingPad) => {
    if (padMeshes.has(pad.id)) return padMeshes.get(pad.id)!
    const mesh = MeshBuilder.CreateBox(`pad_${pad.id}`, { width: PAD_SIZE.w, depth: PAD_SIZE.h, height: 2 }, scene)
    mesh.position = new Vector3(pad.x, 1, pad.y)
    mesh.material = padMaterial
    mesh.isPickable = true
    mesh.metadata = { kind: 'pad', padId: pad.id } as PickMeta
    padMeshes.set(pad.id, mesh)
    return mesh
  }

  const ensureBuildingMesh = (padId: string) => {
    if (buildingMeshes.has(padId)) return buildingMeshes.get(padId)!
    const mesh = MeshBuilder.CreateBox(`building_${padId}`, { size: 1 }, scene)
    mesh.material = buildingMaterial
    mesh.isPickable = true
    mesh.metadata = { kind: 'building', padId } as PickMeta
    buildingMeshes.set(padId, mesh)
    return mesh
  }

  const ensureSelectionRing = (index: number) => {
    if (selectionRings[index]) return selectionRings[index]
    const ring = MeshBuilder.CreateTorus(`selection_${index}`, { diameter: 2, thickness: 0.2 }, scene)
    ring.material = selectionMaterial
    ring.isPickable = false
    selectionRings[index] = ring
    return ring
  }

  const ensureUnitGroup = (key: UnitGroupKey, color: Color3) => {
    if (unitGroups.has(key)) return unitGroups.get(key)!
    const mesh = MeshBuilder.CreateBox(`unit_${key}`, { size: BASE_UNIT_RADIUS * 2 }, scene)
    const mat = new StandardMaterial(`unit_${key}_mat`, scene)
    mat.diffuseColor = Color3.White()
    mat.useVertexColor = true
    mat.emissiveColor = Color3.FromHexString('#0f172a').scale(0.4)
    mesh.material = mat
    mesh.isPickable = true
    mesh.thinInstanceEnablePicking = true
    mesh.metadata = { kind: 'unitGroup', groupKey: key } as PickMeta
    const group: ThinGroup = { mesh, ids: [], matrices: new Float32Array(0), colors: new Float32Array(0), capacity: 0, baseColor: color }
    unitGroups.set(key, group)
    return group
  }

  const ensureSpecialMesh = (entity: EntityState) => {
    const existing = specialMeshes.get(entity.id)
    if (existing) return existing
    let mesh: Mesh
    if (entity.kind === 'hq') {
      mesh = MeshBuilder.CreateBox(`hq_${entity.id}`, { size: 1 }, scene)
      mesh.material = hqMaterial
    } else if (entity.kind === 'hero') {
      mesh = MeshBuilder.CreateBox(`hero_${entity.id}`, { size: 1 }, scene)
      mesh.material = heroMaterial
    } else {
      mesh = MeshBuilder.CreateBox(`elite_${entity.id}`, { size: 1 }, scene)
      mesh.material = entity.tier === 'boss' ? bossMaterial : miniBossMaterial
    }
    mesh.isPickable = true
    mesh.metadata = { kind: entity.kind === 'hq' ? 'hq' : 'unit', entityId: entity.id } as PickMeta
    specialMeshes.set(entity.id, mesh)
    return mesh
  }

  const ensureLabelMesh = (id: string) => {
    if (labelMeshes.has(id)) return labelMeshes.get(id)!
    const { mesh, texture } = createLabel(scene, `label_${id}`)
    const entry = { mesh, texture, text: '' }
    labelMeshes.set(id, entry)
    return entry
  }

  const ensureDamageLabel = (index: number) => {
    if (damageLabels[index]) return damageLabels[index]
    const { mesh, texture } = createLabel(scene, `damage_${index}`)
    mesh.scaling = new Vector3(0.7, 0.7, 0.7)
    const entry = { mesh, texture, text: '' }
    damageLabels[index] = entry
    return entry
  }

  const updateThinGroup = (group: ThinGroup, entities: EntityState[], time: number) => {
    const count = entities.length
    if (count > group.capacity) {
      const nextCap = Math.max(count, group.capacity + 16)
      group.capacity = nextCap
      group.matrices = new Float32Array(nextCap * 16)
      group.colors = new Float32Array(nextCap * 4)
    }
    group.ids = entities.map((entity) => entity.id)
    entities.forEach((entity, index) => {
      const scale = new Vector3(entity.radius * UNIT_SCALE, entity.radius * 0.6 * UNIT_SCALE, entity.radius * UNIT_SCALE)
      const height = BASE_UNIT_HEIGHT * scale.y
      const pos = new Vector3(entity.pos.x, height / 2, entity.pos.y)
      const matrix = Matrix.Compose(scale, Quaternion.Identity(), pos)
      matrix.copyToArray(group.matrices, index * 16)
      const isHit = typeof entity.lastHitTime === 'number' && time - entity.lastHitTime < HIT_FLASH_DURATION
      const color = isHit ? Color3.White() : group.baseColor
      group.colors[index * 4 + 0] = color.r
      group.colors[index * 4 + 1] = color.g
      group.colors[index * 4 + 2] = color.b
      group.colors[index * 4 + 3] = 1
    })
    group.mesh.thinInstanceSetBuffer('matrix', group.matrices, 16, false)
    group.mesh.thinInstanceSetBuffer('color', group.colors, 4, false)
    group.mesh.thinInstanceCount = count
    group.mesh.thinInstanceRefreshBoundingInfo(true)
  }

  const updateProjectiles = (projectiles: SimState['projectiles']) => {
    const count = projectiles.length
    if (count > projectileGroup.capacity) {
      const nextCap = Math.max(count, projectileGroup.capacity + 16)
      projectileGroup.capacity = nextCap
      projectileGroup.matrices = new Float32Array(nextCap * 16)
      projectileGroup.colors = new Float32Array(nextCap * 4)
    }
    projectileGroup.ids = projectiles.map((proj) => proj.id)
    projectiles.forEach((proj, index) => {
      const scale = new Vector3(2, 2, 2)
      const pos = new Vector3(proj.pos.x, 4, proj.pos.y)
      const matrix = Matrix.Compose(scale, Quaternion.Identity(), pos)
      matrix.copyToArray(projectileGroup.matrices, index * 16)
      projectileGroup.colors[index * 4 + 0] = projectileGroup.baseColor.r
      projectileGroup.colors[index * 4 + 1] = projectileGroup.baseColor.g
      projectileGroup.colors[index * 4 + 2] = projectileGroup.baseColor.b
      projectileGroup.colors[index * 4 + 3] = 1
    })
    projectileGroup.mesh.thinInstanceSetBuffer('matrix', projectileGroup.matrices, 16, false)
    projectileGroup.mesh.thinInstanceSetBuffer('color', projectileGroup.colors, 4, false)
    projectileGroup.mesh.thinInstanceCount = count
  }

  const updateLabels = (sim: SimState, showLabels: boolean) => {
    if (!showLabels) {
      labelMeshes.forEach((entry) => entry.mesh.setEnabled(false))
      return
    }
    const labelMap = buildLabelMap(sim)
    const activeIds = new Set<string>()
    labelMap.forEach((label, id) => {
      const entity = sim.entities.find((entry) => entry.id === id)
      if (!entity) return
      const entry = ensureLabelMesh(id)
      activeIds.add(id)
      if (entry.text !== label) {
        drawLabel(entry.texture, label, '#f8fafc', 64)
        entry.text = label
      }
      entry.mesh.position = new Vector3(entity.pos.x, entity.radius + 12, entity.pos.y)
      entry.mesh.setEnabled(true)
    })
    labelMeshes.forEach((entry, id) => {
      if (!activeIds.has(id)) entry.mesh.setEnabled(false)
    })
  }

  const updateDamageNumbers = (sim: SimState) => {
    const numbers = sim.damageNumbers
    numbers.forEach((entry, index) => {
      const label = ensureDamageLabel(index)
      drawLabel(label.texture, entry.text, entry.color, 60)
      label.text = entry.text
      label.mesh.position = new Vector3(entry.x, 16 + (entry.life - entry.ttl) * 0.4 * Math.abs(entry.vy), entry.y)
      label.mesh.setEnabled(true)
    })
    for (let i = numbers.length; i < damageLabels.length; i += 1) {
      damageLabels[i].mesh.setEnabled(false)
    }
  }

  const updateSelection = (sim: SimState, selection: string[]) => {
    selection.forEach((id, index) => {
      const entity = sim.entities.find((entry) => entry.id === id)
      const ring = ensureSelectionRing(index)
      if (!entity || entity.kind === 'hq') {
        ring.setEnabled(false)
        return
      }
      const diameter = (entity.radius + 6) * 2
      ring.scaling = new Vector3(diameter / 2, 1, diameter / 2)
      ring.position = new Vector3(entity.pos.x, 0.2, entity.pos.y)
      ring.setEnabled(true)
    })
    for (let i = selection.length; i < selectionRings.length; i += 1) {
      selectionRings[i].setEnabled(false)
    }
  }

  const updateSpecialMeshes = (sim: SimState) => {
    const activeIds = new Set<string>()
    sim.entities.forEach((entity) => {
      if (entity.kind !== 'hero' && entity.kind !== 'elite' && entity.kind !== 'hq') return
      const mesh = ensureSpecialMesh(entity)
      activeIds.add(entity.id)
      if (entity.kind === 'hq') {
        const height = BASE_BUILDING_HEIGHT + Math.max(0, entity.radius)
        mesh.scaling = new Vector3(PAD_SIZE.w * 0.45, height, PAD_SIZE.h * 0.45)
        mesh.position = new Vector3(entity.pos.x, height / 2, entity.pos.y)
      } else {
        const scale = new Vector3(entity.radius * UNIT_SCALE, entity.radius * UNIT_SCALE, entity.radius * UNIT_SCALE)
        const height = BASE_UNIT_HEIGHT * scale.y
        mesh.scaling = scale
        mesh.position = new Vector3(entity.pos.x, height / 2, entity.pos.y)
      }
      const isHit = typeof entity.lastHitTime === 'number' && sim.time - entity.lastHitTime < HIT_FLASH_DURATION
      const mat = mesh.material as StandardMaterial | null
      if (mat) {
        mat.emissiveColor = isHit ? Color3.White() : (mat.diffuseColor ?? Color3.White()).scale(0.2)
      }
      mesh.setEnabled(true)
    })
    specialMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        mesh.dispose()
        specialMeshes.delete(id)
      }
    })
  }

  const updateBuildings = (pads: BuildingPad[], buildings: RunBuilding[]) => {
    const buildingByPad = new Map(buildings.map((entry) => [entry.padId, entry]))
    const activeBuildingPads = new Set(buildings.map((entry) => entry.padId))
    pads.forEach((pad) => {
      const building = buildingByPad.get(pad.id)
      if (building) {
        const mesh = ensureBuildingMesh(pad.id)
        const height = BASE_BUILDING_HEIGHT + building.level * 6
        mesh.scaling = new Vector3(PAD_SIZE.w * BASE_BUILDING_PADDING, height, PAD_SIZE.h * BASE_BUILDING_PADDING)
        mesh.position = new Vector3(pad.x, height / 2, pad.y)
        mesh.setEnabled(true)
      } else {
        const mesh = buildingMeshes.get(pad.id)
        if (mesh) mesh.setEnabled(false)
      }
    })
    buildingMeshes.forEach((mesh, padId) => {
      if (!activeBuildingPads.has(padId)) {
        mesh.setEnabled(false)
      }
    })
  }

  const updatePads = (overlays: Render3DOverlays) => {
    const { pads, hoveredPadId, selectedPadId, padUnlockLevels, strongholdLevel } = overlays
    const buildingByPad = new Map(overlays.buildings.map((building) => [building.padId, building]))
    const padIds = new Set(pads.map((pad) => pad.id))
    pads.forEach((pad) => {
      const mesh = ensurePadMesh(pad)
      const building = buildingByPad.get(pad.id)
      const unlockLevel = padUnlockLevels?.[pad.id] ?? 1
      const locked = typeof strongholdLevel === 'number' ? strongholdLevel < unlockLevel : false
      const hovered = hoveredPadId === pad.id
      const selected = selectedPadId === pad.id
      if (selected) {
        mesh.material = padSelectedMaterial
      } else if (hovered) {
        mesh.material = padHoverMaterial
      } else if (locked) {
        mesh.material = padLockedMaterial
      } else if (building) {
        mesh.material = padMaterial
      } else {
        mesh.material = padEmptyMaterial
      }
      mesh.setEnabled(true)
    })
    padMeshes.forEach((mesh, padId) => {
      if (!padIds.has(padId)) {
        mesh.dispose()
        padMeshes.delete(padId)
      }
    })
  }

  const updateCamera = (cam: Camera2D) => {
    const viewW = engine.getRenderWidth() / cam.zoom
    const viewH = engine.getRenderHeight() / cam.zoom
    const centerX = cam.x + viewW / 2
    const centerZ = cam.y + viewH / 2
    camera.alpha = -Math.PI / 4
    camera.beta = 0.95532
    camera.setTarget(new Vector3(centerX, 0, centerZ))
    camera.orthoLeft = -viewW / 2
    camera.orthoRight = viewW / 2
    camera.orthoTop = viewH / 2
    camera.orthoBottom = -viewH / 2
  }

  const update = (input: Render3DUpdateInput) => {
    updateCamera(input.camera)
    updatePads(input.overlays)
    updateBuildings(input.overlays.pads, input.overlays.buildings)
    updateSpecialMeshes(input.sim)
    const unitBuckets = new Map<UnitGroupKey, EntityState[]>()
    input.sim.entities.forEach((entity) => {
      if (entity.kind === 'hq' || entity.kind === 'hero' || entity.kind === 'elite') return
      const key = `${entity.team}_${entity.kind}`
      if (!unitBuckets.has(key)) unitBuckets.set(key, [])
      unitBuckets.get(key)!.push(entity)
    })
    unitBuckets.forEach((entities, key) => {
      const [team, kind] = key.split('_') as [EntityState['team'], EntityState['kind']]
      const group = ensureUnitGroup(key, getGroupColor(team, kind))
      updateThinGroup(group, entities, input.sim.time)
    })
    unitGroups.forEach((group, key) => {
      if (!unitBuckets.has(key)) {
        group.mesh.thinInstanceCount = 0
        group.ids = []
      }
    })
    updateProjectiles(input.sim.projectiles)
    updateSelection(input.sim, input.selection)
    updateLabels(input.sim, Boolean(input.options?.showLabels))
    updateDamageNumbers(input.sim)
  }

  const render = () => scene.render()

  const resize = (width: number, height: number) => {
    engine.resize(true)
    if (width > 0 && height > 0) {
      camera.orthoLeft = -width / 2
      camera.orthoRight = width / 2
      camera.orthoTop = height / 2
      camera.orthoBottom = -height / 2
    }
  }

  const dispose = () => {
    scene.dispose()
    engine.dispose()
  }

  const setMap = (nextMap: SimState['combat']['map']) => {
    ensureGround(nextMap)
    const radius = Math.max(nextMap.width, nextMap.height) * 1.1
    camera.radius = Math.max(180, radius)
  }

  const getPickContext = (): PickContext3D => ({
    scene,
    resolveThinInstance: (groupKey, index) => unitGroups.get(groupKey)?.ids[index] ?? null
  })

  const projectToScreen = (pos: Vec2) => {
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    if (!width || !height) return null
    const viewport = camera.viewport.toGlobal(width, height)
    const projected = Vector3.Project(new Vector3(pos.x, 0, pos.y), Matrix.Identity(), camera.getTransformationMatrix(), viewport)
    return { x: projected.x, y: projected.y }
  }

  ensureGround(map)
  setMap(map)

  return {
    engine,
    scene,
    camera,
    update,
    render,
    resize,
    dispose,
    setMap,
    getPickContext,
    projectToScreen
  }
}
