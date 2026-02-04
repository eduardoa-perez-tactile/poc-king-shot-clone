import { HERO_DEFS, TROOP_DEFS } from '../config/balance'
import { getHeroStats } from '../game/logic'
import { GameState, TroopCounts, TroopType } from '../game/types'
import { buildGrid, findPath, Grid } from './pathfinding'
import {
  EntityState,
  HeroAbility,
  HeroState,
  MissionDefinition,
  MissionResult,
  MissionStats,
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

const typeMultiplier = (attacker: TroopType, target: TroopType) => {
  if (attacker === 'infantry' && target === 'cavalry') return 1.2
  if (attacker === 'cavalry' && target === 'archer') return 1.2
  if (attacker === 'archer' && target === 'infantry') return 1.2
  if (attacker === 'infantry' && target === 'archer') return 0.85
  if (attacker === 'cavalry' && target === 'infantry') return 0.85
  if (attacker === 'archer' && target === 'cavalry') return 0.85
  return 1
}

const createTroopEntity = (type: TroopType, team: 'player' | 'enemy', pos: Vec2, squadSize: number): EntityState => {
  const troop = TROOP_DEFS[type]
  const hp = troop.hp * squadSize
  const attack = troop.attack * squadSize
  const range = type === 'archer' ? 160 : 50
  const speed = type === 'cavalry' ? 100 : type === 'infantry' ? 70 : 60
  return {
    id: ENTITY_ID(),
    team,
    kind: type,
    pos: { ...pos },
    radius: 14,
    hp,
    maxHp: hp,
    attack,
    range,
    speed,
    cooldown: type === 'archer' ? 1.2 : 1,
    cooldownLeft: 0,
    order: { type: 'stop' },
    targetId: undefined,
    path: [],
    troopCount: squadSize,
    buffs: []
  }
}

const createHeroEntity = (meta: GameState, heroId: string, pos: Vec2): { entity: EntityState; hero: HeroState } | null => {
  const hero = meta.heroes.find((h) => h.id === heroId)
  if (!hero) return null
  const stats = getHeroStats(hero)
  const hp = stats.hp * 2.2
  const entity: EntityState = {
    id: ENTITY_ID(),
    team: 'player',
    kind: 'hero',
    pos: { ...pos },
    radius: 16,
    hp,
    maxHp: hp,
    attack: stats.attack * 1.6,
    range: 140,
    speed: 90,
    cooldown: 0.9,
    cooldownLeft: 0,
    order: { type: 'stop' },
    targetId: undefined,
    path: [],
    buffs: []
  }

  const heroDef = HERO_DEFS.find((h) => h.id === heroId)
  const abilities: HeroAbility[] = [
    {
      id: `${heroId}_cry`,
      name: 'Battle Cry',
      description: 'Boost ally attack in area.',
      cooldown: 18,
      cooldownLeft: 0,
      type: 'area',
      radius: 140
    },
    {
      id: `${heroId}_strike`,
      name: 'Heroic Strike',
      description: 'Deal burst damage to enemies in area.',
      cooldown: 22,
      cooldownLeft: 0,
      type: 'area',
      radius: 90
    }
  ]

  return {
    entity,
    hero: {
      entityId: entity.id,
      abilities,
      aura: {
        radius: 180,
        attackMultiplier: 0.1
      }
    }
  }
}

const createHQ = (team: 'player' | 'enemy', pos: Vec2): EntityState => ({
  id: ENTITY_ID(),
  team,
  kind: 'hq',
  pos: { ...pos },
  radius: 22,
  hp: 1400,
  maxHp: 1400,
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

const emptyStats = (): MissionStats => ({
  time: 0,
  kills: 0,
  losses: 0,
  casualties: { infantry: 0, archer: 0, cavalry: 0 }
})

export const createSimState = (mission: MissionDefinition, meta: GameState, heroId?: string): SimState => {
  const entities: EntityState[] = []
  const playerHQ = createHQ('player', mission.map.playerHQ)
  entities.push(playerHQ)
  if (mission.map.enemyHQ) {
    entities.push(createHQ('enemy', mission.map.enemyHQ))
  }

  const available: TroopCounts = { ...meta.troops }
  mission.startingUnits.forEach((group) => {
    let squads = group.squads
    while (squads > 0 && available[group.type] > 0) {
      const size = Math.min(group.squadSize, available[group.type])
      entities.push(createTroopEntity(group.type, 'player', jitter(mission.map.playerSpawn), size))
      available[group.type] -= size
      squads -= 1
    }
  })

  const heroBundle = heroId ? createHeroEntity(meta, heroId, jitter(mission.map.playerSpawn)) : null
  if (heroBundle) {
    entities.push(heroBundle.entity)
  }

  return {
    time: 0,
    status: 'running',
    entities,
    projectiles: [],
    hero: heroBundle?.hero,
    mission,
    stats: emptyStats(),
    waveIndex: 0
  }
}

const jitter = (pos: Vec2) => ({
  x: pos.x + (Math.random() - 0.5) * 40,
  y: pos.y + (Math.random() - 0.5) * 40
})

const getHeroEntity = (state: SimState) => (state.hero ? state.entities.find((e) => e.id === state.hero?.entityId) : undefined)

const applyAura = (state: SimState, entity: EntityState) => {
  if (!state.hero) return 1
  const hero = getHeroEntity(state)
  if (!hero) return 1
  if (hero.team !== entity.team) return 1
  if (distance(hero.pos, entity.pos) > state.hero.aura.radius) return 1
  return 1 + state.hero.aura.attackMultiplier
}

const applyBuffs = (entity: EntityState, time: number) => {
  entity.buffs = entity.buffs.filter((buff) => buff.expiresAt > time)
  const attackBuff = entity.buffs.reduce((mult, buff) => (buff.type === 'attack' ? mult + buff.multiplier : mult), 0)
  return 1 + attackBuff
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
    if (entity.team !== 'enemy' || entity.kind === 'hq') return
    if (entity.order.type === 'stop' || entity.order.type === 'move') {
      if (playerHQ) {
        entity.order = { type: 'attackMove', targetPos: { ...playerHQ.pos } }
        entity.path = []
        ensurePath(grid, entity, playerHQ.pos)
      }
    }
  })
}

export const stepSim = (state: SimState, dt: number, grid: Grid): SimState => {
  if (state.status !== 'running') return state
  const time = state.time + dt
  const entities = state.entities.map((entity) => ({ ...entity, pos: { ...entity.pos }, buffs: [...entity.buffs] }))
  const projectiles = state.projectiles.map((proj) => ({ ...proj, pos: { ...proj.pos } }))
  const stats: MissionStats = { ...state.stats, casualties: { ...state.stats.casualties } }

  const sim: SimState = { ...state, time, entities, projectiles, stats }

  // spawn waves
  while (sim.waveIndex < sim.mission.waves.length && time >= sim.mission.waves[sim.waveIndex].timeSec) {
    const wave = sim.mission.waves[sim.waveIndex]
    wave.units.forEach((group) => {
      for (let i = 0; i < group.squads; i += 1) {
        entities.push(createTroopEntity(group.type, 'enemy', jitter(sim.mission.map.enemySpawn), group.squadSize))
      }
    })
    sim.waveIndex += 1
  }

  issueDefaultEnemyOrders(sim, grid)

  const entityMap = new Map(entities.map((e) => [e.id, e]))

  // update hero cooldowns
  if (sim.hero) {
    sim.hero = {
      ...sim.hero,
      abilities: sim.hero.abilities.map((ability) => ({
        ...ability,
        cooldownLeft: Math.max(0, ability.cooldownLeft - dt)
      }))
    }
  }

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
        const dist = distance(entity.pos, activeTarget.pos)
        if (dist <= entity.range) {
          if (entity.cooldownLeft <= 0) {
            const buffMult = applyBuffs(entity, time)
            const auraMult = applyAura(sim, entity)
            const multiplier = entity.kind === 'infantry' || entity.kind === 'archer' || entity.kind === 'cavalry'
              ? typeMultiplier(entity.kind, activeTarget.kind as TroopType)
              : 1
            const dmg = entity.attack * buffMult * auraMult * multiplier
            if (entity.kind === 'archer' || entity.kind === 'hero') {
              projectiles.push({
                id: PROJECTILE_ID(),
                pos: { ...entity.pos },
                targetId: activeTarget.id,
                speed: entity.kind === 'hero' ? 260 : 240,
                damage: dmg,
                team: entity.team
              })
            } else {
              activeTarget.hp -= dmg
            }
            entity.cooldownLeft = entity.cooldown
          }
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

    if (!entity.targetId && entity.order.type === 'stop') {
      const auto = findClosestEnemy(entity, entities, entity.range)
      if (auto) {
        entity.targetId = auto.id
        entity.order = { type: 'attack', targetPos: { ...auto.pos }, targetId: auto.id }
      }
    }
  })

  // projectiles update
  projectiles.forEach((proj) => {
    const target = entityMap.get(proj.targetId)
    if (!target || target.hp <= 0) {
      proj.speed = 0
      return
    }
    const dist = distance(proj.pos, target.pos)
    if (dist < 6) {
      target.hp -= proj.damage
      proj.speed = 0
      return
    }
    const dirX = (target.pos.x - proj.pos.x) / dist
    const dirY = (target.pos.y - proj.pos.y) / dist
    proj.pos.x += dirX * proj.speed * dt
    proj.pos.y += dirY * proj.speed * dt
  })

  sim.projectiles = projectiles.filter((proj) => proj.speed > 0)

  // remove dead
  const alive = entities.filter((entity) => entity.hp > 0)
  entities.forEach((entity) => {
    if (entity.hp > 0) return
    if (entity.team === 'enemy' && entity.kind !== 'hq') {
      stats.kills += entity.troopCount ?? 1
    }
    if (entity.team === 'player' && entity.kind !== 'hq') {
      stats.losses += entity.troopCount ?? 1
      if (entity.kind === 'infantry' || entity.kind === 'archer' || entity.kind === 'cavalry') {
        stats.casualties[entity.kind] += entity.troopCount ?? 0
      }
    }
  })

  sim.entities = alive
  stats.time = time

  const playerHQ = alive.find((entity) => entity.team === 'player' && entity.kind === 'hq')
  const enemyHQ = alive.find((entity) => entity.team === 'enemy' && entity.kind === 'hq')
  const playerUnits = alive.filter((entity) => entity.team === 'player' && entity.kind !== 'hq')

  if (!playerHQ || playerUnits.length === 0) {
    sim.status = 'lose'
  }

  if (sim.mission.objective.type === 'destroy_hq' && !enemyHQ) {
    sim.status = 'win'
  }
  if (sim.mission.objective.type === 'survive' && time >= sim.mission.objective.durationSec && playerHQ) {
    sim.status = 'win'
  }

  return sim
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

export const useAbility = (state: SimState, abilityId: string, targetPos: Vec2): SimState => {
  if (!state.hero) return state
  const heroEntity = getHeroEntity(state)
  if (!heroEntity) return state

  const abilities = state.hero.abilities.map((ability) => {
    if (ability.id !== abilityId) return ability
    if (ability.cooldownLeft > 0) return ability
    return { ...ability, cooldownLeft: ability.cooldown }
  })

  const active = state.hero.abilities.find((ability) => ability.id === abilityId)
  if (!active || active.cooldownLeft > 0) return state

  const entities = state.entities.map((entity) => ({ ...entity, buffs: [...entity.buffs] }))

  if (abilityId.endsWith('cry')) {
    entities.forEach((entity) => {
      if (entity.team !== 'player') return
      if (distance(entity.pos, targetPos) <= active.radius) {
        entity.buffs.push({
          type: 'attack',
          multiplier: 0.3,
          expiresAt: state.time + 6
        })
      }
    })
  }

  if (abilityId.endsWith('strike')) {
    entities.forEach((entity) => {
      if (entity.team !== 'enemy') return
      if (distance(entity.pos, targetPos) <= active.radius) {
        entity.hp -= 45
      }
    })
  }

  return { ...state, entities, hero: { ...state.hero, abilities } }
}

export const createGridForMission = (mission: MissionDefinition) => buildGrid(mission.map.width, mission.map.height, 40, mission.map.obstacles)

export const buildMissionResult = (state: SimState): MissionResult => ({
  victory: state.status === 'win',
  stats: state.stats,
  rewards: state.status === 'win' ? state.mission.rewards : { resources: { food: 0, wood: 0, stone: 0, gold: 0 }, xpItems: 0, keys: { gold: 0, platinum: 0 } }
})
