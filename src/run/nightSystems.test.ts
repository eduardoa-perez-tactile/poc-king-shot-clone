import { getLevelById } from '../config/levels'
import { createRunState } from './runState'
import { buildNightPlan, getPerkOffersForNight } from './nightSystems'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const assertTrue = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message)
}
const assertDeepEqual = (a: unknown, b: unknown, message: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(message)
}
const assertNotDeepEqual = (a: unknown, b: unknown, message: string) => {
  if (JSON.stringify(a) === JSON.stringify(b)) throw new Error(message)
}

const buildTestLevel = () => {
  const base = getLevelById('level_1')
  if (!base) throw new Error('level_1 not found')
  const level = clone(base)
  const firstDay = level.days[0]
  if (!firstDay || !firstDay.waves[0]) throw new Error('level_1 wave data missing')
  firstDay.waves[0] = {
    ...firstDay.waves[0],
    traits: ['shielded'],
    eliteChance: 0.5,
    groups: [
      { enemyTypeId: 'infantry', count: 4, traits: ['tower_hunter'], eliteChance: 0.5 },
      { enemyTypeId: 'archer', count: 3, traits: ['explosive'], eliteChance: 0.25 }
    ]
  }
  return level
}

const testDeterministicPerkOffers = () => {
  const level = buildTestLevel()
  const run = { ...createRunState('level_1'), runSeed: 424242 }
  const offersA = getPerkOffersForNight(level, run, 1).map((entry) => entry.id)
  const offersB = getPerkOffersForNight(level, run, 1).map((entry) => entry.id)
  assertDeepEqual(offersA, offersB, 'Perk offers must be deterministic for same seed/night')
}

const testDeterministicNightPlan = () => {
  const level = buildTestLevel()
  const run = {
    ...createRunState('level_1'),
    runSeed: 1337,
    activeNightModifier: 'more_hordes',
    perks: {},
    debugOverrides: {}
  }
  const waves = level.days[0].waves
  const planA = buildNightPlan(level, run, waves)
  const planB = buildNightPlan(level, run, waves)
  assertDeepEqual(planA, planB, 'Night plan must be deterministic for same seed/input')
}

const testEliteRollChangesWithSeed = () => {
  const level = buildTestLevel()
  const runA = {
    ...createRunState('level_1'),
    runSeed: 9001,
    activeNightModifier: undefined,
    perks: {},
    debugOverrides: {}
  }
  const runB = {
    ...createRunState('level_1'),
    runSeed: 9002,
    activeNightModifier: undefined,
    perks: {},
    debugOverrides: {}
  }
  const waves = level.days[0].waves
  const planA = buildNightPlan(level, runA, waves)
  const planB = buildNightPlan(level, runB, waves)
  const eliteRollsA = planA.waves.flatMap((wave) => wave.spawns.map((spawn) => spawn.isEliteVariant))
  const eliteRollsB = planB.waves.flatMap((wave) => wave.spawns.map((spawn) => spawn.isEliteVariant))
  assertNotDeepEqual(eliteRollsA, eliteRollsB, 'Elite rolls should differ when seed differs')
}

export const runNightSystemsTests = () => {
  testDeterministicPerkOffers()
  testDeterministicNightPlan()
  testEliteRollChangesWithSeed()
  assertTrue(true, 'All tests passed')
  return 'nightSystems tests passed'
}
