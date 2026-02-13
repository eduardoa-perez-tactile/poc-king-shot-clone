import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
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
import type { MissionNodeDef, WorldBiome, WorldTileDef } from './worldMapData'
import type { MissionNodeState } from './worldProgression'

const CAMERA_ALPHA = -Math.PI / 4
const CAMERA_BETA = 1.05
const CAMERA_RADIUS = 36
const MIN_ZOOM = 0.65
const MAX_ZOOM = 2.4

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
  node: AbstractMesh
  ring: AbstractMesh
  badge: AbstractMesh
  lockBody: AbstractMesh
  lockShackle: AbstractMesh
}

type CameraBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const BIOME_COLOR: Record<WorldBiome, string> = {
  grass: '#4a9f6b',
  desert: '#b78d4a',
  snow: '#9bb6cf',
  swamp: '#4d7460'
}

const createColorMaterial = (
  scene: Scene,
  name: string,
  hex: string,
  emissive = 0.18,
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
  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.75)'
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

const computeBounds = (tiles: WorldTileDef[]): CameraBounds => {
  return tiles.reduce<CameraBounds>((acc, tile) => {
    const halfW = tile.size.w * 0.5
    const halfH = tile.size.h * 0.5
    return {
      minX: Math.min(acc.minX, tile.position.x - halfW),
      maxX: Math.max(acc.maxX, tile.position.x + halfW),
      minZ: Math.min(acc.minZ, tile.position.z - halfH),
      maxZ: Math.max(acc.maxZ, tile.position.z + halfH)
    }
  }, {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY
  })
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

  const bounds = computeBounds(tiles)
  const centerX = (bounds.minX + bounds.maxX) * 0.5
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5
  const boardWidth = bounds.maxX - bounds.minX
  const boardDepth = bounds.maxZ - bounds.minZ

  const camera = new ArcRotateCamera('world_map_camera', CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, new Vector3(centerX, 0, centerZ), scene)
  camera.mode = BabylonCamera.ORTHOGRAPHIC_CAMERA
  camera.inputs.clear()
  camera.minZ = 0.1
  camera.maxZ = 300
  camera.panningInertia = 0
  camera.inertia = 0
  camera.setTarget(new Vector3(centerX, 0, centerZ))
  scene.activeCamera = camera

  const hemi = new HemisphericLight('world_map_hemi', new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.95
  const sun = new DirectionalLight('world_map_sun', new Vector3(-0.3, -1, 0.35), scene)
  sun.intensity = 0.5

  const boardMaterial = createColorMaterial(scene, 'world_board_material', '#1f2937', 0.12, 1)
  const board = MeshBuilder.CreateBox('world_board_base', {
    width: boardWidth + 3.5,
    depth: boardDepth + 3.5,
    height: 0.55
  }, scene)
  board.position = new Vector3(centerX, -0.3, centerZ)
  board.material = boardMaterial
  board.isPickable = false

  const tileMaterials = new Map<WorldBiome, StandardMaterial>()
  ;(['grass', 'desert', 'snow', 'swamp'] as WorldBiome[]).forEach((biome) => {
    tileMaterials.set(biome, createColorMaterial(scene, `world_tile_mat_${biome}`, BIOME_COLOR[biome], 0.22, 1))
  })

  const tileGroups = new Map<WorldBiome, WorldTileDef[]>()
  tiles.forEach((tile) => {
    const bucket = tileGroups.get(tile.biome)
    if (bucket) {
      bucket.push(tile)
    } else {
      tileGroups.set(tile.biome, [tile])
    }
  })

  const generatedLabelTextures: DynamicTexture[] = []
  const generatedLabelMaterials: StandardMaterial[] = []

  tileGroups.forEach((group, biome) => {
    const mesh = MeshBuilder.CreateBox(`world_tile_group_${biome}`, { width: 1, depth: 1, height: 1 }, scene)
    mesh.isPickable = false
    mesh.material = tileMaterials.get(biome) ?? null

    const [baseTile, ...instanceTiles] = group
    mesh.scaling = new Vector3(baseTile.size.w, baseTile.height, baseTile.size.h)
    mesh.position = new Vector3(baseTile.position.x, baseTile.position.y + baseTile.height * 0.5, baseTile.position.z)

    if (instanceTiles.length > 0) {
      const matrixBuffer = new Float32Array(instanceTiles.length * 16)
      instanceTiles.forEach((tile, index) => {
        const matrix = Matrix.Compose(
          new Vector3(tile.size.w, tile.height, tile.size.h),
          Quaternion.Identity(),
          new Vector3(tile.position.x, tile.position.y + tile.height * 0.5, tile.position.z)
        )
        matrix.copyToArray(matrixBuffer, index * 16)
      })
      mesh.thinInstanceSetBuffer('matrix', matrixBuffer, 16, true)
    }
  })

  const nodeLockedMaterial = createColorMaterial(scene, 'world_node_locked', '#64748b', 0.08)
  const nodeAvailableMaterial = createColorMaterial(scene, 'world_node_available', '#38bdf8', 0.26)
  const nodeCompletedMaterial = createColorMaterial(scene, 'world_node_completed', '#facc15', 0.3)
  const ringLockedMaterial = createColorMaterial(scene, 'world_ring_locked', '#6b7280', 0.06)
  const ringAvailableMaterial = createColorMaterial(scene, 'world_ring_available', '#7dd3fc', 0.35)
  const ringCompletedMaterial = createColorMaterial(scene, 'world_ring_completed', '#eab308', 0.4)
  const badgeMaterial = createColorMaterial(scene, 'world_badge', '#fef08a', 0.55)
  const lockMaterial = createColorMaterial(scene, 'world_lock', '#94a3b8', 0.16)
  const kingMaterial = createColorMaterial(scene, 'world_king_marker', '#fb923c', 0.35)

  const nodePrototype = MeshBuilder.CreateSphere('world_node_proto', { diameter: 0.7, segments: 8 }, scene)
  nodePrototype.isVisible = false
  nodePrototype.isPickable = false

  const ringPrototype = MeshBuilder.CreateTorus('world_ring_proto', { diameter: 1.05, thickness: 0.1, tessellation: 20 }, scene)
  ringPrototype.isVisible = false
  ringPrototype.isPickable = false

  const badgePrototype = MeshBuilder.CreateDisc('world_badge_proto', { radius: 0.18, tessellation: 5 }, scene)
  badgePrototype.isVisible = false
  badgePrototype.isPickable = false

  const lockBodyPrototype = MeshBuilder.CreateBox('world_lock_body_proto', { width: 0.2, height: 0.18, depth: 0.12 }, scene)
  lockBodyPrototype.isVisible = false
  lockBodyPrototype.isPickable = false

  const lockShacklePrototype = MeshBuilder.CreateTorus('world_lock_shackle_proto', { diameter: 0.2, thickness: 0.045, tessellation: 18 }, scene)
  lockShacklePrototype.isVisible = false
  lockShacklePrototype.isPickable = false

  const nodeVisuals = new Map<string, NodeVisual>()
  const nodePositions = new Map<string, Vector3>()

  missions.forEach((mission) => {
    const root = new TransformNode(`world_node_root_${mission.id}`, scene)
    root.position = new Vector3(mission.position.x, mission.position.y, mission.position.z)

    const node = nodePrototype.createInstance(`world_node_${mission.id}`)
    node.parent = root
    node.position = new Vector3(0, 0.4, 0)
    node.isPickable = true
    node.metadata = { missionId: mission.id } satisfies MissionMetadata

    const ring = ringPrototype.createInstance(`world_ring_${mission.id}`)
    ring.parent = root
    ring.position = new Vector3(0, 0.1, 0)
    ring.rotation = new Vector3(Math.PI * 0.5, 0, 0)
    ring.isPickable = true
    ring.metadata = { missionId: mission.id } satisfies MissionMetadata

    const badge = badgePrototype.createInstance(`world_badge_${mission.id}`)
    badge.parent = root
    badge.position = new Vector3(0.42, 0.7, 0)
    badge.rotation = new Vector3(Math.PI * 0.5, 0, 0)
    badge.material = badgeMaterial
    badge.isPickable = false

    const lockBody = lockBodyPrototype.createInstance(`world_lock_body_${mission.id}`)
    lockBody.parent = root
    lockBody.position = new Vector3(0, 0.78, 0)
    lockBody.material = lockMaterial
    lockBody.isPickable = false

    const lockShackle = lockShacklePrototype.createInstance(`world_lock_shackle_${mission.id}`)
    lockShackle.parent = root
    lockShackle.position = new Vector3(0, 0.9, 0)
    lockShackle.rotation = new Vector3(Math.PI * 0.5, 0, 0)
    lockShackle.material = lockMaterial
    lockShackle.isPickable = false

    const label = MeshBuilder.CreatePlane(`world_label_${mission.id}`, { width: 2.8, height: 0.7 }, scene)
    label.parent = root
    label.position = new Vector3(0, 1.4, 0)
    label.billboardMode = Mesh.BILLBOARDMODE_ALL
    label.isPickable = false
    const { material, texture } = createLabelMaterial(scene, `world_label_${mission.id}`, mission.name)
    label.material = material
    generatedLabelMaterials.push(material)
    generatedLabelTextures.push(texture)

    nodeVisuals.set(mission.id, {
      root,
      node,
      ring,
      badge,
      lockBody,
      lockShackle
    })

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
    const halfHeightBase = Math.max(boardDepth * 0.48, 5.2)
    const halfHeight = clamp(halfHeightBase / zoom, 2.8, 24)
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

    visual.node.material =
      state === 'completed'
        ? nodeCompletedMaterial
        : state === 'available'
          ? nodeAvailableMaterial
          : nodeLockedMaterial

    visual.ring.material =
      state === 'completed'
        ? ringCompletedMaterial
        : state === 'available'
          ? ringAvailableMaterial
          : ringLockedMaterial

    visual.badge.setEnabled(state === 'completed')
    visual.lockBody.setEnabled(state === 'locked')
    visual.lockShackle.setEnabled(state === 'locked')

    const scale = isSelected ? 1.16 : isHovered ? 1.08 : 1
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
    markerTarget = new Vector3(target.x + 0.46, target.y + 0.95, target.z)
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
    kingMarker.position = Vector3.Lerp(kingMarker.position, markerTarget, Math.min(1, dt * 4.5))
    kingMarker.rotation.y += dt * 0.8

    const pulse = 0.6 + 0.25 * Math.sin(performance.now() * 0.004)
    nodeAvailableMaterial.emissiveColor = Color3.FromHexString('#38bdf8').scale(pulse)
    ringAvailableMaterial.emissiveColor = Color3.FromHexString('#7dd3fc').scale(pulse + 0.1)
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

      generatedLabelTextures.forEach((texture) => texture.dispose())
      generatedLabelMaterials.forEach((material) => material.dispose())

      scene.dispose()
      engine.dispose()
    }
  }
}
