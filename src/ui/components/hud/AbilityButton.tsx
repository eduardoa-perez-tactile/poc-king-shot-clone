import React from 'react'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { cn } from '../../lib/cn'

export const AbilityButton: React.FC<{
  name: string
  description: string
  keyHint: string
  cooldown: number
  readyIn: number
  disabled?: boolean
  testId?: string
  onClick?: () => void
}> = ({ name, description, keyHint, cooldown, readyIn, disabled, testId, onClick }) => {
  const pct = cooldown > 0 ? Math.min(100, (readyIn / cooldown) * 100) : 0
  const isReady = readyIn <= 0
  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <div className="text-xs font-semibold text-text">{name}</div>
          <div className="text-[11px] text-muted">{description}</div>
          <div className="text-[11px] text-muted">Shortcut: {keyHint}</div>
        </div>
      }
    >
      <div className="relative">
        <Button
          variant={isReady ? 'primary' : 'secondary'}
          size="lg"
          disabled={disabled || !isReady}
          onClick={onClick}
          data-testid={testId}
          className={cn('relative h-16 w-16 rounded-2xl p-0 text-xs font-semibold', isReady && 'shadow-glow')}
        >
          {keyHint}
        </Button>
        {readyIn > 0 && (
          <span
            className="cooldown-overlay pointer-events-none absolute inset-0 rounded-2xl"
            style={{ ['--cooldown' as string]: pct }}
          />
        )}
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] text-muted shadow-soft">
          {name}
        </span>
      </div>
    </Tooltip>
  )
}
