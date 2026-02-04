import React from 'react'
import { BUILDING_DEFS } from '../../config/buildings'
import { IncomeBreakdown } from '../../run/types'

export const DayEndOverlay: React.FC<{
  dayNumber: number
  breakdown: IncomeBreakdown
  onNextDay: () => void
}> = ({ dayNumber, breakdown, onNextDay }) => {
  return (
    <div className="overlay">
      <div className="overlay-card day-end-card">
        <h2>Survived Day {dayNumber}</h2>
        <p className="muted">Collect your reward and prepare for the next day.</p>
        <div className="panel compact">
          <h4>Gold Breakdown</h4>
          <div className="list">
            <div className="list-row">
              <div>Survival Reward</div>
              <div>+{breakdown.reward}</div>
            </div>
            {breakdown.items.map((item, index) => (
              <div key={`${item.id}_${item.level}_${index}`} className="list-row">
                <div>{BUILDING_DEFS[item.id].name} Lv {item.level}</div>
                <div>+{item.amount}</div>
              </div>
            ))}
            <div className="list-row total">
              <div>Total</div>
              <div>+{breakdown.total}</div>
            </div>
          </div>
        </div>
        <button className="btn success" onClick={onNextDay}>Next Day</button>
      </div>
    </div>
  )
}
