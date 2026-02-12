import React from 'react'
import { AlertTriangle, Shield, Swords, Zap } from 'lucide-react'
import type { SpawnEdge } from '../../../config/levels'
import { Badge } from '../ui/Badge'
import { Dialog } from '../ui/Dialog'

export interface NextBattleIntelEntry {
  id: string
  name: string
  trait: string
  kind: 'unit' | 'elite'
}

const edgeLabel: Record<SpawnEdge, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West'
}

const kindIcon: Record<NextBattleIntelEntry['kind'], React.ReactNode> = {
  unit: <Swords className="h-4 w-4 text-accent" />,
  elite: <AlertTriangle className="h-4 w-4 text-danger" />
}

const kindBadge: Record<NextBattleIntelEntry['kind'], 'accent' | 'danger'> = {
  unit: 'accent',
  elite: 'danger'
}

export const NextBattleIntelPanel: React.FC<{
  open: boolean
  dayNumber: number
  previewEdges: SpawnEdge[]
  enemies: NextBattleIntelEntry[]
  onOpenChange: (open: boolean) => void
}> = ({ open, dayNumber, previewEdges, enemies, onOpenChange }) => {
  const units = enemies.filter((entry) => entry.kind === 'unit')
  const elites = enemies.filter((entry) => entry.kind === 'elite')
  const edgeText = previewEdges.map((edge) => edgeLabel[edge]).join(' · ')

  return (
    <Dialog
      open={open}
      title={`Next Battle Intel · Day ${dayNumber}`}
      description="Distinct enemy archetypes and likely border entry points for the upcoming cycle."
      onOpenChange={onOpenChange}
      className="max-w-xl"
    >
      <div className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
        <div className="text-xs text-muted">Expected Entry Borders</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-text">
          <Shield className="h-4 w-4 text-accent" />
          <span>{edgeText || 'Unknown'}</span>
        </div>
      </div>

      <div className="space-y-3">
        {units.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Unit Waves</div>
            {units.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-sm text-text">
                  <div className="flex items-center gap-2">
                    {kindIcon[entry.kind]}
                    <span>{entry.name}</span>
                  </div>
                  <Badge variant={kindBadge[entry.kind]}>Unit</Badge>
                </div>
                <div className="mt-1 text-xs text-muted">{entry.trait}</div>
              </div>
            ))}
          </div>
        )}

        {elites.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Elite Threats</div>
            {elites.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-sm text-text">
                  <div className="flex items-center gap-2">
                    {kindIcon[entry.kind]}
                    <span>{entry.name}</span>
                  </div>
                  <Badge variant={kindBadge[entry.kind]}>Elite</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <Zap className="h-3.5 w-3.5 text-danger" />
                  <span>{entry.trait}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {enemies.length === 0 && <div className="text-sm text-muted">No enemy archetypes are configured for this cycle.</div>}
      </div>
    </Dialog>
  )
}
