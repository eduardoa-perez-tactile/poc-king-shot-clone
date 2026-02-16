import React from 'react'
import { Coins, Radar, Settings2, Waves } from 'lucide-react'
import { AnimatedNumber } from './AnimatedNumber'
import { PhaseBadge } from './PhaseBadge'
import { ResourcePill } from './ResourcePill'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'

export const TopBar: React.FC<{
  mission: string
  day: number
  phase: 'build' | 'battle_cry' | 'combat' | 'day_end'
  objective: string
  waveLabel?: string
  gold: number
  income: number
  strongholdLevel: number
  strongholdSummary?: React.ReactNode
  onIntel?: () => void
  intelDisabled?: boolean
  onSettings: () => void
  onExit?: () => void
}> = ({
  mission,
  day,
  phase,
  objective,
  waveLabel,
  gold,
  income,
  strongholdLevel,
  strongholdSummary,
  onIntel,
  intelDisabled,
  onSettings,
  onExit
}) => {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-surface/80 px-4 py-3 shadow-soft backdrop-blur">
      <div className="flex min-w-[220px] flex-1 items-center gap-3">
        <div>
          <div className="text-lg font-semibold text-text">{mission}</div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Day {day}</span>
            <PhaseBadge phase={phase} />
            <Tooltip content={strongholdSummary ?? `Stronghold Lv${strongholdLevel}`}>
              <span className="rounded-full border border-white/10 bg-surface/70 px-2 py-0.5 text-[11px] text-text">
                Stronghold Lv{strongholdLevel}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="hidden flex-[2] items-center justify-center gap-3 text-sm text-text lg:flex">
        <div className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
          <span className="text-muted">Objective:</span> {objective}
        </div>
        {waveLabel && (
          <div className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2 text-muted">{waveLabel}</div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="flex flex-col items-end gap-1 text-xs text-muted lg:hidden">
          <div className="truncate text-text">{objective}</div>
          {waveLabel && (
            <Tooltip content={waveLabel} side="bottom">
              <span className="inline-flex items-center gap-1 text-muted">
                <Waves className="h-4 w-4" /> Wave
              </span>
            </Tooltip>
          )}
        </div>
        <ResourcePill
          label="Gold"
          icon={<Coins className="h-4 w-4" />}
          value={<AnimatedNumber className="text-base font-semibold" value={gold} />}
        />
        <ResourcePill label="Income" compact value={`+${income}/day`} className="hidden sm:flex" />
        {onExit && (
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit
          </Button>
        )}
        {onIntel && (
          <Button variant="ghost" size="sm" onClick={onIntel} disabled={intelDisabled} data-testid="intel-button">
            <Radar className="h-4 w-4" />
            <span className="hidden sm:inline">Intel</span>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onSettings}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
