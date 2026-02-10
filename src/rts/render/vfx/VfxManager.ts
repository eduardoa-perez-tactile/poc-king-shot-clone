import { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector'
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
import { createPool, type Pool } from './pools'

export type HeroVfxType = 'vanguard' | 'mage' | 'golem' | 'dragon' | 'boss' | 'unknown'
export type HeroAttackKind = 'basic' | 'melee' | 'ranged' | 'aoe' | 'heal' | 'slam' | 'breath'

interface MeshEffect {
  mesh: Mesh
  kind: 'ring' | 'slash' | 'tracer' | 'flash' | 'crack' | 'debris'
  age: number
  ttl: number
  startScale: number
  endScale: number
  flat?: boolean
  velocity?: Vector3
  rotation?: Vector3
}

interface ParticleEffect {
  system: ParticleSystem
  age: number
  ttl: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const createEmissiveMaterial = (scene: Scene, name: string, color: Color3, alpha = 1, emissive = 0.9) => {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(emissive)
  mat.specularColor = new Color3(0.05, 0.05, 0.05)
  mat.alpha = alpha
  mat.backFaceCulling = false
  return mat
}

const createRadialTexture = (scene: Scene, name: string) => {
  const texture = new DynamicTexture(name, { width: 64, height: 64 }, scene, false)
  texture.hasAlpha = true
  const ctx = texture.getContext()
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  texture.update()
  return texture
}

const alignCylinderToSegment = (mesh: Mesh, from: Vector3, to: Vector3, thickness: number) => {
  const dir = to.subtract(from)
  const length = Math.max(0.1, dir.length())
  const mid = from.add(dir.scale(0.5))
  dir.normalize()
  const up = Vector3.Up()
  const dot = Math.max(-1, Math.min(1, Vector3.Dot(up, dir)))
  let rotation = Quaternion.Identity()
  const axis = Vector3.Cross(up, dir)
  if (axis.lengthSquared() > 0.0001) {
    axis.normalize()
    rotation = Quaternion.RotationAxis(axis, Math.acos(dot))
  }
  mesh.rotationQuaternion = rotation
  mesh.scaling = new Vector3(thickness, length, thickness)
  mesh.position.copyFrom(mid)
}

const orientSlash = (mesh: Mesh, from: Vector3, to: Vector3, width: number, height: number) => {
  const dir = to.subtract(from)
  const length = Math.max(0.1, dir.length())
  const mid = from.add(dir.scale(0.5))
  mesh.position.copyFrom(mid)
  mesh.rotationQuaternion = null
  mesh.rotation = new Vector3(0, Math.atan2(dir.x, dir.z), 0)
  mesh.scaling = new Vector3(width, height, length)
}

export class VfxManager {
  private scene: Scene
  private time = 0
  private meshEffects: MeshEffect[] = []
  private particleEffects: ParticleEffect[] = []

  private ringPool: Pool<Mesh>
  private slashPool: Pool<Mesh>
  private tracerPool: Pool<Mesh>
  private flashPool: Pool<Mesh>
  private crackPool: Pool<Mesh>
  private debrisPool: Pool<Mesh>

  private sparkPool: Pool<ParticleSystem>
  private dustPool: Pool<ParticleSystem>

  private ringMaterial: StandardMaterial
  private heroRingMaterial: StandardMaterial
  private explosionRingMaterial: StandardMaterial
  private crackMaterial: StandardMaterial
  private slashMaterial: StandardMaterial
  private tracerMaterial: StandardMaterial
  private heroTracerMaterial: StandardMaterial
  private fireTracerMaterial: StandardMaterial
  private flashMaterial: StandardMaterial

  private particleTexture: DynamicTexture

  constructor(scene: Scene) {
    this.scene = scene
    this.particleTexture = createRadialTexture(scene, 'vfx_particle')

    this.ringMaterial = createEmissiveMaterial(scene, 'vfx_ring', Color3.FromHexString('#38bdf8'), 0.85, 0.8)
    this.heroRingMaterial = createEmissiveMaterial(scene, 'vfx_ring_hero', Color3.FromHexString('#facc15'), 0.85, 0.9)
    this.explosionRingMaterial = createEmissiveMaterial(scene, 'vfx_ring_explosion', Color3.FromHexString('#f97316'), 0.9, 0.95)
    this.crackMaterial = createEmissiveMaterial(scene, 'vfx_crack', Color3.FromHexString('#92400e'), 0.6, 0.2)
    this.slashMaterial = createEmissiveMaterial(scene, 'vfx_slash', Color3.FromHexString('#f8fafc'), 0.85, 1)
    this.tracerMaterial = createEmissiveMaterial(scene, 'vfx_tracer', Color3.FromHexString('#38bdf8'), 0.9, 1)
    this.heroTracerMaterial = createEmissiveMaterial(scene, 'vfx_tracer_hero', Color3.FromHexString('#f59e0b'), 0.95, 1)
    this.fireTracerMaterial = createEmissiveMaterial(scene, 'vfx_tracer_fire', Color3.FromHexString('#fb923c'), 0.95, 1)
    this.flashMaterial = createEmissiveMaterial(scene, 'vfx_flash', Color3.FromHexString('#fef3c7'), 0.9, 1)

    this.ringPool = createPool(() => this.createRingMesh(), (mesh) => this.resetMesh(mesh))
    this.slashPool = createPool(() => this.createSlashMesh(), (mesh) => this.resetMesh(mesh))
    this.tracerPool = createPool(() => this.createTracerMesh(), (mesh) => this.resetMesh(mesh))
    this.flashPool = createPool(() => this.createFlashMesh(), (mesh) => this.resetMesh(mesh))
    this.crackPool = createPool(() => this.createCrackMesh(), (mesh) => this.resetMesh(mesh))
    this.debrisPool = createPool(() => this.createDebrisMesh(), (mesh) => this.resetMesh(mesh))

    this.sparkPool = createPool(() => this.createSparkSystem(), (system) => this.resetParticle(system))
    this.dustPool = createPool(() => this.createDustSystem(), (system) => this.resetParticle(system))
  }

  update(dt: number) {
    const step = Math.max(0, dt)
    this.time += step
    for (let i = this.meshEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.meshEffects[i]
      effect.age += step
      const t = clamp01(effect.age / effect.ttl)
      if (effect.kind === 'ring' || effect.kind === 'flash' || effect.kind === 'crack') {
        const scale = effect.startScale + (effect.endScale - effect.startScale) * t
        effect.mesh.scaling = new Vector3(scale, effect.flat ? 1 : scale, scale)
      }
      if (effect.kind === 'debris' && effect.velocity) {
        effect.mesh.position.addInPlace(effect.velocity.scale(step))
        effect.velocity.y -= 120 * step
        if (effect.rotation) {
          effect.mesh.rotation.x += effect.rotation.x * step
          effect.mesh.rotation.y += effect.rotation.y * step
          effect.mesh.rotation.z += effect.rotation.z * step
        }
      }
      effect.mesh.visibility = 1 - t
      if (effect.age >= effect.ttl) {
        this.meshEffects.splice(i, 1)
        this.releaseMesh(effect.mesh, effect.kind)
      }
    }

    for (let i = this.particleEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.particleEffects[i]
      effect.age += step
      if (effect.age >= effect.ttl) {
        effect.system.stop()
        this.particleEffects.splice(i, 1)
        this.releaseParticle(effect.system)
      }
    }
  }

  playUnitDeath(position: Vector3, tier: 'normal' | 'miniBoss' | 'boss' | 'hero' = 'normal') {
    const isBoss = tier === 'boss' || tier === 'miniBoss'
    const ring = this.ringPool.acquire()
    ring.material = this.explosionRingMaterial
    ring.position.copyFrom(position)
    ring.position.y = 0.4
    ring.setEnabled(true)
    this.meshEffects.push({
      mesh: ring,
      kind: 'ring',
      age: 0,
      ttl: isBoss ? 0.6 : 0.45,
      startScale: isBoss ? 4 : 3,
      endScale: isBoss ? 18 : 12,
      flat: true
    })

    const flash = this.flashPool.acquire()
    flash.material = this.flashMaterial
    flash.position.copyFrom(position)
    flash.position.y = 10
    flash.setEnabled(true)
    this.meshEffects.push({
      mesh: flash,
      kind: 'flash',
      age: 0,
      ttl: 0.18,
      startScale: isBoss ? 4 : 2.5,
      endScale: isBoss ? 8 : 5
    })

    this.emitBurst(position, isBoss ? 40 : 26, isBoss ? '#fb923c' : '#f97316')
    if (isBoss) {
      this.emitDust(position, 48, '#fde68a')
      this.spawnDebris(position, tier === 'boss' ? 6 : 4)
    } else {
      this.emitDust(position, 24, '#e2e8f0')
    }
  }

  playHit(position: Vector3, intensity = 1) {
    const raised = position.clone()
    raised.y += 6
    this.emitBurst(raised, Math.round(12 * intensity), intensity > 1.2 ? '#fef08a' : '#f8fafc')
  }

  playMeleeSwing(from: Vector3, to: Vector3) {
    const slash = this.slashPool.acquire()
    slash.material = this.slashMaterial
    slash.setEnabled(true)
    const raisedFrom = from.clone()
    const raisedTo = to.clone()
    raisedFrom.y += 6
    raisedTo.y += 6
    orientSlash(slash, raisedFrom, raisedTo, 0.35, 0.2)
    this.meshEffects.push({
      mesh: slash,
      kind: 'slash',
      age: 0,
      ttl: 0.12,
      startScale: 1,
      endScale: 1
    })
  }

  playRangedShot(from: Vector3, to: Vector3, projectileType?: string) {
    const tracer = this.tracerPool.acquire()
    tracer.material =
      projectileType === 'fire'
        ? this.fireTracerMaterial
        : projectileType === 'arcane' || projectileType === 'hero'
          ? this.heroTracerMaterial
          : this.tracerMaterial
    tracer.setEnabled(true)
    const raisedFrom = from.clone()
    const raisedTo = to.clone()
    raisedFrom.y += 8
    raisedTo.y += 8
    alignCylinderToSegment(tracer, raisedFrom, raisedTo, 0.35)
    this.meshEffects.push({
      mesh: tracer,
      kind: 'tracer',
      age: 0,
      ttl: 0.18,
      startScale: 1,
      endScale: 1
    })
  }

  playHeroAttack(heroType: HeroVfxType, from: Vector3, to: Vector3, attackKind: HeroAttackKind, radius?: number) {
    if (attackKind === 'heal') {
      const ringRadius = Math.max(6, radius ?? 10)
      const ring = this.ringPool.acquire()
      ring.material = this.heroRingMaterial
      ring.position.copyFrom(from)
      ring.position.y = 0.35
      ring.setEnabled(true)
      this.meshEffects.push({
        mesh: ring,
        kind: 'ring',
        age: 0,
        ttl: 0.35,
        startScale: ringRadius * 0.3,
        endScale: ringRadius,
        flat: true
      })
      this.emitDust(from, 20, '#4ade80')
      return
    }

    if (heroType === 'mage') {
      this.playRangedShot(from, to, 'arcane')
      this.emitBurst(to, 22, '#a5b4fc')
      return
    }

    if (heroType === 'golem') {
      const ringRadius = Math.max(10, radius ?? 14)
      const ring = this.ringPool.acquire()
      ring.material = this.explosionRingMaterial
      ring.position.copyFrom(to)
      ring.position.y = 0.35
      ring.setEnabled(true)
      this.meshEffects.push({
        mesh: ring,
        kind: 'ring',
        age: 0,
        ttl: 0.4,
        startScale: ringRadius * 0.3,
        endScale: ringRadius,
        flat: true
      })
      this.emitDust(to, 36, '#cbd5f5')
      return
    }

    if (heroType === 'dragon') {
      this.playRangedShot(from, to, 'fire')
      this.emitBurst(to, 30, '#fb923c')
      return
    }

    if (heroType === 'boss') {
      if (attackKind === 'melee') {
        const ring = this.ringPool.acquire()
        ring.material = this.explosionRingMaterial
        ring.position.copyFrom(to)
        ring.position.y = 0.35
        ring.setEnabled(true)
        this.meshEffects.push({
          mesh: ring,
          kind: 'ring',
          age: 0,
          ttl: 0.45,
          startScale: 6,
          endScale: 16,
          flat: true
        })
      } else {
        this.playRangedShot(from, to, 'fire')
      }
      this.emitBurst(to, 26, '#fb7185')
      return
    }

    // Default / main hero
    if (attackKind === 'aoe') {
      const ringRadius = Math.max(8, radius ?? 12)
      const ring = this.ringPool.acquire()
      ring.material = this.heroRingMaterial
      ring.position.copyFrom(from)
      ring.position.y = 0.35
      ring.setEnabled(true)
      this.meshEffects.push({
        mesh: ring,
        kind: 'ring',
        age: 0,
        ttl: 0.4,
        startScale: ringRadius * 0.35,
        endScale: ringRadius,
        flat: true
      })
      this.emitBurst(from, 20, '#fde047')
      return
    }

    if (attackKind === 'melee') {
      const crack = this.crackPool.acquire()
      crack.material = this.crackMaterial
      crack.position.copyFrom(to)
      crack.position.y = 0.15
      crack.setEnabled(true)
      this.meshEffects.push({
        mesh: crack,
        kind: 'crack',
        age: 0,
        ttl: 0.2,
        startScale: 2,
        endScale: 4,
        flat: true
      })
      this.emitBurst(to, 18, '#fef08a')
      return
    }

    const tracer = this.tracerPool.acquire()
    tracer.material = this.heroTracerMaterial
    tracer.setEnabled(true)
    alignCylinderToSegment(tracer, from, to, 0.45)
    this.meshEffects.push({
      mesh: tracer,
      kind: 'tracer',
      age: 0,
      ttl: 0.2,
      startScale: 1,
      endScale: 1
    })
  }

  private resetMesh(mesh: Mesh) {
    mesh.setEnabled(false)
    mesh.visibility = 1
    mesh.rotationQuaternion = null
    mesh.rotation = Vector3.Zero()
    mesh.scaling = new Vector3(1, 1, 1)
  }

  private resetParticle(system: ParticleSystem) {
    system.stop()
  }

  private releaseMesh(mesh: Mesh, kind: MeshEffect['kind']) {
    if (kind === 'slash') this.slashPool.release(mesh)
    else if (kind === 'tracer') this.tracerPool.release(mesh)
    else if (kind === 'flash') this.flashPool.release(mesh)
    else if (kind === 'crack') this.crackPool.release(mesh)
    else if (kind === 'debris') this.debrisPool.release(mesh)
    else this.ringPool.release(mesh)
  }

  private releaseParticle(system: ParticleSystem) {
    if (system.name.startsWith('vfx_dust')) this.dustPool.release(system)
    else this.sparkPool.release(system)
  }

  private createRingMesh() {
    const mesh = MeshBuilder.CreateTorus('vfx_ring_mesh', { diameter: 2, thickness: 0.1, tessellation: 36 }, this.scene)
    mesh.rotation.x = Math.PI / 2
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }

  private createSlashMesh() {
    const mesh = MeshBuilder.CreateBox('vfx_slash_mesh', { width: 1, height: 0.1, depth: 1 }, this.scene)
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }

  private createTracerMesh() {
    const mesh = MeshBuilder.CreateCylinder('vfx_tracer_mesh', { diameter: 1, height: 1, tessellation: 8 }, this.scene)
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }

  private createFlashMesh() {
    const mesh = MeshBuilder.CreatePlane('vfx_flash_mesh', { size: 1 }, this.scene)
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }

  private createCrackMesh() {
    const mesh = MeshBuilder.CreatePlane('vfx_crack_mesh', { size: 1 }, this.scene)
    mesh.rotation.x = Math.PI / 2
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }

  private createDebrisMesh() {
    const mesh = MeshBuilder.CreateBox('vfx_debris_mesh', { size: 1 }, this.scene)
    mesh.material = createEmissiveMaterial(this.scene, 'vfx_debris_mat', Color3.FromHexString('#475569'), 1, 0.2)
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  }

  private createSparkSystem() {
    const system = new ParticleSystem(`vfx_spark_${Math.random()}`, 64, this.scene)
    system.particleTexture = this.particleTexture
    system.minLifeTime = 0.08
    system.maxLifeTime = 0.2
    system.minSize = 2
    system.maxSize = 6
    system.minEmitPower = 40
    system.maxEmitPower = 110
    system.emitRate = 0
    system.gravity = new Vector3(0, -60, 0)
    system.direction1 = new Vector3(-1, 1, -1)
    system.direction2 = new Vector3(1, 3, 1)
    system.blendMode = ParticleSystem.BLENDMODE_ONEONE
    system.disposeOnStop = false
    system.stop()
    return system
  }

  private createDustSystem() {
    const system = new ParticleSystem(`vfx_dust_${Math.random()}`, 80, this.scene)
    system.particleTexture = this.particleTexture
    system.minLifeTime = 0.2
    system.maxLifeTime = 0.5
    system.minSize = 4
    system.maxSize = 10
    system.minEmitPower = 16
    system.maxEmitPower = 38
    system.emitRate = 0
    system.gravity = new Vector3(0, -30, 0)
    system.direction1 = new Vector3(-1, 0.4, -1)
    system.direction2 = new Vector3(1, 1.1, 1)
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD
    system.disposeOnStop = false
    system.stop()
    return system
  }

  private emitBurst(position: Vector3, count: number, color: string) {
    const system = this.sparkPool.acquire()
    system.emitter = position
    system.color1 = Color3.FromHexString(color).toColor4(1)
    system.color2 = Color3.FromHexString(color).toColor4(0.6)
    system.manualEmitCount = count
    system.start()
    this.particleEffects.push({ system, age: 0, ttl: 0.25 })
  }

  private emitDust(position: Vector3, count: number, color: string) {
    const system = this.dustPool.acquire()
    system.emitter = position
    system.color1 = Color3.FromHexString(color).toColor4(0.55)
    system.color2 = Color3.FromHexString(color).toColor4(0.1)
    system.manualEmitCount = count
    system.start()
    this.particleEffects.push({ system, age: 0, ttl: 0.55 })
  }

  private spawnDebris(position: Vector3, count: number) {
    for (let i = 0; i < count; i += 1) {
      const mesh = this.debrisPool.acquire()
      mesh.setEnabled(true)
      mesh.position.copyFrom(position)
      mesh.position.y += 4
      const dir = new Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2)
      dir.normalize()
      const speed = 80 + Math.random() * 50
      const velocity = dir.scale(speed)
      mesh.scaling = new Vector3(2 + Math.random() * 2, 2 + Math.random() * 2, 2 + Math.random() * 2)
      this.meshEffects.push({
        mesh,
        kind: 'debris',
        age: 0,
        ttl: 0.7,
        startScale: 1,
        endScale: 1,
        velocity,
        rotation: new Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4)
      })
    }
  }
}
