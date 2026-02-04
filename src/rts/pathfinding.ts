import { Rect, Vec2 } from './types'

export interface Grid {
  width: number
  height: number
  cellSize: number
  blocked: boolean[][]
}

export const buildGrid = (width: number, height: number, cellSize: number, obstacles: Rect[]): Grid => {
  const cols = Math.floor(width / cellSize)
  const rows = Math.floor(height / cellSize)
  const blocked: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false))

  obstacles.forEach((ob) => {
    const startX = Math.floor(ob.x / cellSize)
    const endX = Math.floor((ob.x + ob.w) / cellSize)
    const startY = Math.floor(ob.y / cellSize)
    const endY = Math.floor((ob.y + ob.h) / cellSize)
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        if (y >= 0 && y < rows && x >= 0 && x < cols) {
          blocked[y][x] = true
        }
      }
    }
  })

  return { width: cols, height: rows, cellSize, blocked }
}

export const worldToCell = (grid: Grid, pos: Vec2) => ({
  x: Math.max(0, Math.min(grid.width - 1, Math.floor(pos.x / grid.cellSize))),
  y: Math.max(0, Math.min(grid.height - 1, Math.floor(pos.y / grid.cellSize)))
})

export const cellToWorld = (grid: Grid, cell: { x: number; y: number }): Vec2 => ({
  x: cell.x * grid.cellSize + grid.cellSize / 2,
  y: cell.y * grid.cellSize + grid.cellSize / 2
})

const neighbors = (grid: Grid, cell: { x: number; y: number }) => {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ]
  return dirs
    .map((d) => ({ x: cell.x + d.x, y: cell.y + d.y }))
    .filter((c) => c.x >= 0 && c.x < grid.width && c.y >= 0 && c.y < grid.height && !grid.blocked[c.y][c.x])
}

const heuristic = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const findNearestFree = (grid: Grid, cell: { x: number; y: number }) => {
  if (!grid.blocked[cell.y][cell.x]) return cell
  const queue = [cell]
  const visited = new Set([`${cell.x},${cell.y}`])
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const next of neighbors(grid, current)) {
      const key = `${next.x},${next.y}`
      if (visited.has(key)) continue
      if (!grid.blocked[next.y][next.x]) return next
      visited.add(key)
      queue.push(next)
    }
  }
  return cell
}

export const findPath = (grid: Grid, startPos: Vec2, endPos: Vec2): Vec2[] => {
  const start = findNearestFree(grid, worldToCell(grid, startPos))
  const end = findNearestFree(grid, worldToCell(grid, endPos))

  const open: Array<{ x: number; y: number }> = [start]
  const cameFrom = new Map<string, { x: number; y: number }>()
  const gScore = new Map<string, number>()
  const fScore = new Map<string, number>()

  const key = (c: { x: number; y: number }) => `${c.x},${c.y}`
  gScore.set(key(start), 0)
  fScore.set(key(start), heuristic(start, end))

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(key(a)) ?? Infinity) - (fScore.get(key(b)) ?? Infinity))
    const current = open.shift()!
    if (current.x === end.x && current.y === end.y) {
      const path: Vec2[] = []
      let currKey = key(current)
      let node = current
      while (cameFrom.has(currKey)) {
        path.unshift(cellToWorld(grid, node))
        node = cameFrom.get(currKey)!
        currKey = key(node)
      }
      path.unshift(cellToWorld(grid, start))
      return path
    }

    for (const next of neighbors(grid, current)) {
      const tentative = (gScore.get(key(current)) ?? Infinity) + 1
      if (tentative < (gScore.get(key(next)) ?? Infinity)) {
        cameFrom.set(key(next), current)
        gScore.set(key(next), tentative)
        fScore.set(key(next), tentative + heuristic(next, end))
        if (!open.find((c) => c.x === next.x && c.y === next.y)) {
          open.push(next)
        }
      }
    }
  }

  return [cellToWorld(grid, start), cellToWorld(grid, end)]
}
