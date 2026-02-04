import React from 'react'

export const MainMenu: React.FC<{
  canContinue: boolean
  onPlay: () => void
  onContinue: () => void
  onSettings: () => void
  onReset: () => void
  onSettlement: () => void
}> = ({ canContinue, onPlay, onContinue, onSettings, onReset, onSettlement }) => {
  return (
    <div className="menu">
      <div className="menu-card">
        <h1>Governor: RTS Chronicle</h1>
        <p className="muted">Command your army in real-time missions while rebuilding your settlement.</p>
        <div className="menu-buttons">
          <button className="btn success" onClick={onPlay}>Play</button>
          <button className="btn" onClick={onContinue} disabled={!canContinue}>Continue</button>
          <button className="btn" onClick={onSettlement}>Settlement</button>
          <button className="btn" onClick={onSettings}>Settings</button>
          <button className="btn" onClick={onReset}>Reset Save</button>
        </div>
      </div>
    </div>
  )
}
