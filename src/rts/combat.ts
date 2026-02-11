import { getHeroRuntime, getRunDayPlan, getRunLevel } from '../run/runState'
import { EliteId } from '../config/elites'
import { getStrongholdHqBaseHp } from '../config/stronghold'
import { RunState } from '../run/types'
import { CombatDefinition } from './types'

export const buildCombatDefinition = (run: RunState): CombatDefinition => {
  const level = getRunLevel(run)
  const dayPlan = getRunDayPlan(run)
  const lastDay = Math.max(...level.days.map((day) => day.day))
  const miniBossAfterWave = dayPlan.miniBossAfterWave ?? 2
  const suppressDayOneMiniBoss = level.minibossRules.suppressDay1MiniBoss && run.dayNumber === 1
  const miniBossId: EliteId = dayPlan.miniBossId ?? 'miniBoss'
  const bossId: EliteId = level.bossId ?? 'boss'
  let waves = dayPlan.waves.map((wave) => ({
    id: wave.id,
    units: wave.units,
    spawnTimeSec: wave.spawnTimeSec,
    elite: wave.elite,
    eliteCount: wave.eliteCount
  }))

  if (!suppressDayOneMiniBoss && miniBossAfterWave > 0 && waves.length >= miniBossAfterWave) {
    const insertIndex = Math.min(waves.length, miniBossAfterWave)
    waves = [
      ...waves.slice(0, insertIndex),
      {
        id: `mini_${run.dayNumber}_${insertIndex}`,
        units: [],
        elite: miniBossId,
        eliteCount: 1
      },
      ...waves.slice(insertIndex)
    ]
  } else if (suppressDayOneMiniBoss && import.meta.env.DEV) {
    console.debug('[Combat] Day 1 miniboss suppressed by level rule.')
  }

  if (run.dayNumber === lastDay && waves.length > 0) {
    const finalIndex = waves.length - 1
    const finalWave = waves[finalIndex]
    waves[finalIndex] = { ...finalWave, elite: bossId, eliteCount: finalWave.eliteCount ?? 1 }
  }
  return {
    dayNumber: run.dayNumber,
    hero: getHeroRuntime(run),
    map: level.map,
    waves,
    waveMode: dayPlan.waveMode ?? 'sequential',
    waveDelaySec: dayPlan.waveDelaySec ?? 5,
    enemyModifiers: dayPlan.enemyModifiers ?? { hpMultiplier: 1, attackMultiplier: 1 },
    hqBaseHp: getStrongholdHqBaseHp(run.strongholdLevel)
  }
}
