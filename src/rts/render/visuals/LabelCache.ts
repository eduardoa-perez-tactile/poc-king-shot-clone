import { Material } from '@babylonjs/core/Materials/material'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Scene } from '@babylonjs/core/scene'

export interface LabelStyle {
  width?: number
  height?: number
  fontSize?: number
  lineHeight?: number
  textColor?: string
  strokeColor?: string
  backgroundColor?: string
  paddingTop?: number
}

interface LabelEntry {
  texture: DynamicTexture
  material: StandardMaterial
}

const DEFAULT_STYLE: Required<LabelStyle> = {
  width: 1024,
  height: 512,
  fontSize: 84,
  lineHeight: 0,
  textColor: '#f8fafc',
  strokeColor: '#020617',
  backgroundColor: 'rgba(2, 6, 23, 0.42)',
  paddingTop: 0
}

export class LabelCache {
  private readonly labels = new Map<string, LabelEntry>()

  constructor(private readonly scene: Scene) {}

  getOrCreateLabelMaterial(key: string, lines: string[], style?: LabelStyle): StandardMaterial {
    const existing = this.labels.get(key)
    if (existing) return existing.material

    const merged: Required<LabelStyle> = {
      ...DEFAULT_STYLE,
      ...style,
      lineHeight: style?.lineHeight ?? Math.max(48, (style?.fontSize ?? DEFAULT_STYLE.fontSize) * 1.1)
    }

    const texture = new DynamicTexture(`${key}_tex`, { width: merged.width, height: merged.height }, this.scene, true)
    texture.hasAlpha = true
    this.drawTexture(texture, lines, merged)

    const material = new StandardMaterial(`${key}_mat`, this.scene)
    material.diffuseTexture = texture
    material.opacityTexture = texture
    material.emissiveColor = Color3.White()
    material.specularColor = Color3.Black()
    material.backFaceCulling = false
    material.disableDepthWrite = true
    material.transparencyMode = Material.MATERIAL_ALPHABLEND

    this.labels.set(key, { texture, material })
    return material
  }

  private drawTexture(texture: DynamicTexture, lines: string[], style: Required<LabelStyle>) {
    const size = texture.getSize()
    const ctx = texture.getContext()
    ctx.clearRect(0, 0, size.width, size.height)

    if (style.backgroundColor) {
      const radius = 18
      const x = 8
      const y = 8
      const w = size.width - 16
      const h = size.height - 16
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + w - radius, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
      ctx.lineTo(x + w, y + h - radius)
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
      ctx.lineTo(x + radius, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fillStyle = style.backgroundColor
      ctx.fill()
    }

    const textLines = lines.length > 0 ? lines : ['']
    const lineHeight = style.lineHeight
    const totalHeight = lineHeight * textLines.length
    const startY = (size.height - totalHeight) / 2 + lineHeight / 2 + style.paddingTop

    ctx.font = `${style.fontSize}px 'Space Mono', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(4, style.fontSize * 0.16)

    textLines.forEach((line, index) => {
      const y = startY + index * lineHeight
      ctx.strokeStyle = style.strokeColor
      ctx.strokeText(line, size.width / 2, y)
      ctx.fillStyle = style.textColor
      ctx.fillText(line, size.width / 2, y)
    })

    texture.update()
  }

  dispose() {
    this.labels.forEach((entry) => {
      entry.texture.dispose()
      entry.material.dispose()
    })
    this.labels.clear()
  }
}
