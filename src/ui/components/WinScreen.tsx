import React from 'react'
import { useRunStore } from '../../run/store'
import { LEVELS } from '../../config/levels'

export const WinScreen: React.FC<{ onLevelSelect: () => void }> = ({ onLevelSelect }) => {
  const { activeRun } = useRunStore()
  const level = activeRun ? LEVELS.find((entry) => entry.id === activeRun.levelId) : null
  return (
    <div className="menu">
      <div className="menu-card">
        <div className="menu-title">Victory</div>
        <p className="muted">You completed {level ? level.name : 'the level'}.</p>
        {activeRun && (
          <div className="meta-row">
            <div>Days Survived: {activeRun.daysSurvived}</div>
            <div>Total Gold Earned: {activeRun.totalGoldEarned}</div>
          </div>
        )}
        <button className="btn success" onClick={onLevelSelect}>Return to Level Select</button>
      </div>
    </div>
  )
}
