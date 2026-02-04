import React from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

export const BuildOptionCard: React.FC<{
  title: string
  description: string
  cost: number
  canAfford: boolean
  onBuild: () => void
}> = ({ title, description, cost, canAfford, onBuild }) => (
  <Card className="flex h-full flex-col justify-between gap-3 p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lift">
    <div>
      <div className="text-sm font-semibold text-text">{title}</div>
      <div className="mt-1 text-xs text-muted">{description}</div>
    </div>
    <div className="flex items-center justify-between text-xs text-muted">
      <span>Cost</span>
      <span className="text-text">{cost.toLocaleString()} gold</span>
    </div>
    <Button variant={canAfford ? 'primary' : 'secondary'} size="sm" disabled={!canAfford} onClick={onBuild}>
      Build
    </Button>
  </Card>
)
