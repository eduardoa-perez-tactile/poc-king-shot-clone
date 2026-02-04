import { BuildingPad } from '../config/levels'
import { BUILDING_DEFS } from '../config/buildings'
import { RunBuilding } from '../run/types'
import { Grid } from './pathfinding'
import { PAD_SIZE, getPadRect } from './pads'
import { EntityState, SimState, Vec2 } from './types'

export interface Camera {
  x: number
  y: number
  zoom: number
}

const worldToScreen = (pos: Vec2, cam: Camera) => ({
  x: (pos.x - cam.x) * cam.zoom,
  y: (pos.y - cam.y) * cam.zoom
})

const drawHealthBar = (ctx: CanvasRenderingContext2D, entity: EntityState, cam: Camera) => {
  const screen = worldToScreen(entity.pos, cam)
  const width = 28 * cam.zoom
  const height = 4 * cam.zoom
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(screen.x - width / 2, screen.y - 24 * cam.zoom, width, height)
  ctx.fillStyle = '#22c55e'
  ctx.fillRect(screen.x - width / 2, screen.y - 24 * cam.zoom, width * (entity.hp / entity.maxHp), height)
}

const drawPads = (
  ctx: CanvasRenderingContext2D,
  pads: BuildingPad[],
  buildings: RunBuilding[],
  hoveredPadId: string | null,
  selectedPadId: string | null,
  pulse: number,
  cam: Camera
) => {
  const buildingByPad = new Map(buildings.map((building) => [building.padId, building]))
  pads.forEach((pad) => {
    const rect = getPadRect(pad)
    const topLeft = worldToScreen({ x: rect.x, y: rect.y }, cam)
    const w = rect.w * cam.zoom
    const h = rect.h * cam.zoom
    const building = buildingByPad.get(pad.id)
    const hovered = hoveredPadId === pad.id
    const selected = selectedPadId === pad.id

    if (building) {
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(topLeft.x, topLeft.y, w, h)
      if (hovered) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'
        ctx.fillRect(topLeft.x, topLeft.y, w, h)
      }
      ctx.strokeStyle = hovered ? '#38bdf8' : '#334155'
      ctx.lineWidth = hovered ? 3 : 2
      ctx.strokeRect(topLeft.x, topLeft.y, w, h)
      if (selected) {
        ctx.strokeStyle = 'rgba(76, 201, 240, 0.9)'
        ctx.lineWidth = 2.5 * pulse
        ctx.strokeRect(topLeft.x - 4 * cam.zoom, topLeft.y - 4 * cam.zoom, w + 8 * cam.zoom, h + 8 * cam.zoom)
      }

      ctx.fillStyle = '#e2e8f0'
      ctx.font = `${12 * cam.zoom}px 'Space Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const name = BUILDING_DEFS[building.id].name.split(' ')[0]
      ctx.fillText(name, topLeft.x + w / 2, topLeft.y + h / 2)

      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(topLeft.x + w - 10 * cam.zoom, topLeft.y + 10 * cam.zoom, 10 * cam.zoom, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#38bdf8'
      ctx.font = `${11 * cam.zoom}px 'Space Mono', monospace`
      ctx.fillText(`L${building.level}`, topLeft.x + w - 10 * cam.zoom, topLeft.y + 10 * cam.zoom)

      if (hovered) {
        ctx.fillStyle = '#e2e8f0'
        ctx.font = `${11 * cam.zoom}px 'Space Mono', monospace`
        ctx.fillText('Upgrade', topLeft.x + w / 2, topLeft.y + h - 12 * cam.zoom)
      }
    } else {
      ctx.strokeStyle = hovered ? '#38bdf8' : 'rgba(148, 163, 184, 0.6)'
      ctx.lineWidth = hovered ? 2 : 1
      ctx.strokeRect(topLeft.x, topLeft.y, w, h)
      if (selected) {
        ctx.strokeStyle = 'rgba(76, 201, 240, 0.9)'
        ctx.lineWidth = 2.5 * pulse
        ctx.strokeRect(topLeft.x - 4 * cam.zoom, topLeft.y - 4 * cam.zoom, w + 8 * cam.zoom, h + 8 * cam.zoom)
      }
      if (hovered) {
        ctx.fillStyle = '#e2e8f0'
        ctx.font = `${12 * cam.zoom}px 'Space Mono', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('+ Build', topLeft.x + w / 2, topLeft.y + h / 2)
      }
    }
  })
}

const drawHQ = (ctx: CanvasRenderingContext2D, entity: EntityState, cam: Camera) => {
  const rect = {
    x: entity.pos.x - PAD_SIZE.w / 2,
    y: entity.pos.y - PAD_SIZE.h / 2,
    w: PAD_SIZE.w,
    h: PAD_SIZE.h
  }
  const topLeft = worldToScreen({ x: rect.x, y: rect.y }, cam)
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(topLeft.x, topLeft.y, rect.w * cam.zoom, rect.h * cam.zoom)
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.strokeRect(topLeft.x, topLeft.y, rect.w * cam.zoom, rect.h * cam.zoom)
  ctx.fillStyle = '#e2e8f0'
  ctx.font = `${12 * cam.zoom}px 'Space Mono', monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('HQ', topLeft.x + (rect.w * cam.zoom) / 2, topLeft.y + (rect.h * cam.zoom) / 2)
}

const drawRange = (ctx: CanvasRenderingContext2D, entity: EntityState, cam: Camera) => {
  const screen = worldToScreen(entity.pos, cam)
  ctx.beginPath()
  ctx.arc(screen.x, screen.y, entity.range * cam.zoom, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'
  ctx.lineWidth = 2
  ctx.stroke()
}

export const renderScene = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  cam: Camera,
  selection: string[],
  grid: Grid,
  overlays?: {
    pads: BuildingPad[]
    buildings: RunBuilding[]
    hoveredPadId: string | null
    selectedPadId?: string | null
  }
) => {
  const width = ctx.canvas.width
  const height = ctx.canvas.height
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, width, height)

  // grid backdrop
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
  for (let x = 0; x < grid.width; x += 1) {
    const screenX = (x * grid.cellSize - cam.x) * cam.zoom
    ctx.beginPath()
    ctx.moveTo(screenX, 0)
    ctx.lineTo(screenX, height)
    ctx.stroke()
  }
  for (let y = 0; y < grid.height; y += 1) {
    const screenY = (y * grid.cellSize - cam.y) * cam.zoom
    ctx.beginPath()
    ctx.moveTo(0, screenY)
    ctx.lineTo(width, screenY)
    ctx.stroke()
  }

  sim.combat.map.obstacles.forEach((ob) => {
    const topLeft = worldToScreen({ x: ob.x, y: ob.y }, cam)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(topLeft.x, topLeft.y, ob.w * cam.zoom, ob.h * cam.zoom)
  })

  sim.effects.forEach((effect) => {
    const screen = worldToScreen(effect.pos, cam)
    const life = effect.expiresAt - effect.bornAt
    const remaining = Math.max(0, effect.expiresAt - sim.time)
    const alpha = life > 0 ? Math.min(1, remaining / life) : 0.2
    const radius = effect.radius * (1 + (1 - alpha) * 0.2) * cam.zoom
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2)
    if (effect.kind === 'hit') {
      ctx.fillStyle = `${effect.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`
      ctx.fill()
    } else {
      ctx.strokeStyle = `${effect.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`
      ctx.lineWidth = 2 * cam.zoom
      ctx.stroke()
    }
  })

  if (overlays) {
    const pulse = 1 + Math.sin(sim.time * 3) * 0.15
    drawPads(ctx, overlays.pads, overlays.buildings, overlays.hoveredPadId, overlays.selectedPadId ?? null, pulse, cam)
  }

  selection.forEach((id) => {
    const entity = sim.entities.find((entry) => entry.id === id)
    if (!entity || entity.kind === 'hq') return
    drawRange(ctx, entity, cam)
  })

  sim.entities.forEach((entity) => {
    const screen = worldToScreen(entity.pos, cam)
    const isSelected = selection.includes(entity.id)
    if (entity.kind === 'hq') {
      drawHQ(ctx, entity, cam)
    } else {
      if (entity.team === 'player') {
        ctx.fillStyle = entity.kind === 'hero' ? '#f59e0b' : '#38bdf8'
      } else {
        ctx.fillStyle = '#ef4444'
      }
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, entity.radius * cam.zoom, 0, Math.PI * 2)
      ctx.fill()
    }

    if (isSelected) {
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, (entity.radius + 4) * cam.zoom, 0, Math.PI * 2)
      ctx.stroke()
    }

    drawHealthBar(ctx, entity, cam)
  })

  sim.projectiles.forEach((proj) => {
    const screen = worldToScreen(proj.pos, cam)
    ctx.fillStyle = '#f97316'
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, 3 * cam.zoom, 0, Math.PI * 2)
    ctx.fill()
  })
}

export const screenToWorld = (pos: Vec2, cam: Camera): Vec2 => ({
  x: pos.x / cam.zoom + cam.x,
  y: pos.y / cam.zoom + cam.y
})

export const clampCamera = (cam: Camera, width: number, height: number, mapWidth: number, mapHeight: number): Camera => {
  const viewW = width / cam.zoom
  const viewH = height / cam.zoom
  const x = Math.max(0, Math.min(mapWidth - viewW, cam.x))
  const y = Math.max(0, Math.min(mapHeight - viewH, cam.y))
  return { ...cam, x, y }
}
