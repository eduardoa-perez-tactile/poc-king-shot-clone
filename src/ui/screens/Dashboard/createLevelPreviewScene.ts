import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Material } from '@babylonjs/core/Materials/material'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Scene } from '@babylonjs/core/scene'
import { Engine } from '@babylonjs/core/Engines/engine'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import type { BuildingPad, LevelDefinition, SpawnEdge } from '../../../game/types/LevelDefinition'
import { PAD_SIZE } from '../../../rts/pads'

export interface LevelPreviewOptions {
  showLabels?: boolean
  showObstacles?: boolean
  showSpawns?: boolean
  showPaths?: boolean
}

interface CreateLevelPreviewSceneInput {
  canvas: HTMLCanvasElement
  levelConfig: LevelDefinition
  options?: LevelPreviewOptions
}

export interface LevelPreviewSceneController {
  engine: Engine
  scene: Scene
  regenerate: (levelConfig: LevelDefinition, options?: LevelPreviewOptions) => void
  fitToBounds: () => void
  dispose: () => void
}

interface Bounds2D {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

interface PreviewOptionsResolved {
  showLabels: boolean
  showObstacles: boolean
  showSpawns: boolean
  showPaths: boolean
}

interface PathPoint {
  x: number
  y: number
}

const DEFAULT_OPTIONS: PreviewOptionsResolved = {
  showLabels: true,
  showObstacles: true,
  showSpawns: true,
  showPaths: false
}

const PAD_HEIGHT = 10
const PAD_ALPHA = 0.72
const OBSTACLE_HEIGHT = 16
const SPAWN_MARKER_RADIUS = 18
const CAMERA_PADDING = 96

const resolveOptions = (options?: LevelPreviewOptions): PreviewOptionsResolved => ({ ...DEFAULT_OPTIONS, ...options })

const asPoint = (value: unknown): PathPoint | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.x !== 'number' || typeof record.y !== 'number') return null
  return { x: record.x, y: record.y }
}

const asPolyline = (value: unknown): PathPoint[] => {
  if (!Array.isArray(value)) return []
  return value.map((entry) => asPoint(entry)).filter((entry): entry is PathPoint => Boolean(entry))
}

const collectPathPolylines = (levelConfig: LevelDefinition): PathPoint[][] => {
  const candidates: unknown[] = [
    (levelConfig as unknown as Record<string, unknown>).paths,
    (levelConfig as unknown as Record<string, unknown>).lanes,
    (levelConfig.map as unknown as Record<string, unknown>).paths,
    (levelConfig.map as unknown as Record<string, unknown>).lanes
  ]
  const result: PathPoint[][] = []
  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return
    candidate.forEach((entry) => {
      const direct = asPolyline(entry)
      if (direct.length > 1) {
        result.push(direct)
        return
      }
      if (!entry || typeof entry !== 'object') return
      const record = entry as Record<string, unknown>
      ;['points', 'nodes', 'path'].forEach((key) => {
        const nested = asPolyline(record[key])
        if (nested.length > 1) result.push(nested)
      })
    })
  })
  return result
}

const createGroundGridTexture = (scene: Scene) => {
  const texture = new DynamicTexture('level_preview_grid', { width: 512, height: 512 }, scene, false)
  const ctx = texture.getContext()
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, 512, 512)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)'
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

const createColorMaterial = (scene: Scene, name: string, color: string, alpha: number, emissive = 0.3) => {
  const material = new StandardMaterial(name, scene)
  const resolved = Color3.FromHexString(color)
  material.diffuseColor = resolved
  material.emissiveColor = resolved.scale(emissive)
  material.specularColor = new Color3(0.1, 0.1, 0.1)
  material.alpha = alpha
  material.backFaceCulling = true
  material.transparencyMode = Material.MATERIAL_ALPHABLEND
  return material
}

const normalizeBounds = (bounds: Bounds2D): Bounds2D => {
  const width = bounds.maxX - bounds.minX
  const depth = bounds.maxZ - bounds.minZ
  if (width > 0 && depth > 0) return bounds
  return {
    minX: bounds.minX,
    maxX: bounds.minX + Math.max(width, 1),
    minZ: bounds.minZ,
    maxZ: bounds.minZ + Math.max(depth, 1)
  }
}

const expandBounds = (bounds: Bounds2D, x: number, z: number, halfW = 0, halfD = 0): Bounds2D => ({
  minX: Math.min(bounds.minX, x - halfW),
  maxX: Math.max(bounds.maxX, x + halfW),
  minZ: Math.min(bounds.minZ, z - halfD),
  maxZ: Math.max(bounds.maxZ, z + halfD)
})

const inferSpawnEdge = (x: number, y: number, mapWidth: number, mapHeight: number): SpawnEdge => {
  const distances: Array<{ edge: SpawnEdge; distance: number }> = [
    { edge: 'W', distance: Math.abs(x) },
    { edge: 'E', distance: Math.abs(mapWidth - x) },
    { edge: 'N', distance: Math.abs(y) },
    { edge: 'S', distance: Math.abs(mapHeight - y) }
  ]
  distances.sort((a, b) => a.distance - b.distance)
  return distances[0]?.edge ?? 'E'
}

const collectSpawnEdges = (levelConfig: LevelDefinition): SpawnEdge[] => {
  const edges = new Set<SpawnEdge>()
  levelConfig.days.forEach((day) => {
    day.waves.forEach((wave) => {
      wave.spawnEdges?.forEach((entry) => edges.add(entry.edge))
    })
  })
  if (edges.size === 0) {
    edges.add(inferSpawnEdge(levelConfig.map.enemySpawn.x, levelConfig.map.enemySpawn.y, levelConfig.map.width, levelConfig.map.height))
  }
  return Array.from(edges)
}

const getSpawnMarkerTransform = (edge: SpawnEdge, levelConfig: LevelDefinition) => {
  const margin = 34
  if (edge === 'N') {
    return { x: levelConfig.map.width * 0.5, z: margin, yaw: 0 }
  }
  if (edge === 'S') {
    return { x: levelConfig.map.width * 0.5, z: levelConfig.map.height - margin, yaw: Math.PI }
  }
  if (edge === 'W') {
    return { x: margin, z: levelConfig.map.height * 0.5, yaw: Math.PI / 2 }
  }
  return { x: levelConfig.map.width - margin, z: levelConfig.map.height * 0.5, yaw: -Math.PI / 2 }
}

const PAD_LABEL_BY_TYPE: Record<string, string> = {
  TOWER_ONLY: 'TOWER PAD',
  UNIT_PRODUCER: 'PRODUCER PAD',
  HERO: 'HERO PAD'
}

const PAD_LABEL_BY_BUILDING: Record<string, string> = {
  watchtower: 'TOWER PAD',
  barracks: 'BARRACKS PAD',
  range: 'ARCHERS PAD',
  hero_recruiter: 'HERO PAD',
  wall: 'WALL PAD'
}

const PAD_COLOR_BY_TYPE: Record<string, string> = {
  TOWER_ONLY: '#38bdf8',
  UNIT_PRODUCER: '#22c55e',
  HERO: '#f59e0b'
}

const PAD_COLOR_BY_BUILDING: Record<string, string> = {
  watchtower: '#38bdf8',
  barracks: '#4ade80',
  range: '#2dd4bf',
  hero_recruiter: '#f59e0b',
  wall: '#94a3b8'
}

const resolvePadLabel = (pad: BuildingPad, unlockLevel?: number) => {
  const byBuilding = pad.allowedTypes.find((type) => PAD_LABEL_BY_BUILDING[type])
  const base = (byBuilding && PAD_LABEL_BY_BUILDING[byBuilding]) ?? PAD_LABEL_BY_TYPE[pad.padType] ?? 'BUILD PAD'
  if (typeof unlockLevel === 'number' && Number.isFinite(unlockLevel)) {
    return `${base}\nUNLOCK LV ${Math.max(1, Math.round(unlockLevel))}`
  }
  return base
}

const resolvePadColor = (pad: BuildingPad) => {
  const byBuilding = pad.allowedTypes.find((type) => PAD_COLOR_BY_BUILDING[type])
  return (byBuilding && PAD_COLOR_BY_BUILDING[byBuilding]) ?? PAD_COLOR_BY_TYPE[pad.padType] ?? '#94a3b8'
}

const computeBounds = (levelConfig: LevelDefinition): Bounds2D => {
  let bounds: Bounds2D = {
    minX: 0,
    maxX: Math.max(1, levelConfig.map.width),
    minZ: 0,
    maxZ: Math.max(1, levelConfig.map.height)
  }

  levelConfig.buildingPads.forEach((pad) => {
    bounds = expandBounds(bounds, pad.x, pad.y, PAD_SIZE.w * 0.5, PAD_SIZE.h * 0.5)
  })

  levelConfig.map.obstacles.forEach((obstacle) => {
    bounds = expandBounds(bounds, obstacle.x + obstacle.w * 0.5, obstacle.y + obstacle.h * 0.5, obstacle.w * 0.5, obstacle.h * 0.5)
  })

  bounds = expandBounds(bounds, levelConfig.map.playerHQ.x, levelConfig.map.playerHQ.y, 36, 36)
  bounds = expandBounds(bounds, levelConfig.map.playerSpawn.x, levelConfig.map.playerSpawn.y, 24, 24)
  bounds = expandBounds(bounds, levelConfig.map.enemySpawn.x, levelConfig.map.enemySpawn.y, 24, 24)

  return normalizeBounds(bounds)
}

export const createLevelPreviewScene = ({ canvas, levelConfig, options }: CreateLevelPreviewSceneInput): LevelPreviewSceneController => {
  const engine = new Engine(canvas, true, { antialias: true }, true)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.04, 0.07, 0.13, 1)

  const camera = new ArcRotateCamera('level_preview_camera', -Math.PI / 4.6, 0.98, 260, new Vector3(0, 0, 0), scene)
  camera.mode = BabylonCamera.ORTHOGRAPHIC_CAMERA
  camera.minZ = 1
  camera.maxZ = 2200
  camera.inputs.clear()
  scene.activeCamera = camera

  const light = new HemisphericLight('level_preview_light', new Vector3(0, 1, 0), scene)
  light.intensity = 0.96

  const ground = MeshBuilder.CreateGround('level_preview_ground', { width: 1, height: 1 }, scene)
  ground.isPickable = false
  const groundMaterial = createColorMaterial(scene, 'level_preview_ground_mat', '#0f172a', 1, 0.24)
  const groundGrid = createGroundGridTexture(scene)
  groundMaterial.diffuseTexture = groundGrid
  groundMaterial.diffuseColor = Color3.White()
  ground.material = groundMaterial

  let generatedMeshes: AbstractMesh[] = []
  let generatedMaterials: Material[] = []
  let generatedTextures: DynamicTexture[] = []
  const labelMaterialCache = new Map<string, StandardMaterial>()
  let activeBounds = computeBounds(levelConfig)

  const fitToBounds = () => {
    const bounds = normalizeBounds(activeBounds)
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())

    const halfWidth = width * 0.5 + CAMERA_PADDING
    const halfDepth = depth * 0.5 + CAMERA_PADDING
    const orthoHalfHeight = Math.max(halfDepth, halfWidth / Math.max(0.1, aspect))
    const orthoHalfWidth = orthoHalfHeight * Math.max(0.1, aspect)

    camera.orthoLeft = -orthoHalfWidth
    camera.orthoRight = orthoHalfWidth
    camera.orthoBottom = -orthoHalfHeight
    camera.orthoTop = orthoHalfHeight
    camera.radius = Math.max(width, depth) * 1.6
    camera.target = new Vector3(centerX, 0, centerZ)
  }

  const disposeGenerated = () => {
    generatedMeshes.forEach((mesh) => mesh.dispose())
    generatedMaterials.forEach((material) => material.dispose())
    generatedTextures.forEach((texture) => texture.dispose())
    generatedMeshes = []
    generatedMaterials = []
    generatedTextures = []
    labelMaterialCache.clear()
  }

  const trackMesh = <T extends AbstractMesh>(mesh: T) => {
    mesh.isPickable = false
    generatedMeshes.push(mesh)
    return mesh
  }

  const trackMaterial = <T extends Material>(material: T) => {
    generatedMaterials.push(material)
    return material
  }

  const trackTexture = <T extends DynamicTexture>(texture: T) => {
    generatedTextures.push(texture)
    return texture
  }

  const createLabelMaterial = (text: string) => {
    const cached = labelMaterialCache.get(text)
    if (cached) return cached
    const lines = text.split('\n').filter((entry) => entry.trim().length > 0)
    const texture = trackTexture(new DynamicTexture(`preview_label_${labelMaterialCache.size}`, { width: 384, height: 192 }, scene, true))
    texture.hasAlpha = true
    const size = texture.getSize()
    const ctx = texture.getContext()
    ctx.clearRect(0, 0, size.width, size.height)
    ctx.fillStyle = 'rgba(2, 6, 23, 0.75)'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(2, 2, size.width - 4, size.height - 4)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    lines.forEach((line, index) => {
      const y = size.height * ((index + 1) / (lines.length + 1))
      ctx.font = "bold 38px 'Space Mono', monospace"
      ctx.lineWidth = 6
      ctx.strokeStyle = '#020617'
      ctx.strokeText(line, size.width / 2, y)
      ctx.fillStyle = '#e2e8f0'
      ctx.fillText(line, size.width / 2, y)
    })
    texture.update()

    const material = trackMaterial(new StandardMaterial(`preview_label_mat_${labelMaterialCache.size}`, scene))
    material.diffuseTexture = texture
    material.opacityTexture = texture
    material.backFaceCulling = false
    material.disableLighting = true
    material.emissiveColor = Color3.White().scale(0.95)
    material.transparencyMode = Material.MATERIAL_ALPHABLEND
    labelMaterialCache.set(text, material)
    return material
  }

  const buildPads = (nextLevel: LevelDefinition, nextOptions: PreviewOptionsResolved, bounds: Bounds2D) => {
    const padGroups = new Map<string, BuildingPad[]>()
    nextLevel.buildingPads.forEach((pad) => {
      const key = `${resolvePadColor(pad)}::${pad.padType}`
      const bucket = padGroups.get(key)
      if (bucket) {
        bucket.push(pad)
      } else {
        padGroups.set(key, [pad])
      }
    })

    padGroups.forEach((pads, key) => {
      const color = key.split('::')[0] ?? '#94a3b8'
      const base = trackMesh(
        MeshBuilder.CreateBox(`preview_pad_base_${key}`, { width: PAD_SIZE.w, depth: PAD_SIZE.h, height: PAD_HEIGHT }, scene)
      )
      base.material = trackMaterial(createColorMaterial(scene, `preview_pad_mat_${key}`, color, PAD_ALPHA, 0.4))
      base.isVisible = false
      pads.forEach((pad, index) => {
        const instance = trackMesh(base.createInstance(`preview_pad_${key}_${index}`))
        instance.position = new Vector3(pad.x, PAD_HEIGHT * 0.5 + 0.2, pad.y)
        if (typeof pad.rotation === 'number' && Number.isFinite(pad.rotation)) {
          instance.rotationQuaternion = Quaternion.FromEulerAngles(0, (pad.rotation * Math.PI) / 180, 0)
        }
      })
    })

    const padById = new Map(nextLevel.buildingPads.map((pad) => [pad.id, pad]))
    const startingBuildingMaterial = trackMaterial(createColorMaterial(scene, 'preview_starting_building_mat', '#facc15', 0.84, 0.42))
    nextLevel.startingBuildings.forEach((building, index) => {
      const pad = padById.get(building.padId)
      if (!pad) return
      const mesh = trackMesh(
        MeshBuilder.CreateBox(`preview_starting_building_${index}`, {
          width: PAD_SIZE.w * 0.68,
          depth: PAD_SIZE.h * 0.68,
          height: PAD_HEIGHT * 0.95
        }, scene)
      )
      mesh.position = new Vector3(pad.x, PAD_HEIGHT + 6, pad.y)
      mesh.material = startingBuildingMaterial
    })

    if (!nextOptions.showLabels) return bounds

    let expanded = bounds
    nextLevel.buildingPads.forEach((pad, index) => {
      const unlockLevel = nextLevel.stronghold.padUnlockLevels[pad.id] ?? pad.unlockLevel
      const label = resolvePadLabel(pad, unlockLevel)
      const lines = label.split('\n')
      const maxChars = Math.max(...lines.map((line) => line.length))
      const width = Math.max(30, maxChars * 2.5)
      const height = Math.max(12, lines.length * 7)
      const mesh = trackMesh(MeshBuilder.CreatePlane(`preview_pad_label_${index}`, { width, height }, scene))
      mesh.position = new Vector3(pad.x, PAD_HEIGHT + 12, pad.y)
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
      mesh.material = createLabelMaterial(label)
      expanded = expandBounds(expanded, pad.x, pad.y, width * 0.5, height * 0.5)
    })

    return expanded
  }

  const buildObstacles = (nextLevel: LevelDefinition, nextOptions: PreviewOptionsResolved, bounds: Bounds2D) => {
    if (!nextOptions.showObstacles || nextLevel.map.obstacles.length === 0) return bounds

    const obstacleGroups = new Map<string, Array<{ x: number; y: number; w: number; h: number }>>()
    nextLevel.map.obstacles.forEach((obstacle) => {
      const key = `${obstacle.w.toFixed(2)}:${obstacle.h.toFixed(2)}`
      const bucket = obstacleGroups.get(key)
      if (bucket) {
        bucket.push(obstacle)
      } else {
        obstacleGroups.set(key, [obstacle])
      }
    })

    const obstacleMaterial = trackMaterial(createColorMaterial(scene, 'preview_obstacle_mat', '#64748b', 0.82, 0.22))
    obstacleGroups.forEach((obstacles, key) => {
      const [wRaw, hRaw] = key.split(':')
      const width = Number(wRaw)
      const depth = Number(hRaw)
      const base = trackMesh(
        MeshBuilder.CreateBox(`preview_obstacle_base_${key}`, { width, depth, height: OBSTACLE_HEIGHT }, scene)
      )
      base.material = obstacleMaterial
      base.isVisible = false
      obstacles.forEach((obstacle, index) => {
        const instance = trackMesh(base.createInstance(`preview_obstacle_${key}_${index}`))
        instance.position = new Vector3(obstacle.x + obstacle.w * 0.5, OBSTACLE_HEIGHT * 0.5, obstacle.y + obstacle.h * 0.5)
      })
    })

    return nextLevel.map.obstacles.reduce(
      (acc, obstacle) =>
        expandBounds(acc, obstacle.x + obstacle.w * 0.5, obstacle.y + obstacle.h * 0.5, obstacle.w * 0.5, obstacle.h * 0.5),
      bounds
    )
  }

  const buildSpawnIndicators = (nextLevel: LevelDefinition, nextOptions: PreviewOptionsResolved, bounds: Bounds2D) => {
    const markerMaterial = trackMaterial(createColorMaterial(scene, 'preview_spawn_marker_mat', '#ef4444', 0.95, 0.92))

    const playerSpawn = trackMesh(MeshBuilder.CreateSphere('preview_player_spawn', { diameter: 16 }, scene))
    playerSpawn.position = new Vector3(nextLevel.map.playerSpawn.x, 8, nextLevel.map.playerSpawn.y)
    playerSpawn.material = trackMaterial(createColorMaterial(scene, 'preview_player_spawn_mat', '#22d3ee', 0.86, 0.56))

    const enemySpawn = trackMesh(MeshBuilder.CreateSphere('preview_enemy_spawn', { diameter: 16 }, scene))
    enemySpawn.position = new Vector3(nextLevel.map.enemySpawn.x, 8, nextLevel.map.enemySpawn.y)
    enemySpawn.material = trackMaterial(createColorMaterial(scene, 'preview_enemy_spawn_mat', '#fb7185', 0.86, 0.64))

    if (!nextOptions.showSpawns) return bounds

    const edges = collectSpawnEdges(nextLevel)
    edges.forEach((edge, index) => {
      const transform = getSpawnMarkerTransform(edge, nextLevel)
      const marker = trackMesh(
        MeshBuilder.CreateDisc(`preview_spawn_edge_${index}`, { radius: SPAWN_MARKER_RADIUS, tessellation: 3 }, scene)
      )
      marker.material = markerMaterial
      marker.position = new Vector3(transform.x, 1.1, transform.z)
      marker.rotation = new Vector3(Math.PI * 0.5, transform.yaw, 0)
    })

    let expanded = bounds
    edges.forEach((edge) => {
      const transform = getSpawnMarkerTransform(edge, nextLevel)
      expanded = expandBounds(expanded, transform.x, transform.z, SPAWN_MARKER_RADIUS, SPAWN_MARKER_RADIUS)
    })
    return expanded
  }

  const buildPaths = (nextLevel: LevelDefinition, nextOptions: PreviewOptionsResolved) => {
    if (!nextOptions.showPaths) return
    const polylines = collectPathPolylines(nextLevel)
    polylines.forEach((polyline, index) => {
      const points = polyline.map((point) => new Vector3(point.x, 2.2, point.y))
      const line = trackMesh(MeshBuilder.CreateLines(`preview_path_${index}`, { points }, scene))
      ;(line as unknown as { color: Color3 }).color = Color3.FromHexString('#93c5fd')
    })
  }

  const buildStronghold = (nextLevel: LevelDefinition) => {
    const stronghold = trackMesh(MeshBuilder.CreateBox('preview_stronghold', { width: 56, depth: 56, height: 28 }, scene))
    stronghold.position = new Vector3(nextLevel.map.playerHQ.x, 14, nextLevel.map.playerHQ.y)
    stronghold.material = trackMaterial(createColorMaterial(scene, 'preview_stronghold_mat', '#2563eb', 0.88, 0.45))
  }

  const regenerate = (nextLevel: LevelDefinition, nextOptionsInput?: LevelPreviewOptions) => {
    const nextOptions = resolveOptions(nextOptionsInput)
    disposeGenerated()

    const mapWidth = Math.max(1, nextLevel.map.width)
    const mapHeight = Math.max(1, nextLevel.map.height)
    ground.scaling = new Vector3(mapWidth, 1, mapHeight)
    ground.position = new Vector3(mapWidth * 0.5, 0, mapHeight * 0.5)

    let bounds = computeBounds(nextLevel)
    buildStronghold(nextLevel)
    bounds = buildObstacles(nextLevel, nextOptions, bounds)
    bounds = buildPads(nextLevel, nextOptions, bounds)
    bounds = buildSpawnIndicators(nextLevel, nextOptions, bounds)
    buildPaths(nextLevel, nextOptions)

    activeBounds = bounds
    fitToBounds()
  }

  regenerate(levelConfig, options)

  return {
    engine,
    scene,
    regenerate,
    fitToBounds,
    dispose: () => {
      engine.stopRenderLoop()
      disposeGenerated()
      ground.dispose()
      groundMaterial.dispose()
      groundGrid.dispose()
      scene.dispose()
      engine.dispose()
    }
  }
}
