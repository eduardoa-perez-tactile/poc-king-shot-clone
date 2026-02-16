import React from 'react'
import type { MissionNodeDef } from '../worldMapData'
import type { MissionNodeState } from '../worldProgression'

const STATE_LABEL: Record<MissionNodeState, string> = {
  locked: 'Locked',
  available: 'Available',
  completed: 'Completed'
}

const renderDifficulty = (difficulty: MissionNodeDef['difficulty']) => {
  return `★`.repeat(difficulty)
}

export const MissionSelectPanel: React.FC<{
  mission: MissionNodeDef | null
  missionState: MissionNodeState | null
  bestScore?: number
  lockedReason?: string
  lockedMessage?: string | null
  onStart: () => void
  onReplayTutorial?: () => void
  onBack: () => void
}> = ({
  mission,
  missionState,
  bestScore,
  lockedReason,
  lockedMessage,
  onStart,
  onReplayTutorial,
  onBack
}) => {
  const canStart = Boolean(mission && missionState && missionState !== 'locked')

  return (
    <aside className="world-map-panel">
      <div className="world-map-panel-header">
        <h3>Mission Details</h3>
        <button className="btn" onClick={onBack}>Back to Main Menu</button>
      </div>

      {!mission || !missionState ? (
        <div className="muted">Select a mission node to see details.</div>
      ) : (
        <>
          <div className="world-map-mission-name">{mission.name}</div>
          <div className="meta-row">
            <div>
              <div className="muted">Difficulty</div>
              <div>{renderDifficulty(mission.difficulty)} ({mission.difficulty}/5)</div>
            </div>
            <div>
              <div className="muted">Waves</div>
              <div>{mission.waves}</div>
            </div>
            <div>
              <div className="muted">State</div>
              <div>{STATE_LABEL[missionState]}</div>
            </div>
            <div>
              <div className="muted">Best Score</div>
              <div>{missionState === 'completed' ? (bestScore ?? 0) : '—'}</div>
            </div>
          </div>

          {missionState === 'locked' && (
            <div className="world-map-lock-note">
              {lockedReason ?? 'Locked'}
            </div>
          )}

          {lockedMessage && <div className="world-map-lock-toast">{lockedMessage}</div>}

          <div className="world-map-actions">
            <button className="btn success" disabled={!canStart} onClick={onStart}>Start Mission</button>
            {onReplayTutorial && (
              <button className="btn" onClick={onReplayTutorial}>Replay Tutorial</button>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
