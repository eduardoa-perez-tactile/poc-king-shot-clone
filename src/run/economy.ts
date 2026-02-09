import { BUILDING_DEFS, BuildingId } from '../config/buildings'
import { UnitType, UNIT_DEFS } from '../config/units'
import { IncomeBreakdown, RunState } from './types'

export const getBuildingLevel = (run: RunState, id: BuildingId) =>
  run.buildings.reduce((sum, building) => (building.id === id ? sum + building.level : sum), 0)

export const hasBuilding = (run: RunState, id: BuildingId) => getBuildingLevel(run, id) > 0

export const getBuildingPurchaseCost = (id: BuildingId) => BUILDING_DEFS[id].baseCost

export const getBuildingMaxHp = (id: BuildingId, level: number) => {
  const base = 800
  const perLevel = 200
  const scaled = base + perLevel * Math.max(1, level)
  return Math.max(300, Math.floor(scaled))
}

export const getBuildingUpgradeCost = (id: BuildingId, nextLevel: number) => {
  const def = BUILDING_DEFS[id]
  const scaled = def.upgradeBase * Math.pow(def.upgradeScale, Math.max(0, nextLevel - 1))
  return Math.floor(scaled)
}

export const getSquadCap = (run: RunState) => {
  const baseCap = 3
  const houseLevel = getBuildingLevel(run, 'house')
  const bonus = BUILDING_DEFS.house.bonuses?.squadCapPerLevel ?? 0
  return baseCap + houseLevel * bonus
}

export const getUnitPurchaseCap = (run: RunState) => Math.max(0, 4 * Math.max(1, run.strongholdLevel))

export const getBuildingPurchaseCount = (run: RunState, padId?: string | null) => {
  if (!padId) return 0
  const building = run.buildings.find((entry) => entry.padId === padId)
  return building?.purchasedUnitsCount ?? 0
}

export const getAvailableUnitTypes = (run: RunState): UnitType[] => {
  const types: UnitType[] = []
  if (hasBuilding(run, 'barracks')) types.push('infantry')
  if (hasBuilding(run, 'range')) types.push('archer')
  if (hasBuilding(run, 'stable')) types.push('cavalry')
  return types
}

export const getUnitCost = (type: UnitType) => UNIT_DEFS[type].baseCost

export const getIncomeBreakdown = (run: RunState, reward = 0): IncomeBreakdown => {
  const items = run.buildings
    .map((building) => {
      const def = BUILDING_DEFS[building.id]
      if (!def.income) return null
      const amount = def.income.base + def.income.perLevel * (building.level - 1)
      return { id: building.id, name: def.name, level: building.level, amount }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const buildingTotal = items.reduce((sum, item) => sum + item.amount, 0)
  const bonuses = 0
  const total = buildingTotal + reward + bonuses
  return { total, items, bonuses, reward, buildingTotal }
}

export const getUnitStatMultipliers = (run: RunState) => {
  const blacksmithLevel = getBuildingLevel(run, 'blacksmith')
  const blacksmith = BUILDING_DEFS.blacksmith.bonuses
  const baseAttack = blacksmith?.unitAttackPctPerLevel ? blacksmithLevel * blacksmith.unitAttackPctPerLevel : 0
  const baseHp = blacksmith?.unitHpPctPerLevel ? blacksmithLevel * blacksmith.unitHpPctPerLevel : 0

  const perType: Record<UnitType, { attack: number; hp: number }> = {
    infantry: { attack: baseAttack, hp: baseHp },
    archer: { attack: baseAttack, hp: baseHp },
    cavalry: { attack: baseAttack, hp: baseHp }
  }

  const buildingBonuses: Array<{ id: BuildingId; type?: UnitType }> = [
    { id: 'barracks', type: 'infantry' },
    { id: 'range', type: 'archer' },
    { id: 'stable', type: 'cavalry' }
  ]

  buildingBonuses.forEach(({ id, type }) => {
    if (!type) return
    const level = getBuildingLevel(run, id)
    const bonuses = BUILDING_DEFS[id].bonuses
    const atk = bonuses?.unitTypeAttackPctPerLevel?.[type] ?? 0
    const hp = bonuses?.unitTypeHpPctPerLevel?.[type] ?? 0
    perType[type].attack += level * atk
    perType[type].hp += level * hp
  })

  return perType
}

export const getHQBonusHp = (run: RunState) => {
  const level = getBuildingLevel(run, 'watchtower')
  const bonus = BUILDING_DEFS.watchtower.bonuses?.hqHpPerLevel ?? 0
  return level * bonus
}

export const canAfford = (gold: number, cost: number) => gold >= cost

export const clampGold = (value: number) => Math.max(0, Math.floor(value))
