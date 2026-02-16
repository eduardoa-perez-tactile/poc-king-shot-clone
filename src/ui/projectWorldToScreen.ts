import { Camera } from '@babylonjs/core/Cameras/camera'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Scene } from '@babylonjs/core/scene'

export interface ProjectedScreenPoint {
  x: number
  y: number
  onScreen: boolean
  depth: number
}

export const projectWorldToScreen = (
  worldPos: Vector3,
  camera: Camera,
  scene: Scene,
  engine: Engine
): ProjectedScreenPoint => {
  const renderWidth = engine.getRenderWidth()
  const renderHeight = engine.getRenderHeight()
  const viewport = camera.viewport.toGlobal(renderWidth, renderHeight)
  const projected = Vector3.Project(
    worldPos,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    viewport
  )
  const depth = projected.z
  const insideViewport =
    projected.x >= viewport.x &&
    projected.x <= viewport.x + viewport.width &&
    projected.y >= viewport.y &&
    projected.y <= viewport.y + viewport.height
  const onScreen = depth >= 0 && depth <= 1 && insideViewport
  return {
    x: projected.x,
    y: projected.y,
    onScreen,
    depth
  }
}
