import React from 'react'
import { Badge } from '../ui/Badge'

export const PhaseBadge: React.FC<{ phase: 'build' | 'combat' | 'day_end' }> = ({ phase }) => {
  const label = phase === 'combat' ? 'COMBAT' : phase === 'day_end' ? 'DAY END' : 'BUILD'
  const variant = phase === 'combat' ? 'danger' : phase === 'day_end' ? 'accent' : 'success'
  return <Badge variant={variant}>{label}</Badge>
}
