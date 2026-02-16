import React from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { Lock } from 'lucide-react'

export const BuildOptionCard: React.FC<{
  title: string
  description: string
  cost: number
  canAfford: boolean
  locked?: boolean
  lockedReason?: string
  onBuild: () => void
  testId?: string
}> = ({ title, description, cost, canAfford, locked, lockedReason, onBuild, testId }) => {
  const isLocked = Boolean(locked)
  const content = (
    <Card
      className={[
        'flex h-full flex-col justify-between gap-3 p-4 transition',
        isLocked ? 'border-white/5 bg-slate-900/50 opacity-70' : 'hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lift'
      ].join(' ')}
    >
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-text">
          {isLocked && <Lock className="h-3.5 w-3.5 text-muted" />}
          <span>{title}</span>
        </div>
        <div className="mt-1 text-xs text-muted">{description}</div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Cost</span>
        <span className="text-text">{cost.toLocaleString()} gold</span>
      </div>
      <Button
        variant={canAfford && !isLocked ? 'primary' : 'secondary'}
        size="sm"
        disabled={!canAfford || isLocked}
        onClick={onBuild}
        data-testid={testId}
      >
        Build
      </Button>
    </Card>
  )

  if (!isLocked || !lockedReason) return content

  return <Tooltip content={lockedReason}>{content}</Tooltip>
}
