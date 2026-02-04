import React from 'react'
import { BUILDING_DEFS, BUILDING_LIST } from '../../config/buildings'
import { LEVELS } from '../../config/levels'
import { UNIT_DEFS, UnitType } from '../../config/units'
import { getIncomeBreakdown, getSquadCap, getAvailableUnitTypes, canAfford } from '../../run/economy'
import { useRunStore } from '../../run/store'
import { buildCombatDefinition } from '../../rts/combat'
import { RTSGame } from '../../rts/RTSGame'

const formatNumber = (value: number) => value.toLocaleString()

export const LevelRun: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const {
    activeRun,
    runPhase,
    buyBuilding,
    upgradeBuilding,
    buySquad,
    startCombat,
    resolveCombat,
    startNewDay
  } = useRunStore()

  if (!activeRun) return null
  const level = LEVELS.find((entry) => entry.id === activeRun.levelId)
  if (!level) return null

  const income = getIncomeBreakdown(activeRun)
  const squadCap = getSquadCap(activeRun)
  const availableTypes = getAvailableUnitTypes(activeRun)

  const handleBuySquad = (type: UnitType) => {
    buySquad(type)
  }

  const combatDefinition = buildCombatDefinition(activeRun)

  return (
    <div className="level-run">
      <div className="top-bar">
        <div>
          <h2>{level.name}</h2>
          <div className="muted">Day {activeRun.dayNumber} · Gold {formatNumber(activeRun.gold)}</div>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={onExit}>Exit</button>
        </div>
      </div>

      {runPhase === 'combat' && (
        <div className="combat-wrapper">
          <div className="goals-panel compact">
            <h4>Goals</h4>
            {level.goals.map((goal) => {
              const value = activeRun.goalsProgress[goal.id]
              const done = typeof value === 'boolean' ? value : value >= goal.target
              return (
                <div key={goal.id} className={`goal-row ${done ? 'done' : ''}`}>
                  <div>{goal.label}</div>
                  <div>{typeof value === 'boolean' ? (value ? 'Done' : '—') : `${value}/${goal.target}`}</div>
                </div>
              )
            })}
          </div>
          <RTSGame
            combat={combatDefinition}
            run={activeRun}
            onComplete={(result) =>
              resolveCombat({
                victory: result.victory,
                lostSquadIds: result.lostSquadIds,
                bossDefeated: result.bossDefeated,
                hqHpPercent: result.hqHpPercent
              })
            }
            onExit={onExit}
          />
        </div>
      )}

      {runPhase !== 'combat' && (
        <div className="build-phase">
          <div className="build-header">
            <div>
              <div className="muted">Build Phase</div>
              <div className="build-metrics">
                <div>Expected Income: {formatNumber(income.total)}</div>
                <div>Squad Cap: {activeRun.unitRoster.length}/{squadCap}</div>
                <div>Days Survived: {activeRun.daysSurvived}</div>
              </div>
            </div>
            <button
              className="btn success"
              onClick={startCombat}
              disabled={runPhase !== 'build' || activeRun.unitRoster.length === 0}
            >
              Battle Cry
            </button>
          </div>

          <div className="build-grid">
            <div className="panel">
              <h3>Buildings</h3>
              <div className="list">
                {BUILDING_LIST.map((building) => {
                  const owned = activeRun.buildings.find((b) => b.id === building.id)
                  const cost = owned ? Math.floor(building.upgradeBase * Math.pow(building.upgradeScale, owned.level)) : building.baseCost
                  const canUpgrade = owned && owned.level < building.maxLevel
                  const affordable = canAfford(activeRun.gold, cost)
                  return (
                    <div key={building.id} className="list-row">
                      <div>
                        <div className="list-title">{building.name}{owned ? ` Lv ${owned.level}` : ''}</div>
                        <div className="muted">{building.description}</div>
                      </div>
                      <div className="list-actions">
                        <div className="muted">Cost {formatNumber(cost)}</div>
                        {owned ? (
                          <button
                            className="btn"
                            disabled={!canUpgrade || !affordable}
                            onClick={() => upgradeBuilding(building.id)}
                          >
                            Upgrade
                          </button>
                        ) : (
                          <button className="btn" disabled={!affordable} onClick={() => buyBuilding(building.id)}>
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="panel">
              <h3>Squad Training</h3>
              <div className="list">
                {(Object.keys(UNIT_DEFS) as UnitType[]).map((type) => {
                  const unit = UNIT_DEFS[type]
                  const unlocked = availableTypes.includes(type)
                  const affordable = canAfford(activeRun.gold, unit.baseCost)
                  return (
                    <div key={type} className={`list-row ${unlocked ? '' : 'locked'}`}>
                      <div>
                        <div className="list-title">{unit.name}</div>
                        <div className="muted">Squad Size {unit.squadSize}</div>
                      </div>
                      <div className="list-actions">
                        <div className="muted">Cost {unit.baseCost}</div>
                        <button
                          className="btn"
                          disabled={!unlocked || !affordable || activeRun.unitRoster.length >= squadCap}
                          onClick={() => handleBuySquad(type)}
                        >
                          Buy Squad
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="panel">
              <h3>Roster</h3>
              {activeRun.unitRoster.length === 0 && <div className="muted">No squads recruited yet.</div>}
              <div className="list">
                {activeRun.unitRoster.map((squad) => (
                  <div key={squad.id} className="list-row">
                    <div>
                      <div className="list-title">{UNIT_DEFS[squad.type].name}</div>
                      <div className="muted">Squad Size {squad.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>Income Breakdown</h3>
              <div className="list">
                {income.items.map((item) => (
                  <div key={item.id} className="list-row">
                    <div>
                      <div className="list-title">{BUILDING_DEFS[item.id].name} Lv {item.level}</div>
                      <div className="muted">+{item.amount} gold</div>
                    </div>
                  </div>
                ))}
                <div className="list-row total">
                  <div className="list-title">Total</div>
                  <div className="list-title">+{income.total} gold</div>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3>Goals</h3>
              <div className="list">
                {level.goals.map((goal) => {
                  const value = activeRun.goalsProgress[goal.id]
                  const done = typeof value === 'boolean' ? value : value >= goal.target
                  return (
                    <div key={goal.id} className={`list-row ${done ? 'done' : ''}`}>
                      <div>
                        <div className="list-title">{goal.label}</div>
                        <div className="muted">
                          {typeof value === 'boolean' ? (value ? 'Complete' : 'In progress') : `${value}/${goal.target}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {runPhase === 'day_end' && (
        <div className="overlay">
          <div className="overlay-card">
            <h2>Survived Day {activeRun.dayNumber}</h2>
            <p className="muted">Collect income and prepare for the next day.</p>
            <div className="panel compact">
              <h4>Income Breakdown</h4>
              {income.items.map((item) => (
                <div key={item.id} className="list-row">
                  <div>{BUILDING_DEFS[item.id].name} Lv {item.level}</div>
                  <div>+{item.amount}</div>
                </div>
              ))}
              <div className="list-row total">
                <div>Total</div>
                <div>+{income.total}</div>
              </div>
            </div>
            <button className="btn success" onClick={startNewDay}>Start New Day</button>
          </div>
        </div>
      )}
    </div>
  )
}
