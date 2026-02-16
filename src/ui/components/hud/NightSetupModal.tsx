import React, { useMemo, useState } from 'react'
import type { NightModifierDef } from '../../../config/nightContent'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

export const NightSetupModal: React.FC<{
  open: boolean
  dayNumber: number
  modifiers: NightModifierDef[]
  initialSelection?: string
  allowNone?: boolean
  onCancel: () => void
  onConfirm: (modifierId?: string) => void
}> = ({ open, dayNumber, modifiers, initialSelection, allowNone = true, onCancel, onConfirm }) => {
  const [selected, setSelected] = useState<string | undefined>(initialSelection)

  React.useEffect(() => {
    setSelected(initialSelection)
  }, [initialSelection, open])

  const selectedDef = useMemo(() => modifiers.find((entry) => entry.id === selected), [modifiers, selected])

  return (
    <Dialog
      open={open}
      title={`Night Setup · Day ${dayNumber}`}
      description="Pick one risk/reward modifier before Battle Cry. Reward multiplier applies to end-of-night gold."
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      className="max-w-2xl"
    >
      <div className="space-y-2">
        {allowNone && (
          <button
            type="button"
            className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${selected ? 'border-white/10 bg-surface text-muted' : 'border-cyan-300/60 bg-cyan-950 text-text'}`}
            onClick={() => setSelected(undefined)}
          >
            <div className="font-semibold">No Modifier</div>
            <div className="text-xs text-muted">Safe night, no bonus multiplier.</div>
          </button>
        )}
        {modifiers.map((modifier) => (
          <button
            key={modifier.id}
            type="button"
            className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${selected === modifier.id ? 'border-cyan-300/70 bg-cyan-950 text-text' : 'border-white/10 bg-surface text-text'}`}
            onClick={() => setSelected(modifier.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{modifier.name}</div>
              <Badge variant="accent">x{modifier.rewardMultiplier.toFixed(2)} reward</Badge>
            </div>
            <div className="mt-1 text-xs text-muted">{modifier.description}</div>
          </button>
        ))}
      </div>

      <div className="mt-1 rounded-xl border border-white/10 bg-surface px-3 py-2 text-xs text-muted">
        Selected: <span className="text-text">{selectedDef ? selectedDef.name : 'No modifier'}</span>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={() => onConfirm(selected)}>Start Night</Button>
      </div>
    </Dialog>
  )
}
