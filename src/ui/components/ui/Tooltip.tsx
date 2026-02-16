import React from 'react'
import { cn } from '../../lib/cn'

export const Tooltip: React.FC<{
  content: React.ReactNode
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
}> = ({ content, className, side = 'top', children }) => {
  const sideClass =
    side === 'top'
      ? 'bottom-full mb-2'
      : side === 'bottom'
        ? 'top-full mt-2'
        : side === 'left'
          ? 'right-full mr-2'
          : 'left-full ml-2'
  return (
    <span className="relative inline-flex items-center group">
      {children}
      <span
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-text shadow-soft opacity-0 transition group-hover:opacity-100',
          sideClass,
          className
        )}
      >
        {content}
      </span>
    </span>
  )
}
