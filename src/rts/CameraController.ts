import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera as BabylonCamera } from '@babylonjs/core/Cameras/camera'
import type { Observer } from '@babylonjs/core/Misc/observable'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
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

const FOLLOW_SMOOTH_TIME = 0.12
const RETURN_SMOOTH_TIME = 0.22
const RETURN_EPSILON = 0.5

const DEAD_ZONE_PCT = 0.018
const EDGE_PAN_PX = 32
const EDGE_PAN_SPEED = 520

const ZOOM_SPEED = 0.0014

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const smoothDamp = (
  current: number,
  target: number,
  currentVelocity: number,
  smoothTime: number,
  deltaTime: number
) => {
  const safeSmoothTime = Math.max(0.0001, smoothTime)
  const omega = 2 / safeSmoothTime
  const x = omega * deltaTime
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  let change = current - target
  const temp = (currentVelocity + omega * change) * deltaTime
  const newVelocity = (currentVelocity - omega * temp) * exp
  const newValue = target + (change + temp) * exp
  return { value: newValue, velocity: newVelocity }
}

export class CameraController {
  private scene: Scene
  private camera: ArcRotateCamera
  private canvas: HTMLCanvasElement
  private targetProvider: TargetProvider | null
  private bounds: CameraBounds
  private enabled = true
  private freePanActive = false
  private returning = false
  private focus = { x: 0, z: 0 }
  private velocity = { x: 0, z: 0 }
  private zoom = 1
  private lastViewPolygon: Vec2[] | null = null
  private pointer = { x: 0, y: 0, inside: false }
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
    this.velocity = { x: 0, z: 0 }
    this.returning = false
    this.hasFocus = true
  }

  getViewPolygon() {
    return this.lastViewPolygon
  }

  update(dt: number) {
    if (!this.enabled) return

    const hero = this.targetProvider?.() ?? null
    if (!hero) {
      this.applyCamera()
      return
    }

    if (!this.hasFocus) {
      this.focus = { x: hero.x, z: hero.z }
      this.hasFocus = true
    }

    if (this.freePanActive) {
      this.returning = false
      this.applyEdgePan(dt)
    } else {
      const desired = this.getDeadZoneFocus(hero)
      const smoothTime = this.returning ? RETURN_SMOOTH_TIME : FOLLOW_SMOOTH_TIME
      const nextX = smoothDamp(this.focus.x, desired.x, this.velocity.x, smoothTime, dt)
      const nextZ = smoothDamp(this.focus.z, desired.z, this.velocity.z, smoothTime, dt)
      this.focus = { x: nextX.value, z: nextZ.value }
      this.velocity = { x: nextX.velocity, z: nextZ.velocity }

      if (this.returning) {
        const dx = this.focus.x - desired.x
        const dz = this.focus.z - desired.z
        if (Math.hypot(dx, dz) < RETURN_EPSILON) {
          this.returning = false
        }
      }
    }

    this.applyCamera()
    if (this.clampFocus()) {
      this.applyCamera()
    }
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

    this.lastViewPolygon = this.computeViewPolygon(width, height)
  }

  private computeViewPolygon(width: number, height: number) {
    if (!width || !height) return null
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ]
    const points: Vec2[] = []
    corners.forEach((corner) => {
      const ray = this.scene.createPickingRay(corner.x, corner.y, Matrix.Identity(), this.camera)
      const dirY = ray.direction.y
      if (Math.abs(dirY) < 1e-6) return
      const t = -ray.origin.y / dirY
      if (!Number.isFinite(t) || t <= 0) return
      const hit = ray.origin.add(ray.direction.scale(t))
      points.push({ x: hit.x, z: hit.z })
    })
    return points.length === 4 ? points : null
  }

  private clampFocus() {
    const poly = this.lastViewPolygon
    if (!poly || poly.length < 3) return false
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    poly.forEach((point) => {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    })

    let offsetX = 0
    let offsetZ = 0
    if (minX < this.bounds.minX) offsetX += this.bounds.minX - minX
    if (maxX > this.bounds.maxX) offsetX -= maxX - this.bounds.maxX
    if (minZ < this.bounds.minZ) offsetZ += this.bounds.minZ - minZ
    if (maxZ > this.bounds.maxZ) offsetZ -= maxZ - this.bounds.maxZ

    if (offsetX !== 0 || offsetZ !== 0) {
      this.focus.x += offsetX
      this.focus.z += offsetZ
      return true
    }
    return false
  }

  private getDeadZoneFocus(hero: Vec2) {
    const engine = this.scene.getEngine()
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    if (!width || !height) return this.focus

    const screen = this.projectToScreen(hero)
    if (!screen) return this.focus

    const centerX = width * 0.5
    const centerY = height * 0.5
    const deadX = width * DEAD_ZONE_PCT
    const deadY = height * DEAD_ZONE_PCT
    const dx = screen.x - centerX
    const dy = screen.y - centerY

    if (Math.abs(dx) <= deadX && Math.abs(dy) <= deadY) {
      return this.focus
    }

    const clampedX = centerX + clamp(dx, -deadX, deadX)
    const clampedY = centerY + clamp(dy, -deadY, deadY)
    const desiredGround = this.screenToGround(clampedX, clampedY)
    if (!desiredGround) return this.focus

    return {
      x: this.focus.x + (hero.x - desiredGround.x),
      z: this.focus.z + (hero.z - desiredGround.z)
    }
  }

  private projectToScreen(pos: Vec2) {
    const engine = this.scene.getEngine()
    const width = engine.getRenderWidth()
    const height = engine.getRenderHeight()
    if (!width || !height) return null
    const viewport = this.camera.viewport.toGlobal(width, height)
    const projected = Vector3.Project(new Vector3(pos.x, 0, pos.z), Matrix.Identity(), this.camera.getTransformationMatrix(), viewport)
    return { x: projected.x, y: projected.y }
  }

  private screenToGround(x: number, y: number) {
    const ray = this.scene.createPickingRay(x, y, Matrix.Identity(), this.camera)
    const dirY = ray.direction.y
    if (Math.abs(dirY) < 1e-6) return null
    const t = -ray.origin.y / dirY
    if (!Number.isFinite(t) || t <= 0) return null
    const hit = ray.origin.add(ray.direction.scale(t))
    return { x: hit.x, z: hit.z }
  }

  private applyEdgePan(dt: number) {
    if (!this.pointer.inside) return
    const rect = this.canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    if (!width || !height) return

    let dirX = 0
    let dirZ = 0
    if (this.pointer.x <= EDGE_PAN_PX) dirX = -1
    if (this.pointer.x >= width - EDGE_PAN_PX) dirX = 1
    if (this.pointer.y <= EDGE_PAN_PX) dirZ = -1
    if (this.pointer.y >= height - EDGE_PAN_PX) dirZ = 1

    if (dirX === 0 && dirZ === 0) return
    const speed = EDGE_PAN_SPEED / this.zoom
    this.focus.x += dirX * speed * dt
    this.focus.z += dirZ * speed * dt
  }

  private attachInputs() {
    const handleWheel = (event: WheelEvent) => {
      if (event.target !== this.canvas) return
      event.preventDefault()
      const minZoom = BASE_ORTHO_SIZE / MAX_ORTHO_SIZE
      const maxZoom = BASE_ORTHO_SIZE / MIN_ORTHO_SIZE
      this.zoom = clamp(this.zoom - event.deltaY * ZOOM_SPEED, minZoom, maxZoom)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (event.target !== this.canvas) {
        this.pointer.inside = false
        return
      }
      const rect = this.canvas.getBoundingClientRect()
      this.pointer.x = event.clientX - rect.left
      this.pointer.y = event.clientY - rect.top
      this.pointer.inside = true
    }

    const handleMouseLeave = () => {
      this.pointer.inside = false
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (event.target as HTMLElement | null)?.isContentEditable) return
      if (event.key.toLowerCase() === 'f') {
        this.freePanActive = true
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') {
        this.freePanActive = false
        this.returning = true
      }
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
    this.canvas.addEventListener('mousemove', handleMouseMove)
    this.canvas.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    this.canvas.addEventListener('mousedown', handleMouseDown)

    this.detachInputs = () => {
      this.canvas.removeEventListener('wheel', handleWheel)
      this.canvas.removeEventListener('mousemove', handleMouseMove)
      this.canvas.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      this.canvas.removeEventListener('mousedown', handleMouseDown)
    }
  }

}
