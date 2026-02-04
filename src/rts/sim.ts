import { UNIT_DEFS, UnitType } from '../config/units'
import { getHQBonusHp, getUnitStatMultipliers } from '../run/economy'
import { RunState } from '../run/types'
import { buildGrid, findPath, Grid } from './pathfinding'
import {
  CombatDefinition,
  CombatEffect,
  CombatResult,
  CombatStats,
  EntityState,
  Order,
  Projectile,
  SimState,
  Vec2
} from './types'

const ENTITY_ID = (() => {
  let id = 0
  return () => `e_${id++}`
})()

const PROJECTILE_ID = (() => {
  let id = 0
  return () => `p_${id++}`
})()

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

const typeMultiplier = (attacker: UnitType, target: UnitType) => {
  if (attacker === 'infantry' && target === 'cavalry') return 1.2
  if (attacker === 'cavalry' && target === 'archer') return 1.2
  if (attacker === 'archer' && target === 'infantry') return 1.2
  if (attacker === 'infantry' && target === 'archer') return 0.85
  if (attacker === 'cavalry' && target === 'infantry') return 0.85
  if (attacker === 'archer' && target === 'cavalry') return 0.85
  return 1
}

const jitter = (pos: Vec2) => ({
  x: pos.x + (Math.random() - 0.5) * 40,
  y: pos.y + (Math.random() - 0.5) * 40
})

const createTroopEntity = (
  type: UnitType,
  team: 'player' | 'enemy',
  pos: Vec2,
  squadSize: number,
  multipliers: { hp: number; attack: number },
  squadId?: string,
  isBoss?: boolean
): EntityState => {
  const troop = UNIT_DEFS[type]
  const hp = troop.stats.hp * squadSize * multipliers.hp
  const attack = troop.stats.attack * squadSize * multipliers.attack
  return {
    id: ENTITY_ID(),
    team,
    kind: type,
    pos: { ...pos },
    radius: 14,
    hp,
    maxHp: hp,
    attack,
    range: troop.stats.range,
    speed: troop.stats.speed,
    cooldown: troop.stats.cooldown,
    cooldownLeft: 0,
    order: { type: 'stop' },
    targetId: undefined,
    path: [],
    troopCount: squadSize,
    buffs: [],
    squadId,
    isBoss
  }
}

const createHQ = (pos: Vec2, hp: number): EntityState => ({
  id: ENTITY_ID(),
  team: 'player',
  kind: 'hq',
  pos: { ...pos },
  radius: 24,
  hp,
  maxHp: hp,
  attack: 0,
  range: 0,
  speed: 0,
  cooldown: 1,
  cooldownLeft: 0,
  order: { type: 'stop' },
  targetId: undefined,
  path: [],
  buffs: []
})

const createHeroEntity = (pos: Vec2, hp: number, attack: number, range: number, speed: number, cooldown: number): EntityState => ({
  id: ENTITY_ID(),
  team: 'player',
  kind: 'hero',
  pos: { ...pos },
  radius: 18,
  hp,
  maxHp: hp,
  attack,
  range,
  speed,
  cooldown,
  cooldownLeft: 0,
  order: { type: 'stop' },
  targetId: undefined,
  path: [],
  buffs: []
})

const emptyStats = (): CombatStats => ({
  time: 0,
  kills: 0,
  losses: 0,
  lostSquads: []
})

const addEffect = (
  effects: CombatEffect[],
  kind: CombatEffect['kind'],
  pos: Vec2,
  radius: number,
  color: string,
  time: number,
  duration: number
) => {
  effects.push({
    kind,
    pos: { ...pos },
    radius,
    color,
    bornAt: time,
    expiresAt: time + duration
  })
}

export const createSimState = (
  combat: CombatDefinition,
  run: RunState,
  options?: { heroPos?: Vec2; heroHp?: number }
): SimState => {
  const entities: EntityState[] = []
  const hqHp = combat.hqBaseHp + getHQBonusHp(run)
  entities.push(createHQ(combat.map.playerHQ, hqHp))

  const heroStats = combat.hero.stats
  const heroHp = options?.heroHp ?? heroStats.hp
  const heroPos = options?.heroPos ?? combat.map.playerSpawn
  const hero = createHeroEntity(heroPos, heroHp, heroStats.attack, heroStats.range, heroStats.speed, heroStats.cooldown)
  entities.push(hero)

  const statMultipliers = getUnitStatMultipliers(run)
  run.unitRoster.forEach((squad) => {
    const mult = statMultipliers[squad.type]
    const basePos = squad.spawnPos ?? combat.map.playerSpawn
    const spawnPos = squad.spawnPos ? { ...basePos } : jitter(basePos)
    entities.push(
      createTroopEntity(
        squad.type,
        'player',
        spawnPos,
        squad.size,
        { hp: 1 + mult.hp, attack: 1 + mult.attack },
        squad.id
      )
    )
  })

  return {
    time: 0,
    status: 'running',
    entities,
    projectiles: [],
    effects: [],
    combat,
    stats: emptyStats(),
    waveIndex: 0,
    nextWaveAt: 0,
    bossDefeated: false,
    heroEntityId: hero.id,
    heroAbilityCooldowns: { q: 0, e: 0 }
  }
}

const ensurePath = (grid: Grid, entity: EntityState, target: Vec2) => {
  if (entity.path.length === 0) {
    entity.path = findPath(grid, entity.pos, target)
  }
}

const moveAlongPath = (entity: EntityState, dt: number) => {
  if (entity.path.length === 0) return
  const next = entity.path[0]
  const dist = distance(entity.pos, next)
  if (dist < 4) {
    entity.path.shift()
    return
  }
  const dirX = (next.x - entity.pos.x) / dist
  const dirY = (next.y - entity.pos.y) / dist
  entity.pos.x += dirX * entity.speed * dt
  entity.pos.y += dirY * entity.speed * dt
}

const findClosestEnemy = (entity: EntityState, entities: EntityState[], range: number) => {
  let closest: EntityState | undefined
  let best = Infinity
  entities.forEach((other) => {
    if (other.team === entity.team) return
    if (other.hp <= 0) return
    const d = distance(entity.pos, other.pos)
    if (d < range && d < best) {
      best = d
      closest = other
    }
  })
  return closest
}

const issueDefaultEnemyOrders = (state: SimState, grid: Grid) => {
  const playerHQ = state.entities.find((e) => e.team === 'player' && e.kind === 'hq')
  state.entities.forEach((entity) => {
    if (entity.team !== 'enemy') return
    if (entity.order.type === 'stop' || entity.order.type === 'move') {
      if (playerHQ) {
        entity.order = { type: 'attackMove', targetPos: { ...playerHQ.pos } }
        entity.path = []
        ensurePath(grid, entity, playerHQ.pos)
      }
    }
  })
}

const tryImmediateAttack = (
  attacker: EntityState,
  target: EntityState,
  projectiles: Projectile[],
  effects: CombatEffect[],
  time: number
) => {
  const dist = distance(attacker.pos, target.pos)
  if (dist > attacker.range) return
  if (attacker.cooldownLeft > 0) return
  const isUnit = attacker.kind === 'infantry' || attacker.kind === 'archer' || attacker.kind === 'cavalry'
  const targetIsUnit = target.kind === 'infantry' || target.kind === 'archer' || target.kind === 'cavalry'
  const multiplier = isUnit && targetIsUnit ? typeMultiplier(attacker.kind as UnitType, target.kind as UnitType) : 1
  const dmg = attacker.attack * multiplier
  if (attacker.kind === 'archer') {
    projectiles.push({
      id: PROJECTILE_ID(),
      pos: { ...attacker.pos },
      targetId: target.id,
      speed: 240,
      damage: dmg,
      team: attacker.team
    })
  } else {
    target.hp -= dmg
    addEffect(effects, 'hit', target.pos, 18, '#f97316', time, 0.2)
  }
  attacker.cooldownLeft = attacker.cooldown
}

const spawnWave = (sim: SimState) => {
  const wave = sim.combat.waves[sim.waveIndex]
  if (!wave) return
  wave.units.forEach((group) => {
    for (let i = 0; i < group.squads; i += 1) {
      const size = group.squadSize ?? UNIT_DEFS[group.type].squadSize
      const enemyMult = sim.combat.enemyModifiers
      const bossMult = wave.isBoss ? 1.5 : 1
      sim.entities.push(
        createTroopEntity(
          group.type,
          'enemy',
          jitter(sim.combat.map.enemySpawn),
          size,
          {
            hp: enemyMult.hpMultiplier * bossMult,
            attack: enemyMult.attackMultiplier * bossMult
          },
          undefined,
          wave.isBoss
        )
      )
    }
  })
  sim.waveIndex += 1
}

export const stepSim = (state: SimState, dt: number, grid: Grid, mode: 'build' | 'combat'): SimState => {
  if (state.status !== 'running') return state
  const time = state.time + dt
  const entities = state.entities.map((entity) => ({ ...entity, pos: { ...entity.pos }, buffs: [...entity.buffs] }))
  const projectiles = state.projectiles.map((proj) => ({ ...proj, pos: { ...proj.pos } }))
  const effects = state.effects.filter((effect) => effect.expiresAt > time).map((effect) => ({ ...effect }))
  const stats: CombatStats = { ...state.stats, lostSquads: [...state.stats.lostSquads] }

  const sim: SimState = { ...state, time, entities, projectiles, effects, stats }

  const enemiesRemaining = entities.filter((entity) => entity.team === 'enemy').length

  if (mode === 'combat') {
    if (sim.combat.waveMode === 'timed') {
      while (
        sim.waveIndex < sim.combat.waves.length &&
        time >= (sim.combat.waves[sim.waveIndex].spawnTimeSec ?? 0)
      ) {
        spawnWave(sim)
      }
    } else {
      const ready = sim.waveIndex === 0 ? time >= sim.nextWaveAt : enemiesRemaining === 0 && time >= sim.nextWaveAt
      if (sim.waveIndex < sim.combat.waves.length && ready) {
        spawnWave(sim)
        sim.nextWaveAt = time + sim.combat.waveDelaySec
      }
    }

    issueDefaultEnemyOrders(sim, grid)
  }

  const entityMap = new Map(entities.map((e) => [e.id, e]))

  entities.forEach((entity) => {
    if (entity.hp <= 0) return
    entity.cooldownLeft = Math.max(0, entity.cooldownLeft - dt)
    entity.buffs = entity.buffs.filter((buff) => buff.expiresAt > time)

    const target = entity.targetId ? entityMap.get(entity.targetId) : undefined
    if (entity.order.type === 'stop') {
      entity.path = []
      entity.targetId = undefined
    }

    if (entity.order.type === 'move' && entity.order.targetPos) {
      ensurePath(grid, entity, entity.order.targetPos)
      moveAlongPath(entity, dt)
    }

    if ((entity.order.type === 'attack' || entity.order.type === 'attackMove') && entity.order.targetPos) {
      if (!target || target.hp <= 0) {
        const auto = findClosestEnemy(entity, entities, entity.range + 40)
        if (auto) {
          entity.targetId = auto.id
        }
      }

      const activeTarget = entity.targetId ? entityMap.get(entity.targetId) : undefined
      if (activeTarget) {
        if (distance(entity.pos, activeTarget.pos) <= entity.range) {
          tryImmediateAttack(entity, activeTarget, projectiles, effects, time)
        } else {
          ensurePath(grid, entity, activeTarget.pos)
          moveAlongPath(entity, dt)
        }
      } else {
        ensurePath(grid, entity, entity.order.targetPos)
        moveAlongPath(entity, dt)
      }
    }

    if (entity.order.type === 'attackMove' && !entity.targetId && entity.order.targetPos) {
      const auto = findClosestEnemy(entity, entities, 200)
      if (auto) {
        entity.targetId = auto.id
      }
    }

    if (entity.kind !== 'hq' && entity.order.type === 'move') {
      const auto = findClosestEnemy(entity, entities, entity.range)
      if (auto) {
        tryImmediateAttack(entity, auto, projectiles, effects, time)
      }
    }

    if (!entity.targetId && entity.order.type === 'stop') {
      const auto = findClosestEnemy(entity, entities, entity.range)
      if (auto) {
        entity.targetId = auto.id
        entity.order = { type: 'attack', targetPos: { ...auto.pos }, targetId: auto.id }
      }
    }
  })

  projectiles.forEach((proj) => {
    const target = entityMap.get(proj.targetId)
    if (!target || target.hp <= 0) {
      proj.speed = 0
      return
    }
    const dist = distance(proj.pos, target.pos)
    if (dist < 6) {
      target.hp -= proj.damage
      addEffect(effects, 'hit', target.pos, 16, '#38bdf8', time, 0.2)
      proj.speed = 0
      return
    }
    const dirX = (target.pos.x - proj.pos.x) / dist
    const dirY = (target.pos.y - proj.pos.y) / dist
    proj.pos.x += dirX * proj.speed * dt
    proj.pos.y += dirY * proj.speed * dt
  })

  sim.projectiles = projectiles.filter((proj) => proj.speed > 0)

  const alive = entities.filter((entity) => entity.hp > 0)
  entities.forEach((entity) => {
    if (entity.hp > 0) return
    if (entity.team === 'enemy') {
      stats.kills += entity.troopCount ?? 1
      if (entity.isBoss) sim.bossDefeated = true
    }
    if (entity.team === 'player' && entity.kind !== 'hq') {
      stats.losses += 1
      if (entity.squadId && !stats.lostSquads.includes(entity.squadId)) {
        stats.lostSquads.push(entity.squadId)
      }
    }
  })

  sim.entities = alive
  stats.time = time

  if (mode === 'combat') {
    const playerHQ = alive.find((entity) => entity.team === 'player' && entity.kind === 'hq')
    const enemyRemaining = alive.filter((entity) => entity.team === 'enemy').length

    if (!playerHQ) {
      sim.status = 'lose'
    } else if (sim.waveIndex >= sim.combat.waves.length && enemyRemaining === 0) {
      sim.status = 'win'
    }
  }

  return sim
}

export const useHeroAbility = (state: SimState, ability: 'q' | 'e'): SimState => {
  const heroId = state.heroEntityId
  if (!heroId) return state
  const heroDef = state.combat.hero.abilities[ability]
  if (!heroDef) return state
  if (state.time < state.heroAbilityCooldowns[ability]) return state
  const entities = state.entities.map((entity) => ({ ...entity, pos: { ...entity.pos }, buffs: [...entity.buffs] }))
  const effects = state.effects.map((effect) => ({ ...effect }))
  const heroIndex = entities.findIndex((entity) => entity.id === heroId)
  if (heroIndex === -1) return state
  const hero = entities[heroIndex]

  if (ability === 'q' && heroDef.damage && heroDef.radius) {
    entities.forEach((entity) => {
      if (entity.team !== 'enemy') return
      const dist = distance(hero.pos, entity.pos)
      if (dist <= heroDef.radius) {
        entity.hp -= heroDef.damage
        addEffect(effects, 'hit', entity.pos, 22, '#fde047', state.time, 0.25)
      }
    })
    addEffect(effects, 'aoe', hero.pos, heroDef.radius, '#facc15', state.time, 0.35)
  }

  if (ability === 'e') {
    if (heroDef.heal) {
      hero.hp = Math.min(hero.maxHp, hero.hp + heroDef.heal)
      addEffect(effects, 'heal', hero.pos, 80, '#22c55e', state.time, 0.4)
    }
  }

  const heroAbilityCooldowns = {
    ...state.heroAbilityCooldowns,
    [ability]: state.time + heroDef.cooldown
  }
  entities[heroIndex] = hero
  return { ...state, entities, effects, heroAbilityCooldowns }
}

export const issueOrder = (state: SimState, ids: string[], order: Order, grid: Grid): SimState => {
  const entities = state.entities.map((entity) => {
    if (!ids.includes(entity.id)) return entity
    const next: EntityState = { ...entity, order: { ...order }, targetId: order.targetId, path: [] }
    if (order.targetPos) {
      next.path = findPath(grid, next.pos, order.targetPos)
    }
    return next
  })
  return { ...state, entities }
}

export const createGridForCombat = (combat: CombatDefinition) =>
  buildGrid(combat.map.width, combat.map.height, 40, combat.map.obstacles)

export const buildCombatResult = (state: SimState): CombatResult => {
  const hq = state.entities.find((entity) => entity.kind === 'hq')
  const hqHpPercent = hq ? Math.max(0, Math.round((hq.hp / hq.maxHp) * 100)) : 0
  return {
    victory: state.status === 'win',
    stats: state.stats,
    lostSquadIds: state.stats.lostSquads,
    bossDefeated: state.bossDefeated,
    hqHpPercent
  }
}
