import React, { useEffect, useMemo, useState } from 'react'
import { HERO_DEFS } from '../../config/balance'
import { GameState, TroopType } from '../../game/types'
import { canAfford, getTrainingCost, getTrainingTime, getTroopCap } from '../../game/logic'

export const TroopsScreen: React.FC<{
  state: GameState
  onTrain: (type: TroopType, amount: number) => void
  onUpdateSquad: (payload: { leaderId?: string; supportIds: string[]; composition: { infantry: number; archer: number; cavalry: number } }) => void
}> = ({ state, onTrain, onUpdateSquad }) => {
  const [trainType, setTrainType] = useState<TroopType>('infantry')
  const [trainAmount, setTrainAmount] = useState(10)
  const [leaderId, setLeaderId] = useState(state.squad.leaderId ?? '')
  const [supportOne, setSupportOne] = useState(state.squad.supportIds[0] ?? '')
  const [supportTwo, setSupportTwo] = useState(state.squad.supportIds[1] ?? '')
  const [composition, setComposition] = useState(state.squad.composition)

  useEffect(() => {
    setLeaderId(state.squad.leaderId ?? '')
    setSupportOne(state.squad.supportIds[0] ?? '')
    setSupportTwo(state.squad.supportIds[1] ?? '')
    setComposition(state.squad.composition)
  }, [state.squad])

  const cap = getTroopCap(state)
  const total = state.troops.infantry + state.troops.archer + state.troops.cavalry
  const cost = getTrainingCost(trainType, trainAmount)
  const time = getTrainingTime(trainType, trainAmount)
  const canTrain = !state.trainingQueue && total + trainAmount <= cap && canAfford(state.resources, cost)

  const heroOptions = useMemo(() => state.heroes.map((hero) => {
    const def = HERO_DEFS.find((h) => h.id === hero.id)
    return { id: hero.id, name: def?.name ?? hero.id }
  }), [state.heroes])

  const updateComposition = (key: 'infantry' | 'archer' | 'cavalry', value: number) => {
    setComposition((prev) => ({ ...prev, [key]: Math.max(0, value) }))
  }

  const applySquad = () => {
    const supportIds = [supportOne, supportTwo].filter((id) => id)
    onUpdateSquad({
      leaderId: leaderId || undefined,
      supportIds,
      composition
    })
  }

  return (
    <div className="screen">
      <div className="panel-row">
        <div className="panel">
          <h3>Training Grounds</h3>
          <div>Troop Cap: {total}/{cap}</div>
          <div className="muted">Queue: {state.trainingQueue ? `${state.trainingQueue.amount} ${state.trainingQueue.type} (ends in ${Math.max(0, Math.ceil((state.trainingQueue.endsAt - Date.now()) / 1000))}s)` : 'Idle'}</div>
          <div className="form-row">
            <label>Type</label>
            <select value={trainType} onChange={(event) => setTrainType(event.target.value as TroopType)}>
              <option value="infantry">Infantry</option>
              <option value="archer">Archers</option>
              <option value="cavalry">Cavalry</option>
            </select>
          </div>
          <div className="form-row">
            <label>Amount</label>
            <input type="number" min={1} max={100} value={trainAmount} onChange={(event) => setTrainAmount(Number(event.target.value))} />
          </div>
          <div className="muted">Cost: F{cost.food} W{cost.wood} S{cost.stone} G{cost.gold}</div>
          <div className="muted">Time: {Math.floor(time / 60)}m {time % 60}s</div>
          <button className={`btn ${canTrain ? 'success' : ''}`} onClick={() => onTrain(trainType, trainAmount)} disabled={!canTrain}>Start Training</button>
        </div>
        <div className="panel">
          <h3>Troop Counts</h3>
          <div>Infantry: {state.troops.infantry}</div>
          <div>Archers: {state.troops.archer}</div>
          <div>Cavalry: {state.troops.cavalry}</div>
          <div className="muted">Advantage: Infantry {'>'} Cavalry, Cavalry {'>'} Archers, Archers {'>'} Infantry</div>
        </div>
      </div>

      <div className="panel">
        <h3>Squad Builder</h3>
        <div className="form-row">
          <label>Leader</label>
          <select value={leaderId} onChange={(event) => setLeaderId(event.target.value)}>
            <option value="">None</option>
            {heroOptions.map((hero) => (
              <option key={hero.id} value={hero.id}>{hero.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Support 1</label>
          <select value={supportOne} onChange={(event) => setSupportOne(event.target.value)}>
            <option value="">None</option>
            {heroOptions.map((hero) => (
              <option key={hero.id} value={hero.id}>{hero.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Support 2</label>
          <select value={supportTwo} onChange={(event) => setSupportTwo(event.target.value)}>
            <option value="">None</option>
            {heroOptions.map((hero) => (
              <option key={hero.id} value={hero.id}>{hero.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Infantry</label>
          <input type="number" min={0} value={composition.infantry} onChange={(event) => updateComposition('infantry', Number(event.target.value))} />
        </div>
        <div className="form-row">
          <label>Archers</label>
          <input type="number" min={0} value={composition.archer} onChange={(event) => updateComposition('archer', Number(event.target.value))} />
        </div>
        <div className="form-row">
          <label>Cavalry</label>
          <input type="number" min={0} value={composition.cavalry} onChange={(event) => updateComposition('cavalry', Number(event.target.value))} />
        </div>
        <button className="btn primary" onClick={applySquad}>Save Squad</button>
      </div>
    </div>
  )
}
