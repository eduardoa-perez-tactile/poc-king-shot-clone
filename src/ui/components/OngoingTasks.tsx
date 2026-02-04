import React from 'react'
import { BUILDING_DEFS, EVENT_CONFIG } from '../../config/balance'
import { GameState } from '../../game/types'

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s}s`
}

export const OngoingTasks: React.FC<{ state: GameState }> = ({ state }) => {
  const now = Date.now()
  const tasks: Array<{ title: string; detail: string }> = []

  if (state.upgradeQueue) {
    const name = BUILDING_DEFS[state.upgradeQueue.buildingId].name
    tasks.push({
      title: `${name} upgrade`,
      detail: `Ends in ${formatTime(state.upgradeQueue.endsAt - now)}`
    })
  }

  if (state.trainingQueue) {
    tasks.push({
      title: `Training ${state.trainingQueue.amount} ${state.trainingQueue.type}`,
      detail: `Ends in ${formatTime(state.trainingQueue.endsAt - now)}`
    })
  }

  const eventLeft = state.event.endAt - now
  if (eventLeft > 0) {
    tasks.push({
      title: EVENT_CONFIG.name,
      detail: `Event ends in ${formatTime(eventLeft)}`
    })
  }

  return (
    <div className="panel">
      <h3>Ongoing Tasks</h3>
      {tasks.length === 0 ? (
        <div className="muted">No active tasks. Start an upgrade or training.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <div key={task.title} className="task-item">
              <div>{task.title}</div>
              <div className="muted">{task.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
