import React from 'react'
import type { EnemyTraitId, NightModifierId, PerkId } from '../../../config/nightContent'
import { Button } from '../ui/Button'

export const NightDebugPanel: React.FC<{
  runSeed: number
  modifierIds: NightModifierId[]
  perkIds: PerkId[]
  traitIds: EnemyTraitId[]
  forceNightModifierId?: NightModifierId
  forcePerkId?: PerkId
  forceEnemyTraitId?: EnemyTraitId
  forceEliteVariant?: boolean
  onRerollSeed: () => void
  onSetOverride: (overrides: {
    forceNightModifierId?: NightModifierId
    forcePerkId?: PerkId
    forceEnemyTraitId?: EnemyTraitId
    forceEliteVariant?: boolean
  }) => void
}> = ({
  runSeed,
  modifierIds,
  perkIds,
  traitIds,
  forceNightModifierId,
  forcePerkId,
  forceEnemyTraitId,
  forceEliteVariant,
  onRerollSeed,
  onSetOverride
}) => {
  if (!import.meta.env.DEV) return null

  return (
    <div className="pointer-events-auto fixed right-4 top-24 z-30 w-[280px] rounded-2xl border border-white/10 bg-surface p-3 text-xs text-muted shadow-soft">
      <div className="mb-2 font-semibold text-text">Night Debug</div>
      <div className="mb-2">Seed: <span className="text-text">{runSeed}</span></div>
      <Button size="sm" variant="secondary" className="mb-3 w-full" onClick={onRerollSeed}>Reroll Seed</Button>

      <label className="mb-2 block">
        <div className="mb-1">Force Modifier</div>
        <select
          value={forceNightModifierId ?? ''}
          onChange={(event) => onSetOverride({ forceNightModifierId: event.target.value || undefined })}
          className="w-full rounded-lg border border-white/10 bg-surface px-2 py-1 text-text"
        >
          <option value="">Auto</option>
          {modifierIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      <label className="mb-2 block">
        <div className="mb-1">Force Perk Offer</div>
        <select
          value={forcePerkId ?? ''}
          onChange={(event) => onSetOverride({ forcePerkId: event.target.value || undefined })}
          className="w-full rounded-lg border border-white/10 bg-surface px-2 py-1 text-text"
        >
          <option value="">Auto</option>
          {perkIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      <label className="mb-2 block">
        <div className="mb-1">Force Enemy Trait</div>
        <select
          value={forceEnemyTraitId ?? ''}
          onChange={(event) => onSetOverride({ forceEnemyTraitId: event.target.value || undefined })}
          className="w-full rounded-lg border border-white/10 bg-surface px-2 py-1 text-text"
        >
          <option value="">Auto</option>
          {traitIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-2 text-text">
        <input
          type="checkbox"
          checked={forceEliteVariant === true}
          onChange={(event) => onSetOverride({ forceEliteVariant: event.target.checked ? true : undefined })}
        />
        <span>Force Elite Variants</span>
      </label>
    </div>
  )
}
