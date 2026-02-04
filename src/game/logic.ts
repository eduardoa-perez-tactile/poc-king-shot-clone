import {
  BUILDING_DEFS,
  ENEMIES,
  EVENT_CONFIG,
  GEAR_DEFS,
  HERO_DEFS,
  QUEST_CHAPTERS,
  QUEST_DAILY,
  REWARD_TABLE,
  STARTING_BUILDINGS,
  STARTING_KEYS,
  STARTING_RESOURCES,
  TOWN_SIZE,
  TRAINING_BASE,
  TROOP_DEFS
} from '../config/balance'
import {
  BuildingId,
  BuildingState,
  CombatResult,
  EventState,
  GameState,
  HeroInstance,
  QuestProgress,
  QuestState,
  Resources,
  Squad,
  TrainingQueue,
  TroopCounts,
  TroopType
} from './types'
import { simulateCombat } from './combat'

const RESOURCE_KEYS: (keyof Resources)[] = ['food', 'wood', 'stone', 'gold']

const emptyResources = (): Resources => ({ food: 0, wood: 0, stone: 0, gold: 0 })

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const createInitialState = (): GameState => {
  const townTiles = []
  for (let y = 0; y < TOWN_SIZE; y += 1) {
    for (let x = 0; x < TOWN_SIZE; x += 1) {
      townTiles.push({ x, y })
    }
  }

  const buildings: BuildingState[] = STARTING_BUILDINGS.map((id) => ({ id, level: 1 }))
  const startingPositions: [number, number, BuildingId][] = [
    [1, 1, 'town_hall'],
    [0, 2, 'farm'],
    [2, 2, 'lumber_mill'],
    [4, 1, 'barracks'],
    [3, 3, 'hero_hall']
  ]
  startingPositions.forEach(([x, y, id]) => {
    const tile = townTiles.find((t) => t.x === x && t.y === y)
    if (tile) tile.buildingId = id
  })

  const now = Date.now()
  const questState = createQuestState()
  return {
    saveVersion: 2,
    resources: { ...STARTING_RESOURCES },
    banked: emptyResources(),
    buildings,
    townTiles,
    heroes: [],
    inventory: {
      xpItems: 2,
      gear: [],
      keys: { ...STARTING_KEYS }
    },
    troops: { infantry: 30, archer: 15, cavalry: 5 },
    squad: {
      leaderId: undefined,
      supportIds: [],
      composition: { infantry: 20, archer: 10, cavalry: 5 }
    },
    quests: questState,
    event: createEventState(now),
    settings: { sound: true },
    tutorial: {
      steps: {
        collect: false,
        upgrade: false,
        summon: false,
        train: false,
        raid: false
      },
      dismissed: false
    },
    missions: {
      unlocked: 1,
      completed: []
    },
    lastTick: now,
    totalTroopsTrained: 0
  }
}

export const createQuestState = (): QuestState => {
  const daily = QUEST_DAILY.map(templateToProgress)
  const chapters = QUEST_CHAPTERS.map(templateToProgress)
  return {
    daily,
    chapterIndex: 0,
    chapters,
    lastDailyReset: toDateKey(new Date())
  }
}

const templateToProgress = (template: { id: string; title: string; description: string; target: number; reward: Resources }): QuestProgress => ({
  id: template.id,
  title: template.title,
  description: template.description,
  target: template.target,
  progress: 0,
  completed: false,
  claimed: false,
  reward: { ...template.reward }
})

export const getBuildingLevel = (state: GameState, id: BuildingId) =>
  state.buildings.find((b) => b.id === id)?.level ?? 0

export const getTroopCap = (state: GameState) => {
  const level = getBuildingLevel(state, 'barracks')
  return 60 + level * 40
}

export const getProductionRates = (state: GameState): Resources => {
  const rates = emptyResources()
  state.buildings.forEach((building) => {
    const def = BUILDING_DEFS[building.id]
    if (!def.productionPerMin) return
    RESOURCE_KEYS.forEach((key) => {
      const amount = def.productionPerMin?.[key] ?? 0
      rates[key] += amount * building.level
    })
  })

  const labLevel = getBuildingLevel(state, 'research_lab')
  if (labLevel > 0) {
    const bonus = 1 + labLevel * 0.05
    RESOURCE_KEYS.forEach((key) => {
      rates[key] *= bonus
    })
  }
  return rates
}

export const getUpgradeCost = (id: BuildingId, nextLevel: number): Resources => {
  const def = BUILDING_DEFS[id]
  const scale = Math.pow(def.costScale, nextLevel - 1)
  return {
    food: Math.floor(def.baseCost.food * scale),
    wood: Math.floor(def.baseCost.wood * scale),
    stone: Math.floor(def.baseCost.stone * scale),
    gold: Math.floor(def.baseCost.gold * scale)
  }
}

export const getUpgradeTime = (id: BuildingId, nextLevel: number) => {
  const def = BUILDING_DEFS[id]
  const scale = Math.pow(def.timeScale, nextLevel - 1)
  return Math.floor(def.baseTimeSec * scale)
}

export const canAfford = (resources: Resources, cost: Resources) =>
  RESOURCE_KEYS.every((key) => resources[key] >= cost[key])

export const addResources = (base: Resources, delta: Resources): Resources => ({
  food: base.food + delta.food,
  wood: base.wood + delta.wood,
  stone: base.stone + delta.stone,
  gold: base.gold + delta.gold
})

export const subtractResources = (base: Resources, delta: Resources): Resources => ({
  food: base.food - delta.food,
  wood: base.wood - delta.wood,
  stone: base.stone - delta.stone,
  gold: base.gold - delta.gold
})

export const tickState = (state: GameState, now: number): GameState => {
  if (now <= state.lastTick) return state
  const deltaMs = now - state.lastTick
  const productionPerMin = getProductionRates(state)
  const productionDelta: Resources = {
    food: (productionPerMin.food * deltaMs) / 60000,
    wood: (productionPerMin.wood * deltaMs) / 60000,
    stone: (productionPerMin.stone * deltaMs) / 60000,
    gold: (productionPerMin.gold * deltaMs) / 60000
  }

  const updatedBanked = {
    food: state.banked.food + productionDelta.food,
    wood: state.banked.wood + productionDelta.wood,
    stone: state.banked.stone + productionDelta.stone,
    gold: state.banked.gold + productionDelta.gold
  }

  let updatedState: GameState = { ...state, banked: updatedBanked, lastTick: now }
  updatedState = checkUpgradeCompletion(updatedState, now)
  updatedState = checkTrainingCompletion(updatedState, now)
  updatedState = checkDailyReset(updatedState, now)
  updatedState = checkEventEnd(updatedState, now)

  return updatedState
}

const checkUpgradeCompletion = (state: GameState, now: number): GameState => {
  const queue = state.upgradeQueue
  if (!queue || now < queue.endsAt) return state
  let buildings = state.buildings
  const existing = state.buildings.find((b) => b.id === queue.buildingId)
  if (existing) {
    buildings = state.buildings.map((b) =>
      b.id === queue.buildingId ? { ...b, level: b.level + 1 } : b
    )
  } else {
    buildings = [...state.buildings, { id: queue.buildingId, level: 1 }]
  }

  let townTiles = state.townTiles
  if (!existing) {
    const preferred = queue.buildTile
      ? townTiles.find((tile) => tile.x === queue.buildTile?.x && tile.y === queue.buildTile?.y && !tile.buildingId)
      : undefined
    const empty = preferred ?? townTiles.find((tile) => !tile.buildingId)
    if (empty) {
      townTiles = townTiles.map((tile) =>
        tile === empty ? { ...tile, buildingId: queue.buildingId } : tile
      )
    }
  }

  const updated = {
    ...state,
    buildings,
    townTiles,
    upgradeQueue: undefined
  }
  const eventUpdated = addEventPoints(updated, 20)
  return applyQuestProgress(eventUpdated, 'upgrade', 1)
}

const checkTrainingCompletion = (state: GameState, now: number): GameState => {
  const queue = state.trainingQueue
  if (!queue || now < queue.endsAt) return state
  const troops = { ...state.troops }
  troops[queue.type] += queue.amount
  const totalTroopsTrained = state.totalTroopsTrained + queue.amount
  const updated = { ...state, troops, trainingQueue: undefined, totalTroopsTrained }
  const questUpdated = applyQuestProgress(updated, 'train', queue.amount)
  return addEventPoints(questUpdated, Math.floor(queue.amount / 5))
}

const checkDailyReset = (state: GameState, now: number): GameState => {
  const todayKey = toDateKey(new Date(now))
  if (state.quests.lastDailyReset === todayKey) return state
  return {
    ...state,
    quests: {
      ...state.quests,
      daily: QUEST_DAILY.map(templateToProgress),
      lastDailyReset: todayKey
    }
  }
}

const checkEventEnd = (state: GameState, now: number): GameState => {
  if (now <= state.event.endAt) return state
  return {
    ...state,
    event: { ...state.event, endAt: state.event.endAt }
  }
}

export const collectBanked = (state: GameState): GameState => {
  const collected = {
    food: Math.floor(state.banked.food),
    wood: Math.floor(state.banked.wood),
    stone: Math.floor(state.banked.stone),
    gold: Math.floor(state.banked.gold)
  }
  const newResources = addResources(state.resources, collected)
  const newBanked = {
    food: state.banked.food - collected.food,
    wood: state.banked.wood - collected.wood,
    stone: state.banked.stone - collected.stone,
    gold: state.banked.gold - collected.gold
  }
  const updated = { ...state, resources: newResources, banked: newBanked }
  return applyTutorial(updated, 'collect')
}

export const startUpgrade = (state: GameState, id: BuildingId, now: number, buildTile?: { x: number; y: number }): GameState => {
  if (state.upgradeQueue) return state
  const building = state.buildings.find((b) => b.id === id)
  const currentLevel = building?.level ?? 0
  if (!building) {
    const hasSpace = state.townTiles.some((tile) => !tile.buildingId)
    if (!hasSpace) return state
    if (buildTile) {
      const target = state.townTiles.find((tile) => tile.x === buildTile.x && tile.y === buildTile.y)
      if (!target || target.buildingId) return state
    }
  }
  const nextLevel = currentLevel + 1
  if (nextLevel > BUILDING_DEFS[id].maxLevel) return state
  const cost = getUpgradeCost(id, nextLevel)
  if (!canAfford(state.resources, cost)) return state
  const timeSec = getUpgradeTime(id, nextLevel)
  return {
    ...state,
    resources: subtractResources(state.resources, cost),
    upgradeQueue: {
      buildingId: id,
      startedAt: now,
      endsAt: now + timeSec * 1000,
      buildTile: building ? undefined : buildTile
    }
  }
}

export const startTraining = (state: GameState, type: TroopType, amount: number, now: number): GameState => {
  if (state.trainingQueue) return state
  if (amount <= 0) return state
  const cap = getTroopCap(state)
  const current = state.troops.infantry + state.troops.archer + state.troops.cavalry
  if (current + amount > cap) return state
  const costPer = TRAINING_BASE.cost[type]
  const totalCost: Resources = {
    food: costPer.food * amount,
    wood: costPer.wood * amount,
    stone: costPer.stone * amount,
    gold: costPer.gold * amount
  }
  if (!canAfford(state.resources, totalCost)) return state
  const timeSec = TRAINING_BASE.timeSec[type] * amount
  return {
    ...state,
    resources: subtractResources(state.resources, totalCost),
    trainingQueue: {
      type,
      amount,
      startedAt: now,
      endsAt: now + timeSec * 1000
    }
  }
}

export const summonHero = (state: GameState, keyType: 'gold' | 'platinum'): { state: GameState; heroes: HeroInstance[] } => {
  if (state.inventory.keys[keyType] <= 0) return { state, heroes: [] }
  const updatedInventory = {
    ...state.inventory,
    keys: { ...state.inventory.keys, [keyType]: state.inventory.keys[keyType] - 1 }
  }

  const guaranteedStarters = ['aria', 'brom', 'selene']
  const heroes: HeroInstance[] = []

  if (state.heroes.length === 0) {
    guaranteedStarters.forEach((id) => {
      heroes.push({ id, level: 1, xp: 0, gear: {} })
    })
  } else {
    const rarity = rollRarity(keyType)
    const pool = HERO_DEFS.filter((h) => h.rarity === rarity)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    heroes.push({ id: pick.id, level: 1, xp: 0, gear: {} })
  }

  const mergedHeroes = [...state.heroes]
  heroes.forEach((hero) => {
    mergedHeroes.push(hero)
  })

  const updated = {
    ...state,
    heroes: mergedHeroes,
    inventory: updatedInventory
  }

  return { state: applyTutorial(updated, 'summon'), heroes }
}

const rollRarity = (keyType: 'gold' | 'platinum') => {
  const table = keyType === 'gold' ?
    [
      { rarity: 'Common', weight: 70 },
      { rarity: 'Rare', weight: 25 },
      { rarity: 'Epic', weight: 4 },
      { rarity: 'Legendary', weight: 1 }
    ] :
    [
      { rarity: 'Common', weight: 40 },
      { rarity: 'Rare', weight: 35 },
      { rarity: 'Epic', weight: 20 },
      { rarity: 'Legendary', weight: 5 }
    ]
  const total = table.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (const entry of table) {
    roll -= entry.weight
    if (roll <= 0) return entry.rarity
  }
  return 'Common'
}

export const levelUpHero = (state: GameState, heroId: string, levels: number): GameState => {
  const heroIndex = state.heroes.findIndex((h) => h.id === heroId)
  if (heroIndex === -1) return state
  const costPerLevel = 1
  const totalCost = costPerLevel * levels
  if (state.inventory.xpItems < totalCost) return state

  const heroes = [...state.heroes]
  const hero = { ...heroes[heroIndex] }
  hero.level += levels
  hero.xp += levels * 100
  heroes[heroIndex] = hero

  return {
    ...state,
    heroes,
    inventory: { ...state.inventory, xpItems: state.inventory.xpItems - totalCost }
  }
}

export const equipGear = (state: GameState, heroId: string, gearId: string): GameState => {
  const heroIndex = state.heroes.findIndex((h) => h.id === heroId)
  const gearDef = GEAR_DEFS.find((g) => g.id === gearId)
  if (heroIndex === -1 || !gearDef) return state
  const heroes = [...state.heroes]
  const hero = { ...heroes[heroIndex], gear: { ...heroes[heroIndex].gear, [gearDef.slot]: gearId } }
  heroes[heroIndex] = hero
  return { ...state, heroes }
}

export const updateSquad = (state: GameState, squad: Squad): GameState => ({
  ...state,
  squad
})

export const runCombat = (state: GameState, mode: 'raid' | 'waves'): { state: GameState; result: CombatResult } => {
  const encounter = ENEMIES[Math.floor(Math.random() * ENEMIES.length)]
  const result = simulateCombat(state, encounter, mode)

  let updatedState = state
  if (result.victory) {
    updatedState = {
      ...updatedState,
      resources: addResources(updatedState.resources, result.rewards.resources),
      inventory: {
        ...updatedState.inventory,
        xpItems: updatedState.inventory.xpItems + result.rewards.xpItems,
        gear: [...updatedState.inventory.gear, ...result.rewards.gearDrops],
        keys: {
          gold: updatedState.inventory.keys.gold + result.rewards.keys.gold,
          platinum: updatedState.inventory.keys.platinum + result.rewards.keys.platinum
        }
      }
    }

    if (mode === 'raid') {
      updatedState = applyQuestProgress(updatedState, 'raid', 1)
    }
    if (mode === 'waves') {
      updatedState = applyQuestProgress(updatedState, 'waves', 1)
    }
    updatedState = addEventPoints(updatedState, mode === 'raid' ? 15 : 25)
  }

  updatedState = {
    ...updatedState,
    troops: {
      infantry: Math.max(0, updatedState.troops.infantry - result.casualties.infantry),
      archer: Math.max(0, updatedState.troops.archer - result.casualties.archer),
      cavalry: Math.max(0, updatedState.troops.cavalry - result.casualties.cavalry)
    }
  }

  updatedState = applyTutorial(updatedState, 'raid')

  return { state: updatedState, result }
}

const applyQuestProgress = (state: GameState, type: 'upgrade' | 'train' | 'raid' | 'waves', amount: number): GameState => {
  const daily = state.quests.daily.map((quest) => {
    if (quest.completed || quest.claimed) return quest
    if (type === 'upgrade' && quest.id === 'daily_upgrade') {
      return updateQuestProgress(quest, amount)
    }
    if (type === 'train' && quest.id === 'daily_train') {
      return updateQuestProgress(quest, amount)
    }
    if (type === 'raid' && quest.id === 'daily_raid') {
      return updateQuestProgress(quest, amount)
    }
    return quest
  })

  const chapters = state.quests.chapters.map((quest, index) => {
    if (index !== state.quests.chapterIndex || quest.completed) return quest
    if (quest.id === 'chapter_th3' && type === 'upgrade') {
      const level = getBuildingLevel(state, 'town_hall')
      const progress = Math.min(level, quest.target)
      return { ...quest, progress, completed: progress >= quest.target }
    }
    if (quest.id === 'chapter_troops' && type === 'train') {
      return updateQuestProgress(quest, amount)
    }
    if (quest.id === 'chapter_waves' && type === 'waves') {
      return updateQuestProgress(quest, amount)
    }
    return quest
  })

  return {
    ...state,
    quests: { ...state.quests, daily, chapters }
  }
}

const updateQuestProgress = (quest: QuestProgress, amount: number): QuestProgress => {
  const progress = Math.min(quest.target, quest.progress + amount)
  return { ...quest, progress, completed: progress >= quest.target }
}

export const claimQuestReward = (state: GameState, questId: string, group: 'daily' | 'chapter'): GameState => {
  const quests = group === 'daily' ? state.quests.daily : state.quests.chapters
  const index = quests.findIndex((q) => q.id === questId)
  if (index === -1) return state
  const quest = quests[index]
  if (!quest.completed || quest.claimed) return state
  const updatedQuest = { ...quest, claimed: true }
  const updatedQuests = [...quests]
  updatedQuests[index] = updatedQuest

  let questsState: QuestState = state.quests
  if (group === 'daily') {
    questsState = { ...state.quests, daily: updatedQuests }
  } else {
    const nextIndex = questId === state.quests.chapters[state.quests.chapterIndex]?.id
      ? Math.min(state.quests.chapterIndex + 1, state.quests.chapters.length - 1)
      : state.quests.chapterIndex
    questsState = { ...state.quests, chapters: updatedQuests, chapterIndex: nextIndex }
  }

  return {
    ...state,
    quests: questsState,
    resources: addResources(state.resources, quest.reward)
  }
}

export const createEventState = (now: number): EventState => {
  const durationMs = EVENT_CONFIG.durationMin * 60 * 1000
  return {
    startAt: now,
    endAt: now + durationMs,
    points: 0,
    best: 0,
    claimedMilestones: []
  }
}

export const restartEvent = (state: GameState, now: number): GameState => ({
  ...state,
  event: createEventState(now)
})

const addEventPoints = (state: GameState, amount: number): GameState => {
  if (Date.now() > state.event.endAt) return state
  const points = state.event.points + amount
  const best = Math.max(state.event.best, points)
  return { ...state, event: { ...state.event, points, best } }
}

export const claimEventMilestone = (state: GameState, index: number): GameState => {
  if (state.event.claimedMilestones.includes(index)) return state
  const milestone = EVENT_CONFIG.milestones[index]
  if (!milestone || state.event.points < milestone.points) return state
  return {
    ...state,
    event: { ...state.event, claimedMilestones: [...state.event.claimedMilestones, index] },
    resources: addResources(state.resources, milestone.reward)
  }
}

export const applyTutorial = (state: GameState, key: keyof GameState['tutorial']['steps']): GameState => {
  if (state.tutorial.steps[key]) return state
  return {
    ...state,
    tutorial: {
      ...state.tutorial,
      steps: { ...state.tutorial.steps, [key]: true }
    }
  }
}

export const resetGame = (): GameState => createInitialState()

export const getHeroStats = (hero: HeroInstance) => {
  const def = HERO_DEFS.find((h) => h.id === hero.id)
  if (!def) return { attack: 0, defense: 0, hp: 0 }
  const base = {
    attack: def.baseStats.attack + hero.level * 2,
    defense: def.baseStats.defense + hero.level * 1,
    hp: def.baseStats.hp + hero.level * 6
  }
  const gearStats = hero.gear
  const applyGear = (id?: string) => {
    if (!id) return
    const gear = GEAR_DEFS.find((g) => g.id === id)
    if (!gear) return
    base.attack += gear.stats.attack ?? 0
    base.defense += gear.stats.defense ?? 0
    base.hp += gear.stats.hp ?? 0
  }
  applyGear(gearStats.weapon)
  applyGear(gearStats.armor)
  applyGear(gearStats.charm)
  return base
}

export const getTrainingCost = (type: TroopType, amount: number): Resources => {
  const cost = TRAINING_BASE.cost[type]
  return {
    food: cost.food * amount,
    wood: cost.wood * amount,
    stone: cost.stone * amount,
    gold: cost.gold * amount
  }
}

export const getEnemyScale = (mode: 'raid' | 'waves', wave: number) => {
  const base = mode === 'raid' ? 1 : 0.8
  return base + wave * 0.2
}

export const getEncounterRewards = (mode: 'raid' | 'waves') => {
  return REWARD_TABLE[mode]
}

export const getRandomGear = () => {
  const weights = [
    { rarity: 'Common', weight: 55 },
    { rarity: 'Rare', weight: 30 },
    { rarity: 'Epic', weight: 12 },
    { rarity: 'Legendary', weight: 3 }
  ]
  const total = weights.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  let rarity = 'Common'
  for (const entry of weights) {
    roll -= entry.weight
    if (roll <= 0) {
      rarity = entry.rarity
      break
    }
  }
  const pool = GEAR_DEFS.filter((g) => g.rarity === rarity)
  return pool[Math.floor(Math.random() * pool.length)].id
}

export const getTrainingTime = (type: TroopType, amount: number) => TRAINING_BASE.timeSec[type] * amount

export const getTownTileLabel = (tile: { buildingId?: BuildingId }) => {
  if (!tile.buildingId) return 'Empty'
  return BUILDING_DEFS[tile.buildingId].name
}

export const getTroopCountsFromSquad = (state: GameState) => {
  const composition = state.squad.composition
  return {
    infantry: Math.min(state.troops.infantry, composition.infantry),
    archer: Math.min(state.troops.archer, composition.archer),
    cavalry: Math.min(state.troops.cavalry, composition.cavalry)
  }
}

export const estimatePower = (troops: TroopCounts, heroes: HeroInstance[]) => {
  const heroPower = heroes.reduce((sum, hero) => sum + getHeroStats(hero).attack + getHeroStats(hero).defense, 0)
  const troopPower = troops.infantry * TROOP_DEFS.infantry.attack + troops.archer * TROOP_DEFS.archer.attack + troops.cavalry * TROOP_DEFS.cavalry.attack
  return Math.round(heroPower + troopPower)
}

export const estimateTroopPower = (troops: TroopCounts) => {
  const troopPower = troops.infantry * TROOP_DEFS.infantry.attack + troops.archer * TROOP_DEFS.archer.attack + troops.cavalry * TROOP_DEFS.cavalry.attack
  return Math.round(troopPower)
}
