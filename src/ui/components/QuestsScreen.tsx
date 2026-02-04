import React from 'react'
import { EVENT_CONFIG } from '../../config/balance'
import { GameState } from '../../game/types'

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s}s`
}

export const QuestsScreen: React.FC<{
  state: GameState
  onClaimQuest: (questId: string, group: 'daily' | 'chapter') => void
  onClaimMilestone: (index: number) => void
  onRestartEvent: () => void
}> = ({ state, onClaimQuest, onClaimMilestone, onRestartEvent }) => {
  const now = Date.now()
  const eventEnded = now > state.event.endAt
  return (
    <div className="screen">
      <div className="panel-row">
        <div className="panel">
          <h3>Daily Quests</h3>
          {state.quests.daily.map((quest) => (
            <div key={quest.id} className="quest-row">
              <div>
                <div>{quest.title}</div>
                <div className="muted">{quest.description}</div>
                <div className="muted">{quest.progress}/{quest.target}</div>
              </div>
              <button
                className="btn"
                disabled={!quest.completed || quest.claimed}
                onClick={() => onClaimQuest(quest.id, 'daily')}
              >
                {quest.claimed ? 'Claimed' : 'Claim'}
              </button>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Chapter Quests</h3>
          {state.quests.chapters.map((quest, index) => (
            <div key={quest.id} className={`quest-row ${index === state.quests.chapterIndex ? 'active' : ''}`}>
              <div>
                <div>{quest.title}</div>
                <div className="muted">{quest.description}</div>
                <div className="muted">{quest.progress}/{quest.target}</div>
              </div>
              <button
                className="btn"
                disabled={!quest.completed || quest.claimed || index !== state.quests.chapterIndex}
                onClick={() => onClaimQuest(quest.id, 'chapter')}
              >
                {quest.claimed ? 'Claimed' : 'Claim'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>{EVENT_CONFIG.name}</h3>
        <div className="muted">Time left: {formatTime(state.event.endAt - now)}</div>
        <div>Points: {state.event.points} | Best: {state.event.best}</div>
        <div className="milestone-grid">
          {EVENT_CONFIG.milestones.map((milestone, index) => (
            <div className="card" key={milestone.points}>
              <div>Milestone {milestone.points} pts</div>
              <div className="muted">Rewards: F{milestone.reward.food} W{milestone.reward.wood} S{milestone.reward.stone} G{milestone.reward.gold}</div>
              <button
                className="btn"
                disabled={state.event.points < milestone.points || state.event.claimedMilestones.includes(index)}
                onClick={() => onClaimMilestone(index)}
              >
                {state.event.claimedMilestones.includes(index) ? 'Claimed' : 'Claim'}
              </button>
            </div>
          ))}
        </div>
        {eventEnded && (
          <button className="btn" onClick={onRestartEvent}>Restart Event</button>
        )}
      </div>
    </div>
  )
}
