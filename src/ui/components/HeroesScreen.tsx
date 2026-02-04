import React, { useMemo, useState } from 'react'
import { GEAR_DEFS, HERO_DEFS } from '../../config/balance'
import { GameState } from '../../game/types'
import { getHeroStats } from '../../game/logic'

export const HeroesScreen: React.FC<{
  state: GameState
  onSummon: (keyType: 'gold' | 'platinum') => void
  onLevelUp: (heroId: string) => void
  onEquip: (heroId: string, gearId: string) => void
}> = ({ state, onSummon, onLevelUp, onEquip }) => {
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const ownedGear = useMemo(() => state.inventory.gear.map((id) => GEAR_DEFS.find((g) => g.id === id)).filter(Boolean), [state.inventory.gear])

  return (
    <div className="screen">
      <div className="panel-row">
        <div className="panel">
          <h3>Hero Hall</h3>
          <div className="muted">Gold Keys: {state.inventory.keys.gold} | Platinum Keys: {state.inventory.keys.platinum}</div>
          <div className="button-row">
            <button className={`btn ${state.inventory.keys.gold > 0 ? 'success' : ''}`} onClick={() => onSummon('gold')} disabled={state.inventory.keys.gold <= 0}>Summon (Gold)</button>
            <button className={`btn ${state.inventory.keys.platinum > 0 ? 'success' : ''}`} onClick={() => onSummon('platinum')} disabled={state.inventory.keys.platinum <= 0}>Summon (Platinum)</button>
          </div>
          <div className="muted">First summon grants 3 starter heroes.</div>
        </div>
        <div className="panel">
          <h3>Inventory</h3>
          <div>XP Items: {state.inventory.xpItems}</div>
          <div>Gear: {state.inventory.gear.length}</div>
        </div>
      </div>

      <div className="card-grid">
        {state.heroes.length === 0 && (
          <div className="muted">No heroes yet. Summon to begin.</div>
        )}
        {state.heroes.map((hero) => {
          const def = HERO_DEFS.find((h) => h.id === hero.id)
          if (!def) return null
          const stats = getHeroStats(hero)
          return (
            <div className="card" key={hero.id}>
              <h4>{def.name} <span className="badge">{def.rarity}</span></h4>
              <div className="muted">Role: {def.role}</div>
              <div className="muted">Level {hero.level}</div>
              <div>ATK {stats.attack} | DEF {stats.defense} | HP {stats.hp}</div>
              <div className="muted">Skills: {def.skills.map((s) => s.name).join(', ')}</div>
              <div className="gear-slots">
                <div>Weapon: {hero.gear.weapon ?? 'None'}</div>
                <div>Armor: {hero.gear.armor ?? 'None'}</div>
                <div>Charm: {hero.gear.charm ?? 'None'}</div>
              </div>
              <div className="button-row">
                <button className="btn" onClick={() => onLevelUp(hero.id)} disabled={state.inventory.xpItems <= 0}>Level Up</button>
                <button className="btn" onClick={() => setSelectedHeroId(hero.id)}>Equip Gear</button>
              </div>
            </div>
          )
        })}
      </div>

      {selectedHeroId && (
        <div className="panel">
          <h3>Equip Gear</h3>
          <div className="muted">Select gear to equip on {HERO_DEFS.find((h) => h.id === selectedHeroId)?.name}</div>
          <div className="gear-grid">
            {ownedGear.length === 0 && <div className="muted">No gear available. Win battles for drops.</div>}
            {ownedGear.map((gear) => {
              if (!gear) return null
              return (
                <button
                  className="btn"
                  key={gear.id}
                  onClick={() => onEquip(selectedHeroId, gear.id)}
                >
                  {gear.name} ({gear.slot})
                </button>
              )
            })}
          </div>
          <button className="btn" onClick={() => setSelectedHeroId(null)}>Done</button>
        </div>
      )}
    </div>
  )
}
