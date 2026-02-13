import React from 'react'
import { useRunStore } from '../../run/store'
import { getLevelById } from '../../config/levels'

export const LoseScreen: React.FC<{
  onRetry: () => void
  onLevelSelect: () => void
}> = ({ onRetry, onLevelSelect }) => {
  const { activeRun } = useRunStore()
  const level = activeRun ? getLevelById(activeRun.levelId) : null
  return (
    <div className="menu">
      <div className="menu-card danger">
        <div className="menu-title">Defeat</div>
        <p className="muted">Your HQ fell on {level ? level.name : 'this level'}.</p>
        {activeRun && (
          <div className="meta-row">
            <div>Day Reached: {activeRun.dayNumber}</div>
            <div>Squads Remaining: {activeRun.unitRoster.length}</div>
          </div>
        )}
        <div className="menu-buttons">
          <button className="btn success" onClick={onRetry}>Retry Day 1</button>
          <button className="btn" onClick={onLevelSelect}>World Map</button>
        </div>
      </div>
    </div>
  )
}
