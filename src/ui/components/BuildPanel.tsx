import React from 'react'
import { BuildingId, BUILDING_DEFS } from '../../config/buildings'
import { BuildingPad } from '../../config/levels'
import { UNIT_DEFS } from '../../config/units'
import { getPadAllowedBuildingType } from '../../game/rules/progression'

const describeEffects = (id: BuildingId) => {
  const def = BUILDING_DEFS[id]
  const parts: string[] = []
  if (def.income) {
    parts.push(`Income +${def.income.base}/day`)
  }
  if (def.unlocksUnit) {
    parts.push(`Unlocks ${UNIT_DEFS[def.unlocksUnit].name}`)
  }
  if (def.bonuses?.squadCapPerLevel) {
    parts.push(`Squad cap +${def.bonuses.squadCapPerLevel} per level`)
  }
  if (def.bonuses?.hqHpPerLevel) {
    parts.push(`HQ +${def.bonuses.hqHpPerLevel} HP per level`)
  }
  if (def.bonuses?.unitAttackPctPerLevel || def.bonuses?.unitHpPctPerLevel) {
    parts.push('Squad stats scale with upgrades')
  }
  return parts.join(' · ')
}

export const BuildPanel: React.FC<{
  pad: BuildingPad
  gold: number
  onBuild: (buildingId: BuildingId) => void
  onClose: () => void
}> = ({ pad, gold, onBuild, onClose }) => {
  const fixedType = getPadAllowedBuildingType(pad)
  const options = fixedType ? [fixedType] : []
  return (
    <div className="overlay">
      <div className="overlay-card build-panel">
        <div className="panel-header">
          <div>
            <h3>Build on {pad.id.toUpperCase()}</h3>
            <div className="muted">Choose a structure for this pad.</div>
          </div>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="list">
          {options.map((id) => {
            const def = BUILDING_DEFS[id]
            const canAfford = gold >= def.baseCost
            const shortfall = Math.max(0, def.baseCost - gold)
            return (
              <div key={id} className={`list-row option-card ${canAfford ? 'ready' : 'locked'}`}>
                <div>
                  <div className="list-title">{def.name}</div>
                  <div className="muted">{def.description}</div>
                  <div className="muted">{describeEffects(id)}</div>
                </div>
                <div className="list-actions">
                  <div className="muted">Cost {def.baseCost}</div>
                  {shortfall > 0 && <div className="muted">Need {shortfall} more</div>}
                  <button className={`btn ${canAfford ? 'success' : ''}`} disabled={!canAfford} onClick={() => onBuild(id)}>
                    Build
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
