import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import type { Observer } from '@babylonjs/core/Misc/observable'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'

type Vec2 = { x: number; z: number }
type TargetProvider = () => Vec2 | null

export interface CameraBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// Tunables for camera feel.
const CAMERA_YAW = Math.PI / 4
const CAMERA_PITCH = 1.02
const CAMERA_RADIUS = 900

const BASE_ORTHO_SIZE = 240
const MIN_ORTHO_SIZE = 150
const MAX_ORTHO_SIZE = 360

const ZOOM_SPEED = 0.0014

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class CameraController {
  private scene: Scene
  private camera: ArcRotateCamera
  private canvas: HTMLCanvasElement
  private targetProvider: TargetProvider | null
  private bounds: CameraBounds
  private enabled = true
  private focus = { x: 0, z: 0 }
  private zoom = 1
  private observer: Observer<Scene> | null = null
  private hasFocus = false
  private detachInputs: () => void = () => {}

  constructor({
    scene,
    camera,
    canvas,
    target,
    bounds
  }: {
    scene: Scene
    camera: ArcRotateCamera
    canvas: HTMLCanvasElement
    target?: TargetProvider | Vec2 | null
    bounds: CameraBounds
  }) {
    this.scene = scene
    this.camera = camera
    this.canvas = canvas
    this.targetProvider = null
    this.bounds = bounds
    this.setTarget(target ?? null)

    this.zoom = clamp(1, BASE_ORTHO_SIZE / MAX_ORTHO_SIZE, BASE_ORTHO_SIZE / MIN_ORTHO_SIZE)
    this.applyCameraSetup()
    this.attachInputs()

    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.1, this.scene.getEngine().getDeltaTime() / 1000)
      this.update(dt)
    })
  }

  setTarget(target: TargetProvider | Vec2 | null) {
    if (!target) {
      this.targetProvider = null
      this.hasFocus = false
      return
    }
    if (typeof target === 'function') {
      this.targetProvider = target
    } else {
      const snapshot = { x: target.x, z: target.z }
      this.targetProvider = () => snapshot
    }
    this.hasFocus = false
  }

  setMapBounds(bounds: CameraBounds) {
    this.bounds = bounds
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  focusOn(x: number, z: number) {
    this.focus = { x, z }
    this.hasFocus = true
  }

  getViewPolygon() {
    return null
  }

  update(_dt: number) {
    if (!this.enabled) return

    const hero = this.targetProvider?.() ?? null
    if (hero) {
      this.focus = { x: hero.x, z: hero.z }
      this.hasFocus = true
    }
    if (!this.hasFocus) return

    this.clampFocusToBounds()
    this.applyCamera()
  }

  dispose() {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer)
      this.observer = null
    }
    this.detachInputs()
  }

  private applyCameraSetup() {
    this.scene.activeCamera = this.camera
    this.camera.mode = BabylonCamera.ORTHOGRAPHIC_CAMERA
    this.camera.setCameraRigMode(BabylonCamera.RIG_MODE_NONE)
    this.camera.inputs.clear()
    this.camera.inertia = 0
    this.camera.panningInertia = 0
    this.camera.alpha = -CAMERA_YAW
    this.camera.beta = CAMERA_PITCH
    this.camera.radius = CAMERA_RADIUS
    this.camera.minZ = 1
    this.camera.maxZ = 1200
  }

  private applyCamera() {
    const engine = this.scene.getEngine()
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    const aspect = height > 0 ? width / height : 1
    const halfHeight = BASE_ORTHO_SIZE / this.zoom
    const halfWidth = halfHeight * aspect

    this.camera.target.set(this.focus.x, 0, this.focus.z)
    this.camera.alpha = -CAMERA_YAW
    this.camera.beta = CAMERA_PITCH
    this.camera.radius = CAMERA_RADIUS
    this.camera.inertialAlphaOffset = 0
    this.camera.inertialBetaOffset = 0
    this.camera.inertialRadiusOffset = 0
    this.camera.inertialPanningX = 0
    this.camera.inertialPanningY = 0
    this.camera.orthoLeft = -halfWidth
    this.camera.orthoRight = halfWidth
    this.camera.orthoTop = halfHeight
    this.camera.orthoBottom = -halfHeight
  }

  private getOrthoHalfExtents() {
    const engine = this.scene.getEngine()
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    const aspect = height > 0 ? width / height : 1
    const halfHeight = BASE_ORTHO_SIZE / this.zoom
    const halfWidth = halfHeight * aspect
    return {
      halfWidth,
      halfHeight
    }
  }

  private clampFocusToBounds() {
    const { halfWidth, halfHeight } = this.getOrthoHalfExtents()
    const minX = this.bounds.minX + halfWidth
    const maxX = this.bounds.maxX - halfWidth
    const minZ = this.bounds.minZ + halfHeight
    const maxZ = this.bounds.maxZ - halfHeight

    if (minX > maxX) {
      this.focus.x = (this.bounds.minX + this.bounds.maxX) * 0.5
    } else {
      this.focus.x = clamp(this.focus.x, minX, maxX)
    }

    if (minZ > maxZ) {
      this.focus.z = (this.bounds.minZ + this.bounds.maxZ) * 0.5
    } else {
      this.focus.z = clamp(this.focus.z, minZ, maxZ)
    }
  }

  private attachInputs() {
    const handleWheel = (event: WheelEvent) => {
      if (event.target !== this.canvas) return
      event.preventDefault()
      const minZoom = BASE_ORTHO_SIZE / MAX_ORTHO_SIZE
      const maxZoom = BASE_ORTHO_SIZE / MIN_ORTHO_SIZE
      this.zoom = clamp(this.zoom - event.deltaY * ZOOM_SPEED, minZoom, maxZoom)
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return
      if (event.target !== this.canvas) return
      event.preventDefault()
      const minZoom = BASE_ORTHO_SIZE / MAX_ORTHO_SIZE
      const maxZoom = BASE_ORTHO_SIZE / MIN_ORTHO_SIZE
      this.zoom = clamp(1, minZoom, maxZoom)
    }

    this.canvas.addEventListener('wheel', handleWheel, { passive: false })
    this.canvas.addEventListener('mousedown', handleMouseDown)

    this.detachInputs = () => {
      this.canvas.removeEventListener('wheel', handleWheel)
      this.canvas.removeEventListener('mousedown', handleMouseDown)
    }
  }

}
