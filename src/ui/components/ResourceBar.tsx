import React from 'react'
import { Resources } from '../../game/types'

const format = (value: number) => Math.floor(value).toLocaleString()

export const ResourceBar: React.FC<{
  resources: Resources
  banked: Resources
  onCollect: () => void
}> = ({ resources, banked, onCollect }) => {
  return (
    <div className="resource-bar">
      <div className="resource-group">
        <div>Food: {format(resources.food)} <span className="muted">(+{format(banked.food)})</span></div>
        <div>Wood: {format(resources.wood)} <span className="muted">(+{format(banked.wood)})</span></div>
        <div>Stone: {format(resources.stone)} <span className="muted">(+{format(banked.stone)})</span></div>
        <div>Gold: {format(resources.gold)} <span className="muted">(+{format(banked.gold)})</span></div>
      </div>
      <button className="btn primary" onClick={onCollect}>Collect All</button>
    </div>
  )
}
