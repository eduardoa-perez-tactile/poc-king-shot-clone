import React from 'react'
import { cn } from '../../lib/cn'

export const AppShell: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    className={cn(
      'relative min-h-screen bg-bg text-text overflow-hidden',
      "before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%)]",
      className
    )}
    {...props}
  />
)
