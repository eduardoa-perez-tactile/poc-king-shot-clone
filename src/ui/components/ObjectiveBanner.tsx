import React from 'react'

export interface Objective {
  title: string
  description: string
  ctaLabel?: string
  onAction?: () => void
}

export const ObjectiveBanner: React.FC<{ objective: Objective | null }> = ({ objective }) => {
  if (!objective) return null
  return (
    <div className="objective">
      <div>
        <div className="objective-title">{objective.title}</div>
        <div className="muted">{objective.description}</div>
      </div>
      {objective.ctaLabel && objective.onAction && (
        <button className="btn primary" onClick={objective.onAction}>{objective.ctaLabel}</button>
      )}
    </div>
  )
}
