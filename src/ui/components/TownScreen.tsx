import React, { useMemo, useState } from 'react'
import { BUILDING_DEFS } from '../../config/balance'
import { GameState, BuildingId, TownTile } from '../../game/types'
import { canAfford, getBuildingLevel, getProductionRates, getUpgradeCost, getUpgradeTime } from '../../game/logic'
import { TownCanvas } from './TownCanvas'

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export const TownScreen: React.FC<{
  state: GameState
  onUpgrade: (id: BuildingId) => void
  onBuildAt: (id: BuildingId, tile: TownTile) => void
}> = ({ state, onUpgrade, onBuildAt }) => {
  const rates = getProductionRates(state)
  const active = state.upgradeQueue
  const [selectedTile, setSelectedTile] = useState<TownTile | null>(null)

  const buildOptions = useMemo(() => {
    return (Object.keys(BUILDING_DEFS) as BuildingId[])
      .filter((id) => getBuildingLevel(state, id) === 0)
  }, [state])

  const selectedBuilding = selectedTile?.buildingId
  const selectedLevel = selectedBuilding ? getBuildingLevel(state, selectedBuilding) : 0
  const nextLevel = selectedBuilding ? selectedLevel + 1 : 1
  const selectedCost = selectedBuilding ? getUpgradeCost(selectedBuilding, nextLevel) : null
  const selectedTime = selectedBuilding ? getUpgradeTime(selectedBuilding, nextLevel) : null
  return (
    <div className="screen">
      <div className="town-top">
        <TownCanvas tiles={state.townTiles} selected={selectedTile} onSelect={setSelectedTile} />
        <div className="panel">
          <h3>Production Rates</h3>
          <div className="stat-grid">
            <div>Food: {rates.food.toFixed(1)}/min</div>
            <div>Wood: {rates.wood.toFixed(1)}/min</div>
            <div>Stone: {rates.stone.toFixed(1)}/min</div>
            <div>Gold: {rates.gold.toFixed(1)}/min</div>
          </div>
          <div className="upgrade-queue">
            <h4>Upgrade Queue</h4>
            {active ? (
              <div>
                <div>{BUILDING_DEFS[active.buildingId].name} upgrading</div>
                <div className="muted">Ends in {Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000))}s</div>
              </div>
            ) : (
              <div className="muted">No active upgrades.</div>
            )}
          </div>
          <div className="upgrade-queue">
            <h4>Selected Tile</h4>
            {selectedTile ? (
              selectedTile.buildingId ? (
                <div>
                  <div>{BUILDING_DEFS[selectedTile.buildingId].name} Lv {selectedLevel}</div>
                  {selectedCost && selectedTime !== null && (
                    <>
                      <div className="muted">Upgrade Cost: F{selectedCost.food} W{selectedCost.wood} S{selectedCost.stone} G{selectedCost.gold}</div>
                      <div className="muted">Time: {formatTime(selectedTime)}</div>
                      <button
                        className={`btn ${!state.upgradeQueue && selectedCost && canAfford(state.resources, selectedCost) ? 'success' : ''}`}
                        onClick={() => onUpgrade(selectedTile.buildingId)}
                        disabled={Boolean(state.upgradeQueue) || Boolean(selectedCost && !canAfford(state.resources, selectedCost))}
                      >
                        Upgrade
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="muted">Empty tile. Build something:</div>
                  <div className="button-row">
                    {buildOptions.length === 0 && <div className="muted">All buildings placed.</div>}
                    {buildOptions.map((id) => {
                      const buildCost = getUpgradeCost(id, 1)
                      const canBuild = !state.upgradeQueue && canAfford(state.resources, buildCost)
                      return (
                        <button
                          key={id}
                          className={`btn ${canBuild ? 'success' : ''}`}
                          onClick={() => onBuildAt(id, selectedTile)}
                          disabled={!canBuild}
                        >
                          Build {BUILDING_DEFS[id].name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            ) : (
              <div className="muted">Click a tile to build or upgrade.</div>
            )}
          </div>
        </div>
      </div>
      <div className="card-grid">
        {Object.keys(BUILDING_DEFS).map((id) => {
          const buildingId = id as BuildingId
          const def = BUILDING_DEFS[buildingId]
          const level = getBuildingLevel(state, buildingId)
          const nextLevel = level + 1
          const isMax = nextLevel > def.maxLevel
          const cost = isMax ? { food: 0, wood: 0, stone: 0, gold: 0 } : getUpgradeCost(buildingId, nextLevel)
          const timeSec = isMax ? 0 : getUpgradeTime(buildingId, nextLevel)
          const canUpgrade = !isMax && !state.upgradeQueue && canAfford(state.resources, cost)
          return (
            <div className="card" key={buildingId}>
              <h4>{def.name}</h4>
              <div className="muted">Level {level}</div>
              <div className="muted">{def.effect}</div>
              {def.productionPerMin && (
                <div>Produces {Object.entries(def.productionPerMin).map(([key, value]) => `${value}/min ${key}`).join(', ')} per level</div>
              )}
              {isMax ? (
                <div className="muted">Max level reached.</div>
              ) : (
                <>
                  <div className="cost-line">{level === 0 ? 'Build' : 'Upgrade'} Cost: F{cost.food} W{cost.wood} S{cost.stone} G{cost.gold}</div>
                  <div className="muted">Time: {formatTime(timeSec)}</div>
                </>
              )}
              <button
                className={`btn ${canUpgrade ? 'success' : ''}`}
                onClick={() => onUpgrade(buildingId)}
                disabled={!canUpgrade}
              >
                {level === 0 ? 'Build' : 'Upgrade'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
