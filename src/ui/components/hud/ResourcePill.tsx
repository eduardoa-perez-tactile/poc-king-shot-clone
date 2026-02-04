import React from 'react'
import { cn } from '../../lib/cn'

export const ResourcePill: React.FC<{
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
  className?: string
  compact?: boolean
}> = ({ label, value, icon, className, compact }) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-2xl border border-white/10 bg-surface/80 px-3 py-2 shadow-soft',
      compact && 'px-2 py-1 text-xs',
      className
    )}
  >
    {icon && <div className="text-accent">{icon}</div>}
    <div className="flex flex-col leading-tight">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  </div>
)
