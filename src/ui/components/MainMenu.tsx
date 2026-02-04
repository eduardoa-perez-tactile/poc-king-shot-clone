import React from 'react'

export const MainMenu: React.FC<{
  canContinue: boolean
  onPlay: () => void
  onContinue: () => void
  onReset: () => void
}> = ({ canContinue, onPlay, onContinue, onReset }) => {
  return (
    <div className="menu">
      <div className="menu-card">
        <div className="menu-title">Governor: Day Cycle</div>
        <p className="muted">Build, rally, and survive day-by-day in a single connected loop.</p>
        <div className="menu-buttons">
          <button className="btn success" onClick={onPlay}>Play</button>
          <button className="btn" onClick={onContinue} disabled={!canContinue}>Continue Run</button>
          <button className="btn ghost" onClick={onReset}>Reset Save</button>
        </div>
      </div>
    </div>
  )
}
