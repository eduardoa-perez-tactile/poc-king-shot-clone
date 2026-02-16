import React from 'react'
import { cn } from '../../lib/cn'

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={cn(
      'rounded-2xl border border-white/10 bg-surface shadow-soft',
      className
    )}
    {...props}
  />
)
