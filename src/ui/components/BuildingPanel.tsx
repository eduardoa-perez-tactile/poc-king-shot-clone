import React from 'react'
import { BUILDING_DEFS } from '../../config/buildings'
import { UNIT_DEFS } from '../../config/units'
import { getBuildingUpgradeCost } from '../../run/economy'
import { RunBuilding } from '../../run/types'

const formatNumber = (value: number) => value.toLocaleString()

const describeLevelEffects = (building: RunBuilding, level: number) => {
  const def = BUILDING_DEFS[building.id]
  const parts: string[] = []
  if (def.income) {
    const amount = def.income.base + def.income.perLevel * (level - 1)
    parts.push(`Income +${amount}/day`)
  }
  if (def.bonuses?.squadCapPerLevel) {
    parts.push(`Squad cap +${def.bonuses.squadCapPerLevel * level}`)
  }
  if (def.bonuses?.hqHpPerLevel) {
    parts.push(`HQ +${def.bonuses.hqHpPerLevel * level} HP`)
  }
  if (def.bonuses?.unitAttackPctPerLevel || def.bonuses?.unitHpPctPerLevel) {
    parts.push('Squad stats improved')
  }
  return parts.join(' · ')
}

export const BuildingPanel: React.FC<{
  building: RunBuilding
  gold: number
  squadCount: number
  squadCap: number
  onUpgrade: () => void
  onRecruit: () => void
  onClose: () => void
}> = ({ building, gold, squadCount, squadCap, onUpgrade, onRecruit, onClose }) => {
  const def = BUILDING_DEFS[building.id]
  const isMax = building.level >= def.maxLevel
  const nextLevel = building.level + 1
  const upgradeCost = isMax ? 0 : getBuildingUpgradeCost(building.id, nextLevel)
  const canUpgrade = !isMax && gold >= upgradeCost
  const unitType = def.unlocksUnit
  const unitCost = unitType ? UNIT_DEFS[unitType].baseCost : 0
  const canRecruit = Boolean(unitType) && gold >= unitCost && squadCount < squadCap

  return (
    <div className="overlay">
      <div className="overlay-card build-panel">
        <div className="panel-header">
          <div>
            <h3>{def.name} · Lv {building.level}</h3>
            <div className="muted">{def.description}</div>
          </div>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div className="panel-section">
          <div className="list-title">Current Effects</div>
          <div className="muted">{describeLevelEffects(building, building.level) || 'No bonuses.'}</div>
        </div>

        <div className="panel-section">
          <div className="list-title">Upgrade</div>
          {isMax ? (
            <div className="muted">Max level reached.</div>
          ) : (
            <>
              <div className="muted">Next Level Effects: {describeLevelEffects(building, nextLevel) || 'No bonuses.'}</div>
              <div className="muted">Upgrade Cost: {formatNumber(upgradeCost)}</div>
              <button className="btn" disabled={!canUpgrade} onClick={onUpgrade}>Upgrade</button>
            </>
          )}
        </div>

        {unitType && (
          <div className="panel-section">
            <div className="list-title">Recruit Squad</div>
            <div className="muted">{UNIT_DEFS[unitType].name} squad · Cost {formatNumber(unitCost)}</div>
            <div className="muted">Squad Cap {squadCount}/{squadCap}</div>
            <button className="btn" disabled={!canRecruit} onClick={onRecruit}>Recruit</button>
          </div>
        )}
      </div>
    </div>
  )
}
