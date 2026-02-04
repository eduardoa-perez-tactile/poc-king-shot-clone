import { getHeroRuntime, getRunDayPlan, getRunLevel } from '../run/runState'
import { RunState } from '../run/types'
import { CombatDefinition } from './types'

export const buildCombatDefinition = (run: RunState): CombatDefinition => {
  const level = getRunLevel(run)
  const dayPlan = getRunDayPlan(run)
  return {
    dayNumber: run.dayNumber,
    hero: getHeroRuntime(run),
    map: level.map,
    waves: dayPlan.waves.map((wave) => ({
      id: wave.id,
      units: wave.units,
      spawnTimeSec: wave.spawnTimeSec,
      isBoss: wave.isBoss
    })),
    waveMode: dayPlan.waveMode ?? 'sequential',
    waveDelaySec: dayPlan.waveDelaySec ?? 5,
    enemyModifiers: dayPlan.enemyModifiers ?? { hpMultiplier: 1, attackMultiplier: 1 },
    hqBaseHp: 1500
  }
}
