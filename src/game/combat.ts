import { ENEMIES, HERO_DEFS, REWARD_TABLE, TROOP_DEFS } from '../config/balance'
import { CombatLogEntry, CombatResult, GameState, TroopCounts } from './types'
import { getEnemyScale, getHeroStats, getRandomGear, getTroopCountsFromSquad } from './logic'

const maxRounds = 12

const totalTroops = (troops: TroopCounts) => troops.infantry + troops.archer + troops.cavalry

const computeTroopPower = (troops: TroopCounts) =>
  troops.infantry * TROOP_DEFS.infantry.attack +
  troops.archer * TROOP_DEFS.archer.attack +
  troops.cavalry * TROOP_DEFS.cavalry.attack

const computeTroopHP = (troops: TroopCounts) =>
  troops.infantry * TROOP_DEFS.infantry.hp +
  troops.archer * TROOP_DEFS.archer.hp +
  troops.cavalry * TROOP_DEFS.cavalry.hp

const applyDamageToHP = (hp: number, damage: number) => Math.max(0, hp - damage)

const advantageMultiplier = (own: TroopCounts, enemy: TroopCounts) => {
  const totalOwn = Math.max(1, totalTroops(own))
  const totalEnemy = Math.max(1, totalTroops(enemy))
  const advantage =
    own.infantry * enemy.cavalry +
    own.cavalry * enemy.archer +
    own.archer * enemy.infantry
  const disadvantage =
    own.infantry * enemy.archer +
    own.cavalry * enemy.infantry +
    own.archer * enemy.cavalry
  const ratio = (advantage - disadvantage) / (totalOwn * totalEnemy)
  const multiplier = 1 + ratio * 0.4
  return Math.min(1.2, Math.max(0.8, multiplier))
}

export const simulateCombat = (state: GameState, encounter: typeof ENEMIES[number], mode: 'raid' | 'waves'): CombatResult => {
  const squadTroops = getTroopCountsFromSquad(state)
  const heroIds = [state.squad.leaderId, ...state.squad.supportIds].filter(Boolean) as string[]
  const heroes = state.heroes.filter((h) => heroIds.includes(h.id))

  if (totalTroops(squadTroops) <= 0) {
    return {
      victory: false,
      rounds: 0,
      log: [],
      rewards: {
        resources: { food: 0, wood: 0, stone: 0, gold: 0 },
        xpItems: 0,
        gearDrops: [],
        keys: { gold: 0, platinum: 0 }
      },
      casualties: { infantry: 0, archer: 0, cavalry: 0 }
    }
  }

  let playerTroops = { ...squadTroops }
  const startingTroops = { ...squadTroops }
  let victory = true
  let rounds = 0
  const log: CombatLogEntry[] = []

  const waves = mode === 'waves' ? 3 : 1

  for (let wave = 1; wave <= waves; wave += 1) {
    const scale = getEnemyScale(mode, wave)
    let enemyTroops: TroopCounts = {
      infantry: Math.floor(encounter.troops.infantry * scale),
      archer: Math.floor(encounter.troops.archer * scale),
      cavalry: Math.floor(encounter.troops.cavalry * scale)
    }
    let playerHP = computeTroopHP(playerTroops)
    let enemyHP = computeTroopHP(enemyTroops)

    const heroSkills = heroes.map((hero) => ({
      heroId: hero.id,
      skillStates: heroSkillsState(hero.id)
    }))

    for (let round = 1; round <= maxRounds; round += 1) {
      rounds += 1
      const notes: string[] = []
      const playerMultiplier = advantageMultiplier(playerTroops, enemyTroops)
      const enemyMultiplier = advantageMultiplier(enemyTroops, playerTroops)

      const heroAttack = heroes.reduce((sum, hero) => sum + getHeroStats(hero).attack * 0.8, 0)
      const heroDefense = heroes.reduce((sum, hero) => sum + getHeroStats(hero).defense * 0.6, 0)

      let playerDamage = (computeTroopPower(playerTroops) + heroAttack) * playerMultiplier
      let enemyDamage = (computeTroopPower(enemyTroops) + encounter.power * 10) * enemyMultiplier

      heroSkills.forEach((heroState) => {
        heroState.skillStates.forEach((skill) => {
          if (skill.cooldownLeft > 0) {
            skill.cooldownLeft -= 1
            return
          }
          if (skill.effect === 'damage') {
            playerDamage += skill.amount
            notes.push(`${skill.name} hits`) 
          }
          if (skill.effect === 'buff') {
            playerDamage *= 1 + skill.amount
            notes.push(`${skill.name} boosts`) 
          }
          if (skill.effect === 'shield') {
            enemyDamage = Math.max(0, enemyDamage - skill.amount - heroDefense)
            notes.push(`${skill.name} blocks`) 
          }
          if (skill.effect === 'heal') {
            playerHP += skill.amount * 2
            notes.push(`${skill.name} heals`) 
          }
          skill.cooldownLeft = skill.cooldown
        })
      })

      playerHP = applyDamageToHP(playerHP, enemyDamage)
      enemyHP = applyDamageToHP(enemyHP, playerDamage)

      playerTroops = scaleTroopsByHP(playerTroops, playerHP)
      enemyTroops = scaleTroopsByHP(enemyTroops, enemyHP)
      playerHP = Math.min(playerHP, computeTroopHP(playerTroops))
      enemyHP = Math.min(enemyHP, computeTroopHP(enemyTroops))

      log.push({
        round: rounds,
        playerDamage: Math.round(playerDamage),
        enemyDamage: Math.round(enemyDamage),
        notes
      })

      if (enemyHP <= 0 || totalTroops(enemyTroops) <= 0) {
        break
      }
      if (playerHP <= 0 || totalTroops(playerTroops) <= 0) {
        victory = false
        break
      }
    }

    if (!victory || totalTroops(playerTroops) <= 0) {
      victory = false
      break
    }
  }

  const casualties: TroopCounts = {
    infantry: Math.max(0, startingTroops.infantry - playerTroops.infantry),
    archer: Math.max(0, startingTroops.archer - playerTroops.archer),
    cavalry: Math.max(0, startingTroops.cavalry - playerTroops.cavalry)
  }

  const rewards = buildRewards(mode, victory)

  return {
    victory,
    rounds,
    log,
    rewards,
    casualties
  }
}

const scaleTroopsByHP = (troops: TroopCounts, hp: number): TroopCounts => {
  const totalHP = computeTroopHP(troops)
  if (totalHP <= 0) return { infantry: 0, archer: 0, cavalry: 0 }
  const ratio = Math.max(0, Math.min(1, hp / totalHP))
  return {
    infantry: Math.floor(troops.infantry * ratio),
    archer: Math.floor(troops.archer * ratio),
    cavalry: Math.floor(troops.cavalry * ratio)
  }
}

const heroSkillsState = (heroId: string) => {
  const heroDef = HERO_DEFS.find((hero) => hero.id === heroId)
  if (!heroDef) return []
  return heroDef.skills.map((skill) => ({
    name: skill.name,
    effect: skill.effect,
    amount: skill.amount,
    cooldown: skill.cooldown,
    cooldownLeft: 0
  }))
}

const buildRewards = (mode: 'raid' | 'waves', victory: boolean) => {
  if (!victory) {
    return {
      resources: { food: 0, wood: 0, stone: 0, gold: 0 },
      xpItems: 0,
      gearDrops: [],
      keys: { gold: 0, platinum: 0 }
    }
  }
  const table = REWARD_TABLE[mode]
  const gearDrops: string[] = []
  if (Math.random() < table.gearChance) {
    gearDrops.push(getRandomGear())
  }
  const keys = {
    gold: Math.random() < table.keyChance ? 1 : 0,
    platinum: Math.random() < table.keyChance * 0.3 ? 1 : 0
  }
  return {
    resources: { ...table.base },
    xpItems: table.xpItems,
    gearDrops,
    keys
  }
}
