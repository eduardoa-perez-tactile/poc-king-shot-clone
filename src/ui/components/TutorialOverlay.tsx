import React from 'react'

export const TutorialOverlay: React.FC<{
  steps: Record<string, boolean>
  dismissed: boolean
  currentStep: { id: string; label: string; description: string; ctaLabel: string } | null
  onAction: () => void
  onDismiss: () => void
}> = ({ steps, dismissed, currentStep, onAction, onDismiss }) => {
  if (dismissed) return null
  const items = [
    { id: 'collect', label: 'Collect resources' },
    { id: 'upgrade', label: 'Upgrade a building' },
    { id: 'summon', label: 'Summon a hero' },
    { id: 'train', label: 'Train troops' },
    { id: 'raid', label: 'Win a raid' }
  ]
  const completed = items.every((item) => steps[item.id])
  return (
    <div className="tutorial">
      <div className="tutorial-card">
        <h3>Governor Checklist</h3>
        {items.map((item) => (
          <div key={item.id} className="tutorial-item">
            <span className={steps[item.id] ? 'done' : ''}>{steps[item.id] ? '✓' : '○'}</span>
            <span>{item.label}</span>
          </div>
        ))}
        {currentStep && !completed && (
          <div className="tutorial-next">
            <div className="muted">Next:</div>
            <div>{currentStep.label}</div>
            <div className="muted">{currentStep.description}</div>
            <button className="btn primary" onClick={onAction}>{currentStep.ctaLabel}</button>
          </div>
        )}
        <button className="btn" onClick={onDismiss}>{completed ? 'Finish Tutorial' : 'Hide'}</button>
      </div>
    </div>
  )
}
