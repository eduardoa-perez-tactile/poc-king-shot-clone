import React from 'react'
import { GameState } from '../../game/types'

export const SettingsScreen: React.FC<{
  state: GameState
  onToggleSound: () => void
  onReset: () => void
}> = ({ state, onToggleSound, onReset }) => {
  return (
    <div className="screen">
      <div className="panel">
        <h3>Settings</h3>
        <div className="form-row">
          <label>Sound</label>
          <button className="btn" onClick={onToggleSound}>{state.settings.sound ? 'On' : 'Off'}</button>
        </div>
        <div className="muted">Sound is a placeholder toggle for now.</div>
      </div>
      <div className="panel danger">
        <h3>Reset Save</h3>
        <div className="muted">This will clear all progress.</div>
        <button className="btn" onClick={onReset}>Reset Game</button>
      </div>
    </div>
  )
}
