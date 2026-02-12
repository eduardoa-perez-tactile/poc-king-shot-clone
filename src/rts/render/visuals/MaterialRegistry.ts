import { Material } from '@babylonjs/core/Materials/material'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Scene } from '@babylonjs/core/scene'

export interface MaterialOptions {
  color: Color3 | string
  emissive?: number
  alpha?: number
  transparencyMode?: number
  backFaceCulling?: boolean
  disableDepthWrite?: boolean
  useVertexColor?: boolean
}

const asColor3 = (color: Color3 | string) => (typeof color === 'string' ? Color3.FromHexString(color) : color)

export class MaterialRegistry {
  private readonly materials = new Map<string, StandardMaterial>()

  constructor(private readonly scene: Scene) {}

  getOrCreateMaterial(key: string, options: MaterialOptions): StandardMaterial {
    const existing = this.materials.get(key)
    if (existing) return existing

    const color = asColor3(options.color)
    const mat = new StandardMaterial(key, this.scene)
    mat.diffuseColor = color
    mat.emissiveColor = color.scale(options.emissive ?? 0.2)
    mat.specularColor = new Color3(0.12, 0.12, 0.12)
    mat.alpha = options.alpha ?? 1
    mat.transparencyMode = options.transparencyMode ?? Material.MATERIAL_OPAQUE
    mat.backFaceCulling = options.backFaceCulling ?? true
    mat.disableDepthWrite = options.disableDepthWrite ?? false
    mat.useVertexColor = options.useVertexColor ?? false

    this.materials.set(key, mat)
    return mat
  }

  dispose() {
    this.materials.forEach((mat) => mat.dispose())
    this.materials.clear()
  }
}
