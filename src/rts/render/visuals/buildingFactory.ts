import { Scene } from '@babylonjs/core/scene'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { BuildingId } from '../../../config/buildings'

export type BuildingCategory = 'economy' | 'military' | 'utility' | 'hero' | 'stronghold'

export interface BuildingVisualDef {
  category: BuildingCategory
  build: (ctx: BuildContext) => number
}

interface BuildContext {
  scene: Scene
  root: TransformNode
  footprint: { w: number; d: number; h: number }
  materials: BuildingMaterials
}

interface BuildingMaterials {
  economy: StandardMaterial
  military: StandardMaterial
  utility: StandardMaterial
  hero: StandardMaterial
  stronghold: StandardMaterial
  wood: StandardMaterial
  stone: StandardMaterial
  roof: StandardMaterial
  accent: StandardMaterial
  basePlate: StandardMaterial
  rune: StandardMaterial
}

interface LabelMesh {
  mesh: Mesh
  texture: DynamicTexture
  text: string
}

export interface BuildingVisualInstance {
  root: TransformNode
  basePlate: Mesh
  levelBadge: LabelMesh
  height: number
  setLevel: (level: number) => void
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

const createMaterial = (scene: Scene, name: string, color: Color3, emissive = 0.15, alpha = 1) => {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(emissive)
  mat.specularColor = new Color3(0.12, 0.12, 0.12)
  mat.alpha = alpha
  return mat
}

const createLabel = (scene: Scene, name: string) => {
  const texture = new DynamicTexture(name, { width: 256, height: 128 }, scene, true)
  texture.hasAlpha = true
  const mat = new StandardMaterial(`${name}_mat`, scene)
  mat.diffuseTexture = texture
  mat.opacityTexture = texture
  mat.emissiveColor = Color3.White()
  mat.backFaceCulling = false
  const mesh = MeshBuilder.CreatePlane(name, { width: 18, height: 8 }, scene)
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
  mesh.isPickable = false
  return { mesh, texture, text: '' }
}

const drawLabel = (texture: DynamicTexture, text: string, color: string) => {
  const size = texture.getSize()
  const ctx = texture.getContext()
  ctx.clearRect(0, 0, size.width, size.height)
  ctx.font = `64px 'Space Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 6
  ctx.strokeStyle = '#0f172a'
  ctx.strokeText(text, size.width / 2, size.height / 2)
  ctx.fillStyle = color
  ctx.fillText(text, size.width / 2, size.height / 2)
  texture.update()
}

let partId = 0

const addBox = (
  ctx: BuildContext,
  size: { w: number; d: number; h: number },
  position: Vector3,
  material: StandardMaterial
) => {
  const mesh = MeshBuilder.CreateBox(`b_box_${partId++}`, { width: size.w, depth: size.d, height: size.h }, ctx.scene)
  mesh.material = material
  mesh.position = position
  mesh.isPickable = false
  mesh.parent = ctx.root
  return mesh
}

const addCylinder = (
  ctx: BuildContext,
  size: { d: number; h: number; t?: number },
  position: Vector3,
  material: StandardMaterial
) => {
  const mesh = MeshBuilder.CreateCylinder(
    `b_cyl_${partId++}`,
    { diameter: size.d, height: size.h, tessellation: size.t ?? 16 },
    ctx.scene
  )
  mesh.material = material
  mesh.position = position
  mesh.isPickable = false
  mesh.parent = ctx.root
  return mesh
}

const addRoof = (ctx: BuildContext, size: { w: number; d: number; h: number }, position: Vector3, material: StandardMaterial) => {
  const mesh = MeshBuilder.CreateCylinder(
    `b_roof_${partId++}`,
    { diameter: size.w, height: size.d, tessellation: 3 },
    ctx.scene
  )
  mesh.material = material
  mesh.rotation.z = Math.PI / 2
  mesh.scaling = new Vector3(1, 0.8, size.h / size.d)
  mesh.position = position
  mesh.isPickable = false
  mesh.parent = ctx.root
  return mesh
}

const buildGoldMine = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  let height = 0
  addBox(ctx, { w: w * 0.3, d: d * 0.3, h: h * 0.4 }, new Vector3(-w * 0.12, h * 0.2, 0), ctx.materials.stone)
  addBox(ctx, { w: w * 0.25, d: d * 0.25, h: h * 0.35 }, new Vector3(w * 0.18, h * 0.18, -d * 0.1), ctx.materials.stone)
  addBox(ctx, { w: w * 0.2, d: d * 0.2, h: h * 0.3 }, new Vector3(0, h * 0.16, d * 0.2), ctx.materials.stone)
  addBox(ctx, { w: w * 0.18, d: d * 0.12, h: h * 0.12 }, new Vector3(w * 0.05, h * 0.38, 0), ctx.materials.economy)
  const frame = addBox(ctx, { w: w * 0.08, d: d * 0.6, h: h * 0.7 }, new Vector3(-w * 0.3, h * 0.35, 0), ctx.materials.wood)
  const beam = addBox(ctx, { w: w * 0.42, d: d * 0.08, h: h * 0.08 }, new Vector3(-w * 0.08, h * 0.62, 0), ctx.materials.wood)
  height = Math.max(height, frame.position.y + h * 0.35, beam.position.y + h * 0.05)
  return height + h * 0.4
}

const buildHouse = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addBox(ctx, { w: w * 0.55, d: d * 0.5, h: h * 0.6 }, new Vector3(0, h * 0.3, 0), ctx.materials.utility)
  addRoof(
    ctx,
    { w: w * 0.6, d: d * 0.6, h: h * 0.3 },
    new Vector3(0, h * 0.75, 0),
    ctx.materials.roof
  )
  return h * 0.9
}

const buildBarracks = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addBox(ctx, { w: w * 0.8, d: d * 0.45, h: h * 0.55 }, new Vector3(0, h * 0.275, -d * 0.05), ctx.materials.military)
  addBox(ctx, { w: w * 0.7, d: d * 0.32, h: 1 }, new Vector3(0, 0.5, d * 0.3), ctx.materials.accent)
  return h * 0.6
}

const buildRange = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addBox(ctx, { w: w * 0.4, d: d * 0.35, h: h * 0.65 }, new Vector3(-w * 0.1, h * 0.33, 0), ctx.materials.military)
  addCylinder(ctx, { d: w * 0.28, h: h * 0.5 }, new Vector3(w * 0.2, h * 0.25, -d * 0.2), ctx.materials.military)
  addCylinder(ctx, { d: w * 0.22, h: 2, t: 20 }, new Vector3(w * 0.25, h * 0.3, d * 0.28), ctx.materials.accent)
  return h * 0.8
}

const buildStable = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addBox(ctx, { w: w * 0.7, d: d * 0.55, h: h * 0.6 }, new Vector3(0, h * 0.3, 0), ctx.materials.utility)
  addRoof(
    ctx,
    { w: w * 0.7, d: d * 0.6, h: h * 0.25 },
    new Vector3(0, h * 0.75, 0),
    ctx.materials.roof
  )
  const fenceOffset = d * 0.34
  addBox(ctx, { w: w * 0.6, d: d * 0.06, h: 3 }, new Vector3(0, 1.5, fenceOffset), ctx.materials.wood)
  addBox(ctx, { w: w * 0.6, d: d * 0.06, h: 3 }, new Vector3(0, 1.5, -fenceOffset), ctx.materials.wood)
  return h * 0.9
}

const buildWatchtower = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addCylinder(ctx, { d: w * 0.3, h: h * 1.4 }, new Vector3(0, h * 0.7, 0), ctx.materials.military)
  addBox(ctx, { w: w * 0.5, d: d * 0.4, h: h * 0.2 }, new Vector3(0, h * 1.45, 0), ctx.materials.accent)
  return h * 1.6
}

const buildBlacksmith = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addBox(ctx, { w: w * 0.6, d: d * 0.5, h: h * 0.6 }, new Vector3(0, h * 0.3, 0), ctx.materials.utility)
  addCylinder(ctx, { d: w * 0.15, h: h * 0.6 }, new Vector3(w * 0.22, h * 0.6, -d * 0.1), ctx.materials.stone)
  addBox(ctx, { w: w * 0.2, d: d * 0.2, h: h * 0.1 }, new Vector3(-w * 0.2, h * 0.12, d * 0.2), ctx.materials.accent)
  return h * 0.9
}

const buildWall = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  const wallWidth = w * 1.15
  const wallDepth = d * 0.34
  const wallHeight = h * 0.95
  addBox(ctx, { w: wallWidth, d: wallDepth, h: wallHeight }, new Vector3(0, wallHeight * 0.5, 0), ctx.materials.stone)
  addBox(
    ctx,
    { w: wallWidth * 0.98, d: wallDepth * 0.72, h: wallHeight * 0.18 },
    new Vector3(0, wallHeight * 0.92, 0),
    ctx.materials.accent
  )
  const buttressDepth = wallDepth * 0.82
  addBox(
    ctx,
    { w: wallWidth * 0.12, d: buttressDepth, h: wallHeight * 0.35 },
    new Vector3(-wallWidth * 0.38, wallHeight * 0.18, 0),
    ctx.materials.stone
  )
  addBox(
    ctx,
    { w: wallWidth * 0.12, d: buttressDepth, h: wallHeight * 0.35 },
    new Vector3(wallWidth * 0.38, wallHeight * 0.18, 0),
    ctx.materials.stone
  )
  return wallHeight
}

const buildHeroRecruiter = (ctx: BuildContext) => {
  const { w, d, h } = ctx.footprint
  addCylinder(ctx, { d: w * 0.5, h: h * 0.2 }, new Vector3(0, h * 0.1, 0), ctx.materials.hero)
  const col = w * 0.08
  const colHeight = h * 0.6
  addCylinder(ctx, { d: col, h: colHeight }, new Vector3(-w * 0.18, h * 0.4, -d * 0.18), ctx.materials.hero)
  addCylinder(ctx, { d: col, h: colHeight }, new Vector3(w * 0.18, h * 0.4, -d * 0.18), ctx.materials.hero)
  addCylinder(ctx, { d: col, h: colHeight }, new Vector3(-w * 0.18, h * 0.4, d * 0.18), ctx.materials.hero)
  addCylinder(ctx, { d: col, h: colHeight }, new Vector3(w * 0.18, h * 0.4, d * 0.18), ctx.materials.hero)
  const ring = MeshBuilder.CreateTorus(`hero_ring_${partId++}`, { diameter: w * 0.55, thickness: 0.8, tessellation: 32 }, ctx.scene)
  ring.material = ctx.materials.rune
  ring.rotation.x = Math.PI / 2
  ring.position = new Vector3(0, h * 0.75, 0)
  ring.isPickable = false
  ring.parent = ctx.root
  return h * 0.9
}

export const buildingVisuals: Record<BuildingId, BuildingVisualDef> = {
  gold_mine: { category: 'economy', build: buildGoldMine },
  house: { category: 'utility', build: buildHouse },
  barracks: { category: 'military', build: buildBarracks },
  range: { category: 'military', build: buildRange },
  stable: { category: 'utility', build: buildStable },
  watchtower: { category: 'military', build: buildWatchtower },
  wall: { category: 'utility', build: buildWall },
  blacksmith: { category: 'utility', build: buildBlacksmith },
  hero_recruiter: { category: 'hero', build: buildHeroRecruiter }
}

export const createBuildingFactory = (scene: Scene) => {
  const materials: BuildingMaterials = {
    economy: createMaterial(scene, 'b_econ', Color3.FromHexString('#b45309'), 0.2),
    military: createMaterial(scene, 'b_mil', Color3.FromHexString('#1d4ed8'), 0.25),
    utility: createMaterial(scene, 'b_util', Color3.FromHexString('#475569'), 0.15),
    hero: createMaterial(scene, 'b_hero', Color3.FromHexString('#f59e0b'), 0.35),
    stronghold: createMaterial(scene, 'b_hq', Color3.FromHexString('#2563eb'), 0.4),
    wood: createMaterial(scene, 'b_wood', Color3.FromHexString('#92400e'), 0.15),
    stone: createMaterial(scene, 'b_stone', Color3.FromHexString('#334155'), 0.1),
    roof: createMaterial(scene, 'b_roof', Color3.FromHexString('#7c2d12'), 0.12),
    accent: createMaterial(scene, 'b_accent', Color3.FromHexString('#e2e8f0'), 0.2),
    basePlate: createMaterial(scene, 'b_base', Color3.FromHexString('#0f172a'), 0.2, 0.9),
    rune: createMaterial(scene, 'b_rune', Color3.FromHexString('#fde047'), 0.7, 0.9)
  }

  const create = (id: BuildingId, padSize: { w: number; h: number }, level: number, key: string): BuildingVisualInstance => {
    const root = new TransformNode(`building_root_${key}`, scene)
    const footprint = { w: padSize.w * 0.6, d: padSize.h * 0.6, h: 14 }
    const basePlate = MeshBuilder.CreateCylinder(
      `building_plate_${key}`,
      { diameter: Math.max(padSize.w, padSize.h) * 0.88, height: 1, tessellation: 36 },
      scene
    )
    basePlate.material = materials.basePlate
    basePlate.position = new Vector3(0, 0.5, 0)
    basePlate.isPickable = false
    basePlate.parent = root

    const ctx: BuildContext = { scene, root, footprint, materials }
    const build = buildingVisuals[id]
    const height = build ? build.build(ctx) : footprint.h

    const levelBadge = createLabel(scene, `building_level_${key}`)
    levelBadge.mesh.parent = root
    levelBadge.mesh.position = new Vector3(0, height + 8, 0)

    const setLevel = (nextLevel: number) => {
      const label = `Lv${Math.max(1, nextLevel)}`
      if (levelBadge.text !== label) {
        drawLabel(levelBadge.texture, label, '#f8fafc')
        levelBadge.text = label
      }
    }

    setLevel(level)

    const setEnabled = (enabled: boolean) => {
      root.setEnabled(enabled)
    }

    const dispose = () => {
      root.dispose()
    }

    return { root, basePlate, levelBadge, height, setLevel, setEnabled, dispose }
  }

  return { create, materials }
}
