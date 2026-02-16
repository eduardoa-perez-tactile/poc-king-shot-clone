import React from 'react'

export const MainMenu: React.FC<{
  canContinue: boolean
  canOpenDashboard?: boolean
  onPlay: () => void
  onReplayTutorial?: () => void
  onContinue: () => void
  onReset: () => void
  onDashboard?: () => void
}> = ({ canContinue, canOpenDashboard = false, onPlay, onReplayTutorial, onContinue, onReset, onDashboard }) => {
  return (
    <div className="menu">
      <div className="menu-card">
        <div className="menu-title">Governor: Day Cycle</div>
        <p className="muted">Build, rally, and survive day-by-day in a single connected loop.</p>
        <div className="menu-buttons">
          <button className="btn success" onClick={onPlay}>Missions</button>
          {onReplayTutorial && (
            <button className="btn" onClick={onReplayTutorial}>Replay Tutorial</button>
          )}
          <button className="btn" onClick={onContinue} disabled={!canContinue}>Continue Run</button>
          {canOpenDashboard && onDashboard && (
            <button className="btn" onClick={onDashboard}>Dashboard</button>
          )}
          <button className="btn ghost" onClick={onReset}>Reset Save</button>
        </div>
      </div>
    </div>
  )
}
