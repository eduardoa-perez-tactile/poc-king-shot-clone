import React from 'react'
import { cn } from '../../lib/cn'

export const Progress: React.FC<{ value: number; max?: number; className?: string }> = ({ value, max = 100, className }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}
