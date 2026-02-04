import React from 'react'
import { MissionDefinition, MissionResult } from '../../rts/types'

export const EndScreen: React.FC<{
  mission: MissionDefinition
  result: MissionResult
  onMainMenu: () => void
  onReplay: () => void
  onNext: () => void
  canNext: boolean
}> = ({ mission, result, onMainMenu, onReplay, onNext, canNext }) => {
  return (
    <div className="menu">
      <div className="menu-card">
        <h2>{result.victory ? 'Victory' : 'Defeat'}</h2>
        <div className="muted">{mission.name}</div>
        <div className="stat-grid">
          <div>Time: {Math.floor(result.stats.time)}s</div>
          <div>Kills: {result.stats.kills}</div>
          <div>Losses: {result.stats.losses}</div>
        </div>
        {result.victory && (
          <div className="panel">
            <h4>Rewards</h4>
            <div>F{result.rewards.resources.food} W{result.rewards.resources.wood} S{result.rewards.resources.stone} G{result.rewards.resources.gold}</div>
            <div>XP Items: {result.rewards.xpItems}</div>
            <div>Keys: {result.rewards.keys.gold}G / {result.rewards.keys.platinum}P</div>
          </div>
        )}
        <div className="menu-buttons">
          <button className="btn" onClick={onMainMenu}>Return to Main Menu</button>
          <button className="btn success" onClick={onReplay}>Replay</button>
          <button className="btn" onClick={onNext} disabled={!canNext}>Next Mission</button>
        </div>
      </div>
    </div>
  )
}
