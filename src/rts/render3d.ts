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
import { BUILDING_DEFS } from '../config/buildings'
import type { BuildingPad } from '../config/levels'
import type { RunBuilding } from '../run/types'
import type { Camera as Camera2D } from './render'
import type { EntityState, NextBattlePreview, SimState, Vec2 } from './types'
import type { PickMeta } from './input/input3d'
import { createBuildingFactory, type BuildingVisualInstance } from './render/visuals/buildingFactory'
import { createUnitFactory, type SpecialUnitVisual } from './render/visuals/unitFactory'
import { VfxManager, type HeroVfxType } from './render/vfx/VfxManager'

const HIT_FLASH_DURATION = 0.14
const UNIT_SCALE_PLAYER = 0.82
const UNIT_SCALE_ENEMY = 0.78
const UNIT_SCALE_HERO = 1.25
const UNIT_SCALE_ELITE = 1.2
const BASE_UNIT_HEIGHT = 2
const BASE_UNIT_RADIUS = 1
const BASE_BUILDING_HEIGHT = 10
const LABEL_TEXTURE_SIZE = 384
const HEALTH_BAR_HEIGHT = 1.2
const HEALTH_BAR_DEPTH = 2.2
const DAMAGE_LABEL_FONT = 96
const DAMAGE_LABEL_SCALE = 1.3
const PROJECTILE_SCALE = 3
const BUILDING_LABEL_FONT = 72
const BUILDING_LABEL_SCALE = 1.9
const UNIT_LABEL_FONT = 84
const UNIT_LABEL_SCALE = 1.4
const INVASION_MARKER_HEIGHT = 18
const INVASION_MARKER_RADIUS = 4.5
const DEBUG_SHOW_SPAWN_POINTS =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.localStorage.getItem('rts_debug_spawn_points') === '1'

type UnitGroupKey = string

interface ThinGroup {
  mesh: Mesh
  ids: string[]
  matrices: Float32Array
  colors: Float32Array
  capacity: number
  baseColor: Color3
}

interface BarGroup {
  mesh: Mesh
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
  hoveredHq?: boolean
  nextBattlePreview?: NextBattlePreview
}

export interface Render3DOptions {
  showLabels?: boolean
}

export interface Render3DUpdateInput {
  sim: SimState
  camera: Camera2D
  phase: 'build' | 'combat'
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
  getViewPolygon: () => Vec2[] | null
}

const toWorld = (pos: Vec2) => new Vector3(pos.x, 0, pos.y)

const createMaterial = (scene: Scene, color: Color3, emissive = 0.1) => {
  const mat = new StandardMaterial('mat', scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(emissive)
  mat.specularColor = new Color3(0.15, 0.15, 0.15)
  return mat
}

const createGroundGridTexture = (scene: Scene) => {
  const texture = new DynamicTexture('ground_grid', { width: 512, height: 512 }, scene, false)
  const ctx = texture.getContext()
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, 512, 512)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
  ctx.lineWidth = 1
  const step = 64
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }
  texture.update()
  return texture
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

const getHeroVfxType = (entity?: EntityState): HeroVfxType => {
  if (!entity || entity.kind !== 'hero') return 'unknown'
  if (entity.heroId === 'mage' || entity.heroId === 'golem' || entity.heroId === 'dragon') return entity.heroId
  return 'vanguard'
}

const findClosestEntity = (pos: Vec2, entities: EntityState[], maxDist = 80) => {
  let closest: EntityState | undefined
  let best = maxDist
  entities.forEach((entity) => {
    const dx = entity.pos.x - pos.x
    const dy = entity.pos.y - pos.y
    const dist = Math.hypot(dx, dy)
    if (dist <= best) {
      best = dist
      closest = entity
    }
  })
  return closest
}

const findClosestHero = (pos: Vec2, entities: EntityState[], maxDist = 120) => {
  let closest: EntityState | undefined
  let best = maxDist
  entities.forEach((entity) => {
    if (entity.kind !== 'hero') return
    const dx = entity.pos.x - pos.x
    const dy = entity.pos.y - pos.y
    const dist = Math.hypot(dx, dy)
    if (dist <= best) {
      best = dist
      closest = entity
    }
  })
  return closest
}

const buildEffectKey = (effect: SimState['effects'][number]) =>
  `${effect.kind}_${effect.bornAt.toFixed(2)}_${effect.pos.x.toFixed(1)}_${effect.pos.y.toFixed(1)}_${effect.radius}`

export const initRenderer3D = (canvas: HTMLCanvasElement, map: SimState['combat']['map']): Renderer3D => {
  const engine = new Engine(canvas, true, { antialias: true }, true)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.04, 0.07, 0.13, 1)

  const camera = new ArcRotateCamera('rts_camera', -Math.PI / 4, 0.95532, 220, new Vector3(0, 0, 0), scene)
  scene.activeCamera = camera
  scene.activeCameras = null
  scene.cameraToUseForPointers = camera
  scene.autoClear = true
  scene.autoClearDepthAndStencil = true
  camera.mode = BabylonCamera.ORTHOGRAPHIC_CAMERA
  camera.setCameraRigMode(BabylonCamera.RIG_MODE_NONE)
  camera.inputs.clear()
  camera.minZ = 1
  camera.maxZ = 1200

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.75
  const dir = new DirectionalLight('dir', new Vector3(-0.4, -1, -0.2), scene)
  dir.intensity = 0.6

  const groundMaterial = createMaterial(scene, Color3.FromHexString('#0b1220'), 0.2)
  const groundGrid = createGroundGridTexture(scene)
  groundMaterial.diffuseTexture = groundGrid
  groundMaterial.diffuseColor = Color3.White()
  groundMaterial.emissiveColor = Color3.FromHexString('#0b1220').scale(0.35)
  const padMaterial = createMaterial(scene, Color3.FromHexString('#1f2937'), 0.2)
  const padHoverMaterial = createMaterial(scene, Color3.FromHexString('#0ea5e9'), 0.5)
  const padSelectedMaterial = createMaterial(scene, Color3.FromHexString('#38bdf8'), 0.6)
  const padLockedMaterial = createMaterial(scene, Color3.FromHexString('#334155'), 0.1)
  const padEmptyMaterial = createMaterial(scene, Color3.FromHexString('#111827'), 0.2)
  const selectionMaterial = createMaterial(scene, Color3.FromHexString('#22c55e'), 0.8)
  const selectionHeroMaterial = createMaterial(scene, Color3.FromHexString('#f59e0b'), 0.85)
  const selectionBossMaterial = createMaterial(scene, Color3.FromHexString('#ef4444'), 0.85)
  const selectionMiniBossMaterial = createMaterial(scene, Color3.FromHexString('#f97316'), 0.85)
  const rangeMaterial = createMaterial(scene, Color3.FromHexString('#38bdf8'), 0.35)
  const hqHoverMaterial = createMaterial(scene, Color3.FromHexString('#facc15'), 0.7)
  const projectileMaterial = createMaterial(scene, Color3.FromHexString('#f97316'), 0.8)
  const invasionMarkerMaterial = createMaterial(scene, Color3.FromHexString('#facc15'), 0.85)
  const healthBgMaterial = createMaterial(scene, Color3.FromHexString('#0f172a'), 0.2)
  const healthPlayerMaterial = createMaterial(scene, Color3.FromHexString('#22c55e'), 0.5)
  const healthEnemyMaterial = createMaterial(scene, Color3.FromHexString('#ef4444'), 0.5)
  invasionMarkerMaterial.useVertexColor = true
  invasionMarkerMaterial.alpha = 0.92
  invasionMarkerMaterial.backFaceCulling = false
  healthBgMaterial.backFaceCulling = false
  healthPlayerMaterial.backFaceCulling = false
  healthEnemyMaterial.backFaceCulling = false

  const buildingFactory = createBuildingFactory(scene)
  const unitFactory = createUnitFactory(scene)
  const vfx = new VfxManager(scene)

  let activeMap = map
  let ground: Mesh | null = null
  let obstacles: Mesh[] = []
  const padMeshes = new Map<string, Mesh>()
  const buildingMeshes = new Map<string, BuildingVisualInstance>()
  const buildingLabels = new Map<string, LabelMesh>()
  const unitGroups = new Map<UnitGroupKey, ThinGroup>()
  const specialMeshes = new Map<string, SpecialUnitVisual>()
  const labelMeshes = new Map<string, LabelMesh>()
  const damageLabels: LabelMesh[] = []
  const selectionRings: Mesh[] = []
  const rangeRings: Mesh[] = []
  let hqHoverRing: Mesh | null = null

  let lastSimTime = 0
  let prevEffectKeys = new Set<string>()
  let prevProjectileIds = new Set<string>()
  const prevEntities = new Map<string, EntityState>()

  const healthBgGroup: BarGroup = {
    mesh: MeshBuilder.CreateBox('health_bg', { size: 1 }, scene),
    matrices: new Float32Array(0),
    colors: new Float32Array(0),
    capacity: 0,
    baseColor: healthBgMaterial.diffuseColor
  }
  healthBgGroup.mesh.material = healthBgMaterial
  healthBgGroup.mesh.isPickable = false
  healthBgGroup.mesh.thinInstanceEnablePicking = false

  const healthPlayerGroup: BarGroup = {
    mesh: MeshBuilder.CreateBox('health_player', { size: 1 }, scene),
    matrices: new Float32Array(0),
    colors: new Float32Array(0),
    capacity: 0,
    baseColor: healthPlayerMaterial.diffuseColor
  }
  healthPlayerGroup.mesh.material = healthPlayerMaterial
  healthPlayerGroup.mesh.isPickable = false
  healthPlayerGroup.mesh.thinInstanceEnablePicking = false

  const healthEnemyGroup: BarGroup = {
    mesh: MeshBuilder.CreateBox('health_enemy', { size: 1 }, scene),
    matrices: new Float32Array(0),
    colors: new Float32Array(0),
    capacity: 0,
    baseColor: healthEnemyMaterial.diffuseColor
  }
  healthEnemyGroup.mesh.material = healthEnemyMaterial
  healthEnemyGroup.mesh.isPickable = false
  healthEnemyGroup.mesh.thinInstanceEnablePicking = false

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

  const invasionMarkerGroup: ThinGroup = {
    mesh: MeshBuilder.CreateCylinder(
      'next_invasion_marker',
      { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 6 },
      scene
    ),
    ids: [],
    matrices: new Float32Array(0),
    colors: new Float32Array(0),
    capacity: 0,
    baseColor: Color3.FromHexString('#facc15')
  }
  invasionMarkerGroup.mesh.material = invasionMarkerMaterial
  invasionMarkerGroup.mesh.isPickable = false
  invasionMarkerGroup.mesh.thinInstanceEnablePicking = false

  const ensureGround = (nextMap: SimState['combat']['map']) => {
    activeMap = nextMap
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

  const ensureBuildingMesh = (padId: string, buildingId: RunBuilding['id'], level: number) => {
    if (buildingMeshes.has(padId)) return buildingMeshes.get(padId)!
    const instance = buildingFactory.create(buildingId, PAD_SIZE, level, padId)
    instance.basePlate.isPickable = true
    instance.basePlate.metadata = { kind: 'building', padId } as PickMeta
    buildingMeshes.set(padId, instance)
    return instance
  }

  const ensureSelectionRing = (index: number) => {
    if (selectionRings[index]) return selectionRings[index]
    const ring = MeshBuilder.CreateTorus(`selection_${index}`, { diameter: 2, thickness: 0.2 }, scene)
    ring.material = selectionMaterial
    ring.isPickable = false
    selectionRings[index] = ring
    return ring
  }

  const ensureHqHoverRing = () => {
    if (hqHoverRing) return hqHoverRing
    const ring = MeshBuilder.CreateTorus('hq_hover', { diameter: 2, thickness: 0.3 }, scene)
    ring.material = hqHoverMaterial
    ring.isPickable = false
    hqHoverRing = ring
    return ring
  }

  const ensureRangeRing = (index: number) => {
    if (rangeRings[index]) return rangeRings[index]
    const ring = MeshBuilder.CreateTorus(`range_${index}`, { diameter: 2, thickness: 0.12 }, scene)
    ring.material = rangeMaterial
    ring.isPickable = false
    rangeRings[index] = ring
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

  const ensureBuildingLabel = (padId: string) => {
    if (buildingLabels.has(padId)) return buildingLabels.get(padId)!
    const { mesh, texture } = createLabel(scene, `building_label_${padId}`)
    mesh.scaling = new Vector3(BUILDING_LABEL_SCALE, BUILDING_LABEL_SCALE, BUILDING_LABEL_SCALE)
    const entry = { mesh, texture, text: '' }
    buildingLabels.set(padId, entry)
    return entry
  }

  const ensureUnitLabel = (id: string) => {
    if (labelMeshes.has(id)) return labelMeshes.get(id)!
    const { mesh, texture } = createLabel(scene, `label_${id}`)
    mesh.scaling = new Vector3(UNIT_LABEL_SCALE, UNIT_LABEL_SCALE, UNIT_LABEL_SCALE)
    const entry = { mesh, texture, text: '' }
    labelMeshes.set(id, entry)
    return entry
  }

  const ensureSpecialMesh = (entity: EntityState) => {
    const existing = specialMeshes.get(entity.id)
    if (existing) return existing
    let visual: SpecialUnitVisual
    if (entity.kind === 'hq') {
      visual = unitFactory.createHq(entity.id)
    } else if (entity.kind === 'hero') {
      visual = unitFactory.createHero(entity.id)
    } else {
      visual = unitFactory.createElite(entity.id, entity.tier === 'boss' ? 'boss' : 'miniBoss')
    }
    visual.primary.isPickable = true
    visual.primary.metadata = { kind: entity.kind === 'hq' ? 'hq' : 'unit', entityId: entity.id } as PickMeta
    specialMeshes.set(entity.id, visual)
    return visual
  }

  const ensureDamageLabel = (index: number) => {
    if (damageLabels[index]) return damageLabels[index]
    const { mesh, texture } = createLabel(scene, `damage_${index}`)
    mesh.scaling = new Vector3(DAMAGE_LABEL_SCALE, DAMAGE_LABEL_SCALE, DAMAGE_LABEL_SCALE)
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
      const scaleFactor = entity.team === 'enemy' ? UNIT_SCALE_ENEMY : UNIT_SCALE_PLAYER
      const scale = new Vector3(entity.radius * scaleFactor, entity.radius * 0.6 * scaleFactor, entity.radius * scaleFactor)
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

  const updateBars = (group: BarGroup, entries: Array<{ pos: Vec2; width: number; hpPct: number; yOffset: number }>) => {
    const count = entries.length
    if (count > group.capacity) {
      const nextCap = Math.max(count, group.capacity + 16)
      group.capacity = nextCap
      group.matrices = new Float32Array(nextCap * 16)
      group.colors = new Float32Array(nextCap * 4)
    }
    entries.forEach((entry, index) => {
      const scale = new Vector3(entry.width, HEALTH_BAR_HEIGHT, HEALTH_BAR_DEPTH)
      const pos = new Vector3(entry.pos.x, entry.yOffset, entry.pos.y)
      const matrix = Matrix.Compose(scale, Quaternion.Identity(), pos)
      matrix.copyToArray(group.matrices, index * 16)
      group.colors[index * 4 + 0] = group.baseColor.r
      group.colors[index * 4 + 1] = group.baseColor.g
      group.colors[index * 4 + 2] = group.baseColor.b
      group.colors[index * 4 + 3] = 1
    })
    group.mesh.thinInstanceSetBuffer('matrix', group.matrices, 16, false)
    group.mesh.thinInstanceSetBuffer('color', group.colors, 4, false)
    group.mesh.thinInstanceCount = count
    group.mesh.thinInstanceRefreshBoundingInfo(true)
  }

  const updateHealthBars = (sim: SimState) => {
    const all = sim.entities
    const bgEntries = all.map((entity) => ({
      pos: entity.pos,
      width: Math.max(16, entity.radius * 2.8),
      hpPct: Math.max(0, Math.min(1, entity.hp / entity.maxHp)),
      yOffset: entity.radius * 1.1 + 18
    }))
    const playerEntries = all.filter((entity) => entity.team === 'player').map((entity) => ({
      pos: entity.pos,
      width: Math.max(16, entity.radius * 2.8) * Math.max(0, Math.min(1, entity.hp / entity.maxHp)),
      hpPct: Math.max(0, Math.min(1, entity.hp / entity.maxHp)),
      yOffset: entity.radius * 1.1 + 18
    }))
    const enemyEntries = all.filter((entity) => entity.team === 'enemy').map((entity) => ({
      pos: entity.pos,
      width: Math.max(16, entity.radius * 2.8) * Math.max(0, Math.min(1, entity.hp / entity.maxHp)),
      hpPct: Math.max(0, Math.min(1, entity.hp / entity.maxHp)),
      yOffset: entity.radius * 1.1 + 18
    }))
    updateBars(healthBgGroup, bgEntries)
    updateBars(healthPlayerGroup, playerEntries)
    updateBars(healthEnemyGroup, enemyEntries)
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
      const scale = new Vector3(PROJECTILE_SCALE, PROJECTILE_SCALE, PROJECTILE_SCALE)
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

  const getEdgeCenterPreviewTransform = (edge: 'N' | 'E' | 'S' | 'W') => {
    if (edge === 'N') return { position: { x: activeMap.width * 0.5, y: -28 }, forward: { x: 0, y: 1 }, edge }
    if (edge === 'S') return { position: { x: activeMap.width * 0.5, y: activeMap.height + 28 }, forward: { x: 0, y: -1 }, edge }
    if (edge === 'W') return { position: { x: -28, y: activeMap.height * 0.5 }, forward: { x: 1, y: 0 }, edge }
    return { position: { x: activeMap.width + 28, y: activeMap.height * 0.5 }, forward: { x: -1, y: 0 }, edge }
  }

  const updateInvasionIndicators = (preview: NextBattlePreview | undefined, phase: Render3DUpdateInput['phase'], time: number) => {
    if ((phase !== 'build' && !DEBUG_SHOW_SPAWN_POINTS) || !preview) {
      invasionMarkerGroup.mesh.thinInstanceCount = 0
      return
    }
    const sources =
      preview.previewSpawnTransforms.length > 0
        ? preview.previewSpawnTransforms
        : preview.previewEdges.map((edge) => getEdgeCenterPreviewTransform(edge))
    const count = sources.length
    if (count === 0) {
      invasionMarkerGroup.mesh.thinInstanceCount = 0
      return
    }
    if (count > invasionMarkerGroup.capacity) {
      const nextCap = Math.max(count, invasionMarkerGroup.capacity + 8)
      invasionMarkerGroup.capacity = nextCap
      invasionMarkerGroup.matrices = new Float32Array(nextCap * 16)
      invasionMarkerGroup.colors = new Float32Array(nextCap * 4)
    }
    sources.forEach((entry, index) => {
      const pulse = 1 + Math.sin(time * 3.2 + index * 0.45) * 0.08
      const scale = new Vector3(
        INVASION_MARKER_RADIUS * pulse,
        INVASION_MARKER_HEIGHT * pulse,
        INVASION_MARKER_RADIUS * pulse
      )
      const yaw = Math.atan2(entry.forward.x, entry.forward.y)
      const rotation = Quaternion.FromEulerAngles(0, yaw, 0)
      const pos = new Vector3(entry.position.x, scale.y * 0.5 + 0.5, entry.position.y)
      const matrix = Matrix.Compose(scale, rotation, pos)
      matrix.copyToArray(invasionMarkerGroup.matrices, index * 16)
      invasionMarkerGroup.colors[index * 4 + 0] = invasionMarkerGroup.baseColor.r
      invasionMarkerGroup.colors[index * 4 + 1] = invasionMarkerGroup.baseColor.g
      invasionMarkerGroup.colors[index * 4 + 2] = invasionMarkerGroup.baseColor.b
      invasionMarkerGroup.colors[index * 4 + 3] = 0.95
    })
    invasionMarkerGroup.mesh.thinInstanceSetBuffer('matrix', invasionMarkerGroup.matrices, 16, false)
    invasionMarkerGroup.mesh.thinInstanceSetBuffer('color', invasionMarkerGroup.colors, 4, false)
    invasionMarkerGroup.mesh.thinInstanceCount = count
    invasionMarkerGroup.mesh.thinInstanceRefreshBoundingInfo(true)
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
      const entry = ensureUnitLabel(id)
      activeIds.add(id)
      if (entry.text !== label) {
        drawLabel(entry.texture, label, '#f8fafc', UNIT_LABEL_FONT)
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
      drawLabel(label.texture, entry.text, entry.color, DAMAGE_LABEL_FONT)
      label.text = entry.text
      label.mesh.position = new Vector3(entry.x, 16 + (entry.life - entry.ttl) * 0.4 * Math.abs(entry.vy), entry.y)
      label.mesh.setEnabled(true)
    })
    for (let i = numbers.length; i < damageLabels.length; i += 1) {
      damageLabels[i].mesh.setEnabled(false)
    }
  }

  const updateVfx = (sim: SimState) => {
    if (sim.time < lastSimTime) {
      prevEntities.clear()
      prevEffectKeys = new Set<string>()
      prevProjectileIds = new Set<string>()
      lastSimTime = sim.time
      return
    }
    const dt = lastSimTime ? Math.max(0, sim.time - lastSimTime) : 0
    const entityMap = new Map(sim.entities.map((entity) => [entity.id, entity]))

    if (prevEntities.size > 0) {
      const currentIds = new Set(entityMap.keys())
      prevEntities.forEach((entity, id) => {
        if (currentIds.has(id)) return
        vfx.playUnitDeath(toWorld(entity.pos), entity.tier)
      })
    }

    const nextProjectileIds = new Set<string>()
    sim.projectiles.forEach((proj) => {
      nextProjectileIds.add(proj.id)
      if (prevProjectileIds.has(proj.id)) return
      const target = entityMap.get(proj.targetId)
      const source = proj.sourceId ? entityMap.get(proj.sourceId) : undefined
      const from = toWorld(proj.pos)
      const to = target ? toWorld(target.pos) : from
      if (source?.kind === 'hero') {
        vfx.playHeroAttack(getHeroVfxType(source), from, to, 'ranged')
      } else if (source?.tier === 'boss' || source?.tier === 'miniBoss') {
        vfx.playHeroAttack('boss', from, to, 'ranged')
      } else {
        vfx.playRangedShot(from, to, source?.kind === 'archer' ? 'arrow' : 'bolt')
      }
    })
    prevProjectileIds = nextProjectileIds

    const nextEffectKeys = new Set<string>()
    sim.effects.forEach((effect) => {
      const key = buildEffectKey(effect)
      nextEffectKeys.add(key)
      if (prevEffectKeys.has(key)) return
      if (effect.kind === 'slash' && effect.from && effect.to) {
        const attacker = findClosestEntity(effect.from, sim.entities, 120)
        if (attacker?.kind === 'hero') {
          vfx.playHeroAttack(getHeroVfxType(attacker), toWorld(effect.from), toWorld(effect.to), 'melee')
        } else if (attacker?.tier === 'boss' || attacker?.tier === 'miniBoss') {
          vfx.playHeroAttack('boss', toWorld(effect.from), toWorld(effect.to), 'melee')
        } else {
          vfx.playMeleeSwing(toWorld(effect.from), toWorld(effect.to))
        }
      }
      if (effect.kind === 'hit') {
        const intensity = effect.radius >= 18 ? 1.35 : 1
        vfx.playHit(toWorld(effect.pos), intensity)
      }
      if (effect.kind === 'aoe') {
        const hero = findClosestHero(effect.pos, sim.entities)
        vfx.playHeroAttack(getHeroVfxType(hero), toWorld(effect.pos), toWorld(effect.pos), 'aoe', effect.radius)
      }
      if (effect.kind === 'heal') {
        const hero = findClosestHero(effect.pos, sim.entities)
        vfx.playHeroAttack(getHeroVfxType(hero), toWorld(effect.pos), toWorld(effect.pos), 'heal', effect.radius)
      }
    })
    prevEffectKeys = nextEffectKeys

    prevEntities.clear()
    sim.entities.forEach((entity) => prevEntities.set(entity.id, entity))

    vfx.update(dt)
    lastSimTime = sim.time
  }

  const updateSelection = (sim: SimState, selection: string[]) => {
    const pulse = 1 + Math.sin(sim.time * 5) * 0.08
    selection.forEach((id, index) => {
      const entity = sim.entities.find((entry) => entry.id === id)
      const ring = ensureSelectionRing(index)
      if (!entity || entity.kind === 'hq') {
        ring.setEnabled(false)
        return
      }
      const diameter = (entity.radius + 6) * 2
      ring.material =
        entity.tier === 'boss'
          ? selectionBossMaterial
          : entity.tier === 'miniBoss'
            ? selectionMiniBossMaterial
            : entity.kind === 'hero'
              ? selectionHeroMaterial
              : selectionMaterial
      ring.scaling = new Vector3((diameter / 2) * pulse, 1, (diameter / 2) * pulse)
      ring.position = new Vector3(entity.pos.x, 0.2, entity.pos.y)
      ring.setEnabled(true)
    })
    for (let i = selection.length; i < selectionRings.length; i += 1) {
      selectionRings[i].setEnabled(false)
    }
  }

  const updateRanges = (sim: SimState, selection: string[]) => {
    selection.forEach((id, index) => {
      const entity = sim.entities.find((entry) => entry.id === id)
      const ring = ensureRangeRing(index)
      if (!entity || entity.kind === 'hq') {
        ring.setEnabled(false)
        return
      }
      const diameter = Math.max(4, entity.range * 2)
      ring.scaling = new Vector3(diameter / 2, 1, diameter / 2)
      ring.position = new Vector3(entity.pos.x, 0.18, entity.pos.y)
      ring.setEnabled(true)
    })
    for (let i = selection.length; i < rangeRings.length; i += 1) {
      rangeRings[i].setEnabled(false)
    }
  }

  const updateSpecialMeshes = (sim: SimState) => {
    const activeIds = new Set<string>()
    sim.entities.forEach((entity) => {
      if (entity.kind !== 'hero' && entity.kind !== 'elite' && entity.kind !== 'hq') return
      const visual = ensureSpecialMesh(entity)
      activeIds.add(entity.id)
      if (entity.kind === 'hq') {
        const height = BASE_BUILDING_HEIGHT + Math.max(0, entity.radius)
        visual.root.scaling = new Vector3(PAD_SIZE.w * 0.45, height, PAD_SIZE.h * 0.45)
        visual.root.position = new Vector3(entity.pos.x, height / 2, entity.pos.y)
      } else {
        const scaleFactor = entity.kind === 'hero' ? UNIT_SCALE_HERO : UNIT_SCALE_ELITE
        const scale = new Vector3(entity.radius * scaleFactor, entity.radius * scaleFactor, entity.radius * scaleFactor)
        visual.root.scaling = scale
        visual.root.position = new Vector3(entity.pos.x, 0, entity.pos.y)
      }
      const isHit = typeof entity.lastHitTime === 'number' && sim.time - entity.lastHitTime < HIT_FLASH_DURATION
      visual.materials.forEach((mat) => {
        mat.emissiveColor = isHit ? Color3.White() : (mat.diffuseColor ?? Color3.White()).scale(0.25)
      })
      visual.setEnabled(true)
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
        const instance = ensureBuildingMesh(pad.id, building.id, building.level)
        instance.root.position = new Vector3(pad.x, 0, pad.y)
        instance.setLevel(building.level)
        instance.setEnabled(true)
        const label = ensureBuildingLabel(pad.id)
        const name = BUILDING_DEFS[building.id].name
        if (label.text !== name) {
          drawLabel(label.texture, name, '#e2e8f0', BUILDING_LABEL_FONT)
          label.text = name
        }
        label.mesh.position = new Vector3(pad.x, instance.height + 18, pad.y)
        label.mesh.setEnabled(true)
      } else {
        const mesh = buildingMeshes.get(pad.id)
        if (mesh) mesh.setEnabled(false)
        const label = buildingLabels.get(pad.id)
        if (label) label.mesh.setEnabled(false)
      }
    })
    buildingMeshes.forEach((mesh, padId) => {
      if (!activeBuildingPads.has(padId)) {
        mesh.setEnabled(false)
      }
    })
    buildingLabels.forEach((label, padId) => {
      if (!activeBuildingPads.has(padId)) {
        label.mesh.setEnabled(false)
      }
    })
  }

  const updateHqHover = (sim: SimState, hovered: boolean | undefined) => {
    if (!hovered) {
      if (hqHoverRing) hqHoverRing.setEnabled(false)
      return
    }
    const hq = sim.entities.find((entity) => entity.kind === 'hq')
    if (!hq) return
    const ring = ensureHqHoverRing()
    const diameter = Math.max(PAD_SIZE.w, PAD_SIZE.h) * 1.1
    ring.scaling = new Vector3(diameter / 2, 1, diameter / 2)
    ring.position = new Vector3(hq.pos.x, 0.25, hq.pos.y)
    ring.setEnabled(true)
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

  const update = (input: Render3DUpdateInput) => {
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
    updateRanges(input.sim, input.selection)
    updateHealthBars(input.sim)
    updateInvasionIndicators(input.overlays.nextBattlePreview, input.phase, input.sim.time)
    updateHqHover(input.sim, input.overlays.hoveredHq)
    updateLabels(input.sim, Boolean(input.options?.showLabels))
    updateDamageNumbers(input.sim)
    updateVfx(input.sim)
  }

  const render = () => {
    // Defensive: ensure we render only a single camera and fully clear the frame.
    if (scene.activeCamera !== camera) {
      scene.activeCamera = camera
    }
    if (scene.activeCameras) {
      scene.activeCameras = null
    }
    engine.clear(scene.clearColor, true, true, true)
    scene.render()
  }

  const resize = (width: number, height: number) => {
    engine.resize(true)
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
    const level = engine.getHardwareScalingLevel()
    const width = engine.getRenderWidth() * level
    const height = engine.getRenderHeight() * level
    if (!width || !height) return null
    const viewport = camera.viewport.toGlobal(width, height)
    const projected = Vector3.Project(new Vector3(pos.x, 0, pos.y), Matrix.Identity(), camera.getTransformationMatrix(), viewport)
    return { x: projected.x, y: projected.y }
  }

  const getViewPolygon = () => {
    const level = engine.getHardwareScalingLevel()
    const width = engine.getRenderWidth() * level
    const height = engine.getRenderHeight() * level
    if (!width || !height) return null
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ]
    const points: Vec2[] = []
    corners.forEach((corner) => {
      const ray = scene.createPickingRay(corner.x, corner.y, Matrix.Identity(), camera)
      const dirY = ray.direction.y
      if (Math.abs(dirY) < 1e-6) return
      const t = -ray.origin.y / dirY
      if (!Number.isFinite(t) || t <= 0) return
      const hit = ray.origin.add(ray.direction.scale(t))
      points.push({ x: hit.x, y: hit.z })
    })
    return points.length === 4 ? points : null
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
    projectToScreen,
    getViewPolygon
  }
}
