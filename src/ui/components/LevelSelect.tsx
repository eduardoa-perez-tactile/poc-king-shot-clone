import React from 'react'
import { getLevels } from '../../config/levels'
import { useRunStore } from '../../run/store'

export const LevelSelect: React.FC<{
  onBack: () => void
  onStart: (levelId: string) => void
}> = ({ onBack, onStart }) => {
  const { meta } = useRunStore()
  const levels = getLevels()
  return (
    <div className="screen">
      <div className="top-bar">
        <div>
          <h2>Choose Your Level</h2>
          <div className="muted">Each level is a full day-cycle run.</div>
        </div>
        <button className="btn" onClick={onBack}>Back</button>
      </div>
      <div className="card-grid">
        {levels.map((level) => {
          const unlocked = meta.unlockedLevels.includes(level.id)
          const best = meta.bestCompletion[level.id]
          return (
            <div key={level.id} className={`card ${unlocked ? '' : 'locked'}`}>
              <h3>{level.name}</h3>
              <div className="muted">{level.description}</div>
              <div className="meta-row">
                <div>Start Gold: {level.startGold}</div>
                <div>Goal Count: {level.goals.length}</div>
                {best ? <div>Best: Day {best}</div> : <div>Best: —</div>}
              </div>
              <button className="btn success" disabled={!unlocked} onClick={() => onStart(level.id)}>
                {unlocked ? 'Start Level' : 'Locked'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
