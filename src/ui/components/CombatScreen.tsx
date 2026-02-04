import React from 'react'
import { ENEMIES } from '../../config/balance'
import { CombatResult, GameState, TroopCounts } from '../../game/types'
import { estimatePower, estimateTroopPower, getTroopCountsFromSquad } from '../../game/logic'
import { CombatCanvas } from './CombatCanvas'

export const CombatScreen: React.FC<{
  state: GameState
  result: CombatResult | null
  onCombat: (mode: 'raid' | 'waves') => void
  onAutoSquad: (composition: TroopCounts) => void
}> = ({ state, result, onCombat, onAutoSquad }) => {
  const squadTroops = getTroopCountsFromSquad(state)
  const heroIds = [state.squad.leaderId, ...state.squad.supportIds].filter(Boolean) as string[]
  const heroes = state.heroes.filter((hero) => heroIds.includes(hero.id))
  const heroNames = heroes.map((hero) => hero.id)
  const power = estimatePower(squadTroops, heroes)

  const previewEnemy = ENEMIES[0]
  const enemyPower = estimateTroopPower(previewEnemy.troops)

  const totalAvailable = state.troops.infantry + state.troops.archer + state.troops.cavalry
  const canFight = totalAvailable > 0 && (squadTroops.infantry + squadTroops.archer + squadTroops.cavalry) > 0
  const recommended: TroopCounts = {
    infantry: Math.floor(totalAvailable * 0.4),
    archer: Math.floor(totalAvailable * 0.3),
    cavalry: Math.floor(totalAvailable * 0.3)
  }

  return (
    <div className="screen">
      <div className="panel-row">
        <div className="panel">
          <h3>Battle Planning</h3>
          <div className="muted">Squad Power: {power} vs Enemy Power: {enemyPower}</div>
          <div>Troops: {squadTroops.infantry} / {squadTroops.archer} / {squadTroops.cavalry}</div>
          <div>Heroes: {heroNames.join(', ') || 'None'}</div>
          <div className="muted">Recommended: I{recommended.infantry} A{recommended.archer} C{recommended.cavalry}</div>
          <div className="button-row">
            <button className={`btn ${canFight ? 'success' : ''}`} onClick={() => onCombat('raid')} disabled={!canFight}>Start Raid</button>
            <button className="btn" onClick={() => onCombat('waves')} disabled={!canFight}>Start Waves</button>
            <button className="btn" onClick={() => onAutoSquad(recommended)}>Apply Recommended Squad</button>
          </div>
        </div>
        <div className="panel">
          <h3>Enemy Preview</h3>
          <div>{previewEnemy.name}</div>
          <div className="muted">Inf {previewEnemy.troops.infantry} | Arc {previewEnemy.troops.archer} | Cav {previewEnemy.troops.cavalry}</div>
          <div className="muted">Raid: single encounter | Waves: 3 escalating waves</div>
        </div>
      </div>

      <CombatCanvas
        playerTroops={squadTroops}
        enemyTroops={previewEnemy.troops}
        resultText={result ? (result.victory ? 'Victory!' : 'Defeat') : 'Ready'}
      />

      {result && (
        <div className="panel">
          <h3>Battle Report</h3>
          <div className="muted">Rounds: {result.rounds} | Casualties: I{result.casualties.infantry} A{result.casualties.archer} C{result.casualties.cavalry}</div>
          <div>Rewards: F{result.rewards.resources.food} W{result.rewards.resources.wood} S{result.rewards.resources.stone} G{result.rewards.resources.gold}</div>
          <div>XP Items: {result.rewards.xpItems} | Gear Drops: {result.rewards.gearDrops.join(', ') || 'None'} | Keys: +{result.rewards.keys.gold}G / +{result.rewards.keys.platinum}P</div>
          <div className="log">
            {result.log.slice(-8).map((entry) => (
              <div key={`${entry.round}-${entry.playerDamage}`}>
                Round {entry.round}: You dealt {entry.playerDamage}, took {entry.enemyDamage}. {entry.notes.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
