import { Grid } from './pathfinding'
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

export const renderScene = (
  ctx: CanvasRenderingContext2D,
  sim: SimState,
  cam: Camera,
  selection: string[],
  grid: Grid
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

  sim.mission.map.obstacles.forEach((ob) => {
    const topLeft = worldToScreen({ x: ob.x, y: ob.y }, cam)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(topLeft.x, topLeft.y, ob.w * cam.zoom, ob.h * cam.zoom)
  })

  sim.entities.forEach((entity) => {
    const screen = worldToScreen(entity.pos, cam)
    const isSelected = selection.includes(entity.id)
    ctx.fillStyle = entity.team === 'player' ? '#38bdf8' : '#ef4444'
    if (entity.kind === 'hero') ctx.fillStyle = '#facc15'
    if (entity.kind === 'hq') ctx.fillStyle = entity.team === 'player' ? '#2563eb' : '#b91c1c'
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, entity.radius * cam.zoom, 0, Math.PI * 2)
    ctx.fill()

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
