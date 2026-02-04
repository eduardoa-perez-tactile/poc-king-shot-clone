import React from 'react'
import { cn } from '../../lib/cn'

type BadgeVariant = 'default' | 'accent' | 'danger' | 'success'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-text',
  accent: 'bg-accent/20 text-accent',
  danger: 'bg-danger/20 text-danger',
  success: 'bg-success/20 text-success'
}

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }> = ({
  className,
  variant = 'default',
  ...props
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide',
      variantClasses[variant],
      className
    )}
    {...props}
  />
)
