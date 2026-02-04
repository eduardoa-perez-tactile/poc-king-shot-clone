import React from 'react'
import { Card } from '../ui/Card'
import { Progress } from '../ui/Progress'

export const EntityCard: React.FC<{
  title: string
  subtitle?: string
  description?: string
  hp?: { value: number; max: number }
  meta?: React.ReactNode
  actions?: React.ReactNode
}> = ({ title, subtitle, description, hp, meta, actions }) => (
  <Card className="space-y-3 p-4">
    <div>
      <div className="text-sm font-semibold text-text">{title}</div>
      {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
    </div>
    {description && <div className="text-xs text-muted">{description}</div>}
    {hp && (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>HP</span>
          <span>
            {Math.round(hp.value)}/{Math.round(hp.max)}
          </span>
        </div>
        <Progress value={hp.value} max={hp.max} />
      </div>
    )}
    {meta}
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </Card>
)
