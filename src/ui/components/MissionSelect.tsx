import React from 'react'
import { MISSIONS } from '../../rts/missions'
import { MissionDefinition } from '../../rts/types'
import { GameState } from '../../game/types'
import { HERO_DEFS } from '../../config/balance'

export const MissionSelect: React.FC<{
  state: GameState
  selectedHeroId?: string
  onSelectHero: (heroId: string) => void
  onLaunch: (mission: MissionDefinition) => void
  onBack: () => void
  onSettlement: () => void
}> = ({ state, selectedHeroId, onSelectHero, onLaunch, onBack, onSettlement }) => {
  const unlocked = state.missions.unlocked
  return (
    <div className="screen">
      <div className="panel">
        <h3>Mission Select</h3>
        <div className="muted">Choose your leader hero for this mission.</div>
        <select value={selectedHeroId ?? ''} onChange={(event) => onSelectHero(event.target.value)}>
          <option value="">No Hero</option>
          {state.heroes.map((hero) => {
            const def = HERO_DEFS.find((h) => h.id === hero.id)
            return (
              <option key={hero.id} value={hero.id}>{def?.name ?? hero.id} (Lv {hero.level})</option>
            )
          })}
        </select>
      </div>

      <div className="card-grid">
        {MISSIONS.map((mission, index) => {
          const locked = index + 1 > unlocked
          return (
            <div key={mission.id} className={`card ${locked ? 'locked' : ''}`}>
              <h4>{mission.name}</h4>
              <div className="muted">{mission.description}</div>
              <div className="muted">Difficulty: {mission.difficulty}</div>
              <div className="muted">Rewards: F{mission.rewards.resources.food} W{mission.rewards.resources.wood} S{mission.rewards.resources.stone} G{mission.rewards.resources.gold} | XP {mission.rewards.xpItems} | Keys {mission.rewards.keys.gold}G/{mission.rewards.keys.platinum}P</div>
              <button className={`btn ${!locked ? 'success' : ''}`} disabled={locked} onClick={() => onLaunch(mission)}>
                {locked ? 'Locked' : 'Launch'}
              </button>
            </div>
          )}
        })}
      </div>

      <div className="button-row">
        <button className="btn" onClick={onBack}>Main Menu</button>
        <button className="btn" onClick={onSettlement}>Settlement</button>
      </div>
    </div>
  )
}
