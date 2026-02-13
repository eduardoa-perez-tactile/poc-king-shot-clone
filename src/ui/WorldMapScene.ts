import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Material } from '@babylonjs/core/Materials/material'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Scene } from '@babylonjs/core/scene'
import { Engine } from '@babylonjs/core/Engines/engine'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { MissionNodeDef, WorldTileDef } from './worldMapData'
import type { MissionNodeState } from './worldProgression'

const CAMERA_ALPHA = -Math.PI / 4
const CAMERA_BETA = 1.02
const CAMERA_RADIUS = 30
const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.2

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

type MissionMetadata = { missionId: string }

type WorldMapSceneInput = {
  canvas: HTMLCanvasElement
  tiles: WorldTileDef[]
  missions: MissionNodeDef[]
  missionStates: Record<string, MissionNodeState>
  selectedMissionId: string | null
  onMissionPicked: (missionId: string) => void
  onMissionHovered?: (missionId: string | null) => void
}

export type WorldMapSceneController = {
  engine: Engine
  scene: Scene
  resize: (width: number, height: number) => void
  setMissionStates: (missionStates: Record<string, MissionNodeState>) => void
  setSelectedMission: (missionId: string | null) => void
  dispose: () => void
}

type NodeVisual = {
  root: TransformNode
  box: AbstractMesh
  indicator: AbstractMesh
}

type CameraBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const createColorMaterial = (
  scene: Scene,
  name: string,
  hex: string,
  emissive = 0.15,
  alpha = 1
) => {
  const material = new StandardMaterial(name, scene)
  const color = Color3.FromHexString(hex)
  material.diffuseColor = color
  material.emissiveColor = color.scale(emissive)
  material.specularColor = new Color3(0.08, 0.08, 0.08)
  material.alpha = alpha
  material.transparencyMode = Material.MATERIAL_ALPHABLEND
  return material
}

const createLabelMaterial = (scene: Scene, name: string, text: string) => {
  const texture = new DynamicTexture(`${name}_texture`, { width: 512, height: 128 }, scene, true)
  texture.hasAlpha = true
  const ctx = texture.getContext()
  ctx.clearRect(0, 0, 512, 128)
  ctx.fillStyle = 'rgba(2, 6, 23, 0.74)'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, 508, 124)
  ctx.font = "bold 42px 'Space Mono', monospace"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = '#020617'
  ctx.strokeText(text, 256, 64)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText(text, 256, 64)
  texture.update()

  const material = new StandardMaterial(`${name}_material`, scene)
  material.diffuseTexture = texture
  material.opacityTexture = texture
  material.disableLighting = true
  material.backFaceCulling = false
  material.emissiveColor = Color3.White().scale(0.95)
  material.transparencyMode = Material.MATERIAL_ALPHABLEND
  return { material, texture }
}

const createGroundTexture = (scene: Scene) => {
  const texture = new DynamicTexture('world_map_ground_texture', { width: 1024, height: 512 }, scene, false)
  const ctx = texture.getContext()
  ctx.fillStyle = '#1a2830'
  ctx.fillRect(0, 0, 1024, 512)

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
  ctx.lineWidth = 1
  for (let x = 0; x <= 1024; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }
  for (let y = 0; y <= 512; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(1024, y)
    ctx.stroke()
  }

  texture.update()
  return texture
}

const computeBounds = (tiles: WorldTileDef[], missions: MissionNodeDef[]): CameraBounds => {
  const seed: CameraBounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY
  }

  const withTiles = tiles.reduce((acc, tile) => {
    const halfW = tile.size.w * 0.5
    const halfH = tile.size.h * 0.5
    return {
      minX: Math.min(acc.minX, tile.position.x - halfW),
      maxX: Math.max(acc.maxX, tile.position.x + halfW),
      minZ: Math.min(acc.minZ, tile.position.z - halfH),
      maxZ: Math.max(acc.maxZ, tile.position.z + halfH)
    }
  }, seed)

  const withMissions = missions.reduce((acc, mission) => {
    return {
      minX: Math.min(acc.minX, mission.position.x - 1.2),
      maxX: Math.max(acc.maxX, mission.position.x + 1.2),
      minZ: Math.min(acc.minZ, mission.position.z - 1.2),
      maxZ: Math.max(acc.maxZ, mission.position.z + 1.2)
    }
  }, withTiles)

  if (!Number.isFinite(withMissions.minX) || !Number.isFinite(withMissions.minZ)) {
    return { minX: -8, maxX: 8, minZ: -5, maxZ: 5 }
  }

  return withMissions
}

export const createWorldMapScene = ({
  canvas,
  tiles,
  missions,
  missionStates,
  selectedMissionId,
  onMissionPicked,
  onMissionHovered
}: WorldMapSceneInput): WorldMapSceneController => {
  const engine = new Engine(canvas, true, { antialias: true }, true)
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.05, 0.07, 0.12, 1)

  const bounds = computeBounds(tiles, missions)
  const centerX = (bounds.minX + bounds.maxX) * 0.5
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5
  const worldWidth = Math.max(10, bounds.maxX - bounds.minX + 6)
  const worldDepth = Math.max(8, bounds.maxZ - bounds.minZ + 6)

  const camera = new ArcRotateCamera('world_map_camera', CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, new Vector3(centerX, 0, centerZ), scene)
  camera.mode = BabylonCamera.ORTHOGRAPHIC_CAMERA
  camera.inputs.clear()
  camera.minZ = 0.1
  camera.maxZ = 200
  camera.panningInertia = 0
  camera.inertia = 0
  camera.setTarget(new Vector3(centerX, 0, centerZ))
  scene.activeCamera = camera

  const hemi = new HemisphericLight('world_map_hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.95
  const sun = new DirectionalLight('world_map_sun', new Vector3(-0.3, -1, 0.3), scene)
  sun.intensity = 0.42

  const groundTexture = createGroundTexture(scene)
  const groundMaterial = createColorMaterial(scene, 'world_ground_material', '#2f4f4f', 0.06, 1)
  groundMaterial.diffuseTexture = groundTexture
  groundMaterial.diffuseColor = Color3.White()

  const ground = MeshBuilder.CreateGround('world_ground', { width: worldWidth, height: worldDepth }, scene)
  ground.position = new Vector3(centerX, 0, centerZ)
  ground.material = groundMaterial
  ground.isPickable = false

  const boxLockedMaterial = createColorMaterial(scene, 'world_mission_locked', '#64748b', 0.08)
  const boxAvailableMaterial = createColorMaterial(scene, 'world_mission_available', '#38bdf8', 0.3)
  const boxCompletedMaterial = createColorMaterial(scene, 'world_mission_completed', '#eab308', 0.35)

  const indicatorLockedMaterial = createColorMaterial(scene, 'world_indicator_locked', '#4b5563', 0.06)
  const indicatorAvailableMaterial = createColorMaterial(scene, 'world_indicator_available', '#7dd3fc', 0.45)
  const indicatorCompletedMaterial = createColorMaterial(scene, 'world_indicator_completed', '#facc15', 0.5)

  const kingMaterial = createColorMaterial(scene, 'world_king_marker', '#fb923c', 0.35)

  const boxPrototype = MeshBuilder.CreateBox('world_mission_box_proto', { width: 1, height: 1, depth: 1 }, scene)
  boxPrototype.isVisible = false
  boxPrototype.isPickable = false

  const indicatorPrototype = MeshBuilder.CreateBox('world_mission_indicator_proto', { width: 0.3, height: 0.2, depth: 0.3 }, scene)
  indicatorPrototype.isVisible = false
  indicatorPrototype.isPickable = false

  const nodeVisuals = new Map<string, NodeVisual>()
  const nodePositions = new Map<string, Vector3>()
  const generatedLabelTextures: DynamicTexture[] = []
  const generatedLabelMaterials: StandardMaterial[] = []

  missions.forEach((mission) => {
    const root = new TransformNode(`world_node_root_${mission.id}`, scene)
    root.position = new Vector3(mission.position.x, mission.position.y, mission.position.z)

    const box = boxPrototype.createInstance(`world_mission_box_${mission.id}`)
    box.parent = root
    box.position = new Vector3(0, 0.5, 0)
    box.isPickable = true
    box.metadata = { missionId: mission.id } satisfies MissionMetadata

    const indicator = indicatorPrototype.createInstance(`world_mission_indicator_${mission.id}`)
    indicator.parent = root
    indicator.position = new Vector3(0, 1.15, 0)
    indicator.isPickable = true
    indicator.metadata = { missionId: mission.id } satisfies MissionMetadata

    const label = MeshBuilder.CreatePlane(`world_mission_label_${mission.id}`, { width: 3, height: 0.7 }, scene)
    label.parent = root
    label.position = new Vector3(0, 1.85, 0)
    label.billboardMode = Mesh.BILLBOARDMODE_ALL
    label.isPickable = false

    const { material, texture } = createLabelMaterial(scene, `world_mission_label_${mission.id}`, mission.name)
    label.material = material
    generatedLabelMaterials.push(material)
    generatedLabelTextures.push(texture)

    nodeVisuals.set(mission.id, { root, box, indicator })
    nodePositions.set(mission.id, root.position.clone())
  })

  const kingMarker = MeshBuilder.CreateCylinder('world_king_marker', {
    diameterTop: 0,
    diameterBottom: 0.48,
    height: 0.95,
    tessellation: 8
  }, scene)
  kingMarker.material = kingMaterial
  kingMarker.position = new Vector3(centerX, 0.8, centerZ)
  kingMarker.isPickable = false

  let markerTarget = kingMarker.position.clone()
  let hoverMissionId: string | null = null
  let selectedNodeId: string | null = selectedMissionId
  let zoom = 1
  let selectedStates = { ...missionStates }

  const applyOrtho = () => {
    const halfHeightBase = Math.max(worldDepth * 0.5, 5)
    const halfHeight = clamp(halfHeightBase / zoom, 3, 24)
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())
    const halfWidth = halfHeight * Math.max(0.1, aspect)
    camera.orthoLeft = -halfWidth
    camera.orthoRight = halfWidth
    camera.orthoBottom = -halfHeight
    camera.orthoTop = halfHeight
  }

  const clampCameraTarget = () => {
    const halfWidth = Math.abs(camera.orthoRight - camera.orthoLeft) * 0.5
    const halfHeight = Math.abs(camera.orthoTop - camera.orthoBottom) * 0.5

    const minX = bounds.minX + halfWidth
    const maxX = bounds.maxX - halfWidth
    const minZ = bounds.minZ + halfHeight
    const maxZ = bounds.maxZ - halfHeight

    if (minX > maxX) {
      camera.target.x = centerX
    } else {
      camera.target.x = clamp(camera.target.x, minX, maxX)
    }

    if (minZ > maxZ) {
      camera.target.z = centerZ
    } else {
      camera.target.z = clamp(camera.target.z, minZ, maxZ)
    }
  }

  const refreshNodeVisual = (missionId: string) => {
    const visual = nodeVisuals.get(missionId)
    if (!visual) return

    const state = selectedStates[missionId] ?? 'locked'
    const isSelected = selectedNodeId === missionId
    const isHovered = hoverMissionId === missionId

    visual.box.material =
      state === 'completed'
        ? boxCompletedMaterial
        : state === 'available'
          ? boxAvailableMaterial
          : boxLockedMaterial

    visual.indicator.material =
      state === 'completed'
        ? indicatorCompletedMaterial
        : state === 'available'
          ? indicatorAvailableMaterial
          : indicatorLockedMaterial

    const scale = isSelected ? 1.18 : isHovered ? 1.09 : 1
    visual.root.scaling.set(scale, scale, scale)
  }

  const refreshAllNodes = () => {
    missions.forEach((mission) => {
      refreshNodeVisual(mission.id)
    })
  }

  const setMarkerTarget = (missionId: string | null) => {
    if (!missionId) return
    const target = nodePositions.get(missionId)
    if (!target) return
    markerTarget = new Vector3(target.x + 0.55, target.y + 0.95, target.z)
  }

  const pickMissionAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const picked = scene.pick(x, y, (mesh) => {
      const metadata = mesh.metadata as MissionMetadata | undefined
      return Boolean(metadata?.missionId)
    })
    if (!picked?.hit || !picked.pickedMesh) return null
    const metadata = picked.pickedMesh.metadata as MissionMetadata | undefined
    return metadata?.missionId ?? null
  }

  applyOrtho()
  clampCameraTarget()
  refreshAllNodes()
  setMarkerTarget(selectedNodeId)

  let isPanning = false
  let panPointerId: number | null = null
  let lastPanX = 0
  let lastPanY = 0

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button === 1 || event.button === 2) {
      isPanning = true
      panPointerId = event.pointerId
      lastPanX = event.clientX
      lastPanY = event.clientY
      canvas.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }

    if (event.button !== 0) return
    const missionId = pickMissionAt(event.clientX, event.clientY)
    if (!missionId) return
    onMissionPicked(missionId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (isPanning && panPointerId === event.pointerId) {
      const dx = event.clientX - lastPanX
      const dy = event.clientY - lastPanY
      lastPanX = event.clientX
      lastPanY = event.clientY

      const width = Math.max(1, engine.getRenderWidth())
      const height = Math.max(1, engine.getRenderHeight())
      const worldPerPxX = Math.abs(camera.orthoRight - camera.orthoLeft) / width
      const worldPerPxY = Math.abs(camera.orthoTop - camera.orthoBottom) / height

      camera.target.x -= dx * worldPerPxX
      camera.target.z += dy * worldPerPxY
      clampCameraTarget()
      return
    }

    const nextHoverMissionId = pickMissionAt(event.clientX, event.clientY)
    if (hoverMissionId === nextHoverMissionId) return
    hoverMissionId = nextHoverMissionId
    onMissionHovered?.(hoverMissionId)
    refreshAllNodes()
  }

  const handlePointerUp = (event: PointerEvent) => {
    if (panPointerId !== event.pointerId) return
    isPanning = false
    panPointerId = null
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: WheelEvent) => {
    if (event.target !== canvas) return
    event.preventDefault()
    zoom = clamp(zoom - event.deltaY * 0.0014, MIN_ZOOM, MAX_ZOOM)
    applyOrtho()
    clampCameraTarget()
  }

  const handlePointerLeave = () => {
    if (hoverMissionId === null) return
    hoverMissionId = null
    onMissionHovered?.(null)
    refreshAllNodes()
  }

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
  }

  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointercancel', handlePointerUp)
  canvas.addEventListener('pointerleave', handlePointerLeave)
  canvas.addEventListener('wheel', handleWheel, { passive: false })
  canvas.addEventListener('contextmenu', handleContextMenu)

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000)
    kingMarker.position = Vector3.Lerp(kingMarker.position, markerTarget, Math.min(1, dt * 4.8))
    kingMarker.rotation.y += dt * 0.8

    const pulse = 0.6 + 0.22 * Math.sin(performance.now() * 0.004)
    boxAvailableMaterial.emissiveColor = Color3.FromHexString('#38bdf8').scale(pulse)
    indicatorAvailableMaterial.emissiveColor = Color3.FromHexString('#7dd3fc').scale(pulse + 0.1)
  })

  engine.runRenderLoop(() => {
    scene.render()
  })

  return {
    engine,
    scene,
    resize: (width: number, height: number) => {
      canvas.style.width = `${Math.max(1, Math.floor(width))}px`
      canvas.style.height = `${Math.max(1, Math.floor(height))}px`
      engine.resize()
      applyOrtho()
      clampCameraTarget()
    },
    setMissionStates: (nextMissionStates: Record<string, MissionNodeState>) => {
      selectedStates = { ...nextMissionStates }
      refreshAllNodes()
    },
    setSelectedMission: (missionId: string | null) => {
      selectedNodeId = missionId
      setMarkerTarget(missionId)
      refreshAllNodes()
    },
    dispose: () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)

      groundTexture.dispose()
      generatedLabelTextures.forEach((texture) => texture.dispose())
      generatedLabelMaterials.forEach((material) => material.dispose())

      scene.dispose()
      engine.dispose()
    }
  }
}
