import React from 'react'
import type { PerkDef } from '../../../config/nightContent'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'

export const PerkChoiceModal: React.FC<{
  open: boolean
  dayNumber: number
  offers: PerkDef[]
  perkCount: number
  perkMaxCount: number
  onPick: (perkId: string) => void
}> = ({ open, dayNumber, offers, perkCount, perkMaxCount, onPick }) => {
  const canPick = offers.length > 0 && perkCount < perkMaxCount

  return (
    <Dialog
      open={open}
      title={`Perk Choice · End of Day ${dayNumber}`}
      description="Choose one perk. Perks persist for this run and stack only when allowed."
      onOpenChange={() => {
        // Locked until a choice is made or no offers are available.
      }}
      className="max-w-3xl"
    >
      <div className="mb-2 text-xs text-muted">Run Perks: {perkCount}/{perkMaxCount}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {offers.map((perk) => (
          <div key={perk.id} className="rounded-2xl border border-white/10 bg-surface p-3">
            <div className="text-sm font-semibold text-text">{perk.name}</div>
            <div className="mt-1 text-xs text-muted">{perk.description}</div>
            <div className="mt-3">
              <Button variant="primary" size="sm" className="w-full" onClick={() => onPick(perk.id)} disabled={!canPick}>
                Pick
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!canPick && (
        <div className="mt-3 text-xs text-muted">No perk pick available this night.</div>
      )}
    </Dialog>
  )
}
