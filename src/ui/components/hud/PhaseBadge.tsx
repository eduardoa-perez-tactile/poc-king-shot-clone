import React from 'react'
import { Badge } from '../ui/Badge'

export const PhaseBadge: React.FC<{ phase: 'build' | 'battle_cry' | 'combat' | 'day_end' }> = ({ phase }) => {
  const label = phase === 'combat' ? 'COMBAT' : phase === 'day_end' ? 'DAY END' : phase === 'battle_cry' ? 'BATTLE CRY' : 'BUILD'
  const variant = phase === 'combat' ? 'danger' : phase === 'day_end' ? 'accent' : phase === 'battle_cry' ? 'accent' : 'success'
  return <Badge variant={variant}>{label}</Badge>
}
