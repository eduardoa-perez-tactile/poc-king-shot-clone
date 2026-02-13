import {
  DEFAULT_ELITE_CONFIG,
  DEFAULT_ENEMY_TRAITS,
  DEFAULT_NIGHT_MODIFIERS,
  DEFAULT_PERKS,
  EliteConfig,
  EnemyTraitDef,
  EnemyTraitId,
  NightModifierDef,
  NightModifierId,
  PerkDef,
  PerkId
} from '../config/nightContent'
import type { DayWave, LevelDefinition, SpawnEdge, SpawnEdgeConfig } from '../game/types/LevelDefinition'
import { inferSpawnEdgeFromPoint } from '../rts/spawnResolver'
import { deriveSeed, createSeededRng, pickWithoutReplacement } from './rng'
import type { NightPlan, NightPlanWave, RunState } from './types'

export interface BuffSnapshot {
  towerRangeMultiplier: number
  towerDamageMultiplier: number
  goldRewardMultiplier: number
  buildingUpgradeCostMultiplier: number
  rangedUnitsDamageMultiplier: number
  wallHpMultiplier: number
  endOfNightBonusGold: number
  enemyCountMultiplier: number
  enemyMoveSpeedMultiplier: number
  enemyHpMultiplier: number
  towersDisabled: boolean
  addExtraSpawnBorder: boolean
  rewardMultiplierFromNight: number
}

const clampMultiplier = (value: number) => Math.max(0.05, value)
// Multipliers stack multiplicatively: each stack applies (1 + delta) again.
// Example: +20% twice => 1.2 * 1.2 = 1.44, and -10% twice => 0.9 * 0.9 = 0.81.
const applyStackedMultiplier = (current: number, delta: number, stacks: number) => {
  if (stacks <= 0 || !Number.isFinite(delta) || delta === 0) return current
  return clampMultiplier(current * Math.pow(1 + delta, stacks))
}

export const getNightModifierDefs = (level: LevelDefinition): NightModifierDef[] =>
  (level.nightModifiers && level.nightModifiers.length > 0 ? level.nightModifiers : DEFAULT_NIGHT_MODIFIERS).map((entry) => ({
    ...entry,
    effects: { ...entry.effects }
  }))

export const getPerkDefs = (level: LevelDefinition): PerkDef[] =>
  (level.perks && level.perks.length > 0 ? level.perks : DEFAULT_PERKS).map((entry) => ({
    ...entry,
    effects: { ...entry.effects }
  }))

export const getEnemyTraitDefs = (level: LevelDefinition): EnemyTraitDef[] =>
  (level.enemyTraits && level.enemyTraits.length > 0 ? level.enemyTraits : DEFAULT_ENEMY_TRAITS).map((entry) => ({
    ...entry,
    effects: { ...entry.effects }
  }))

export const getEliteConfigForLevel = (level: LevelDefinition): EliteConfig => ({
  ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
  outline: {
    ...DEFAULT_ELITE_CONFIG.outline,
    ...(level.eliteConfig?.outline ?? {})
  }
})

export const getNightModifierById = (level: LevelDefinition, id?: NightModifierId) => {
  if (!id) return undefined
  const defs = getNightModifierDefs(level)
  return defs.find((entry) => entry.id === id)
}

export const getPerkById = (level: LevelDefinition, id?: PerkId) => {
  if (!id) return undefined
  const defs = getPerkDefs(level)
  return defs.find((entry) => entry.id === id)
}

export const getEnemyTraitById = (level: LevelDefinition, id?: EnemyTraitId) => {
  if (!id) return undefined
  const defs = getEnemyTraitDefs(level)
  return defs.find((entry) => entry.id === id)
}

export const getAllowedNightModifiersForNight = (level: LevelDefinition, nightIndex: number): NightModifierDef[] => {
  const defs = getNightModifierDefs(level)
  const byNight = level.allowedNightModifiersByNight ?? {}
  const allowedIds = byNight[nightIndex]
  if (!allowedIds || allowedIds.length === 0) return defs
  const allowedSet = new Set(allowedIds)
  return defs.filter((entry) => allowedSet.has(entry.id))
}

const resolveNightModifier = (level: LevelDefinition, run: RunState): NightModifierDef | undefined => {
  const debugForced = run.debugOverrides?.forceNightModifierId
  if (debugForced) {
    const forced = getNightModifierById(level, debugForced)
    if (forced) return forced
  }
  return getNightModifierById(level, run.activeNightModifier)
}

export const getBuffSnapshot = (level: LevelDefinition, run: RunState): BuffSnapshot => {
  const perksById = new Map(getPerkDefs(level).map((entry) => [entry.id, entry]))
  const modifier = resolveNightModifier(level, run)

  let towerRangeMultiplier = 1
  let towerDamageMultiplier = 1
  let goldRewardMultiplier = 1
  let buildingUpgradeCostMultiplier = 1
  let rangedUnitsDamageMultiplier = 1
  let wallHpMultiplier = 1
  let endOfNightBonusGold = 0

  Object.entries(run.perks ?? {}).forEach(([perkId, perkState]) => {
    const def = perksById.get(perkId)
    if (!def) return
    const stacks = Math.max(0, Math.floor(perkState?.stacks ?? 0))
    if (stacks <= 0) return
    towerRangeMultiplier = applyStackedMultiplier(towerRangeMultiplier, def.effects.towerRangeMultiplier ?? 0, stacks)
    towerDamageMultiplier = applyStackedMultiplier(towerDamageMultiplier, def.effects.towerDamageMultiplier ?? 0, stacks)
    goldRewardMultiplier = applyStackedMultiplier(goldRewardMultiplier, def.effects.goldRewardMultiplier ?? 0, stacks)
    buildingUpgradeCostMultiplier = applyStackedMultiplier(
      buildingUpgradeCostMultiplier,
      def.effects.buildingUpgradeCostMultiplier ?? 0,
      stacks
    )
    rangedUnitsDamageMultiplier = applyStackedMultiplier(
      rangedUnitsDamageMultiplier,
      def.effects.rangedUnitsDamageMultiplier ?? 0,
      stacks
    )
    wallHpMultiplier = applyStackedMultiplier(wallHpMultiplier, def.effects.wallHpMultiplier ?? 0, stacks)
    endOfNightBonusGold +=
      (def.effects.endOfNightBonusGoldPerStrongholdLevel ?? 0) * stacks * Math.max(1, Math.floor(run.strongholdLevel))
  })

  return {
    towerRangeMultiplier,
    towerDamageMultiplier,
    goldRewardMultiplier,
    buildingUpgradeCostMultiplier,
    rangedUnitsDamageMultiplier,
    wallHpMultiplier,
    endOfNightBonusGold,
    enemyCountMultiplier: clampMultiplier(1 + (modifier?.effects.enemyCountMultiplier ?? 0)),
    enemyMoveSpeedMultiplier: clampMultiplier(1 + (modifier?.effects.enemyMoveSpeedMultiplier ?? 0)),
    enemyHpMultiplier: clampMultiplier(1 + (modifier?.effects.enemyHpMultiplier ?? 0)),
    towersDisabled: Boolean(modifier?.effects.towersDisabled),
    addExtraSpawnBorder: Boolean(modifier?.effects.addExtraSpawnBorder),
    rewardMultiplierFromNight: modifier?.rewardMultiplier ?? 1
  }
}

const normalizeWaveGroups = (wave: DayWave) => {
  if (wave.groups && wave.groups.length > 0) {
    return wave.groups.map((group) => ({
      enemyTypeId: group.enemyTypeId,
      count: Math.max(1, Math.floor(group.count)),
      squadSize: undefined,
      traits: group.traits,
      eliteChance: group.eliteChance
    }))
  }
  return wave.units.map((unit) => ({
    enemyTypeId: unit.type,
    count: Math.max(1, Math.floor(unit.squads)),
    squadSize: unit.squadSize,
    traits: undefined,
    eliteChance: undefined
  }))
}

const mergeTraits = (
  waveTraits: EnemyTraitId[] | undefined,
  groupTraits: EnemyTraitId[] | undefined,
  forcedTraitId: EnemyTraitId | undefined,
  knownTraitIds: Set<string>
) => {
  const source = (groupTraits && groupTraits.length > 0 ? groupTraits : waveTraits) ?? []
  const merged = source.filter((trait) => knownTraitIds.has(trait))
  if (forcedTraitId && knownTraitIds.has(forcedTraitId) && !merged.includes(forcedTraitId)) {
    merged.push(forcedTraitId)
  }
  return merged
}

const addExtraSpawnEdge = (
  wave: DayWave,
  map: LevelDefinition['map'],
  runSeed: number,
  nightIndex: number,
  waveIndex: number
): SpawnEdgeConfig[] | undefined => {
  const baseEdges = (wave.spawnEdges && wave.spawnEdges.length > 0
    ? wave.spawnEdges.map((entry) => ({ ...entry }))
    : [{ edge: inferSpawnEdgeFromPoint(map.enemySpawn, { minX: 0, maxX: map.width, minY: 0, maxY: map.height }) }]) as SpawnEdgeConfig[]
  const existing = new Set(baseEdges.map((entry) => entry.edge))
  if (existing.size >= 4) return baseEdges
  const candidates = (['N', 'E', 'S', 'W'] as SpawnEdge[]).filter((edge) => !existing.has(edge))
  const rng = createSeededRng(deriveSeed(runSeed, 'extraSpawnEdge', nightIndex, waveIndex))
  const picked = candidates[rng.nextInt(candidates.length)]
  if (picked) {
    baseEdges.push({ edge: picked })
  }
  return baseEdges
}

export const buildNightPlan = (level: LevelDefinition, run: RunState, waves: DayWave[]): NightPlan => {
  const nightIndex = Math.max(1, Math.floor(run.dayNumber))
  const buffs = getBuffSnapshot(level, run)
  const traitIds = new Set(getEnemyTraitDefs(level).map((entry) => entry.id))
  const eliteConfig = getEliteConfigForLevel(level)
  const announceElite = eliteConfig.announceInIntel
  const forceElite = run.debugOverrides?.forceEliteVariant
  const forceTraitId = run.debugOverrides?.forceEnemyTraitId

  const previewEdges: SpawnEdge[] = []
  const previewEnemyTypes = new Set<string>()
  const previewTraits = new Set<EnemyTraitId>()
  const intel = [] as NightPlan['intel']
  let hasEliteWarning = false

  const nightWaves: NightPlanWave[] = waves.map((wave, waveIndex) => {
    const groups = normalizeWaveGroups(wave)
    const spawnEdges = buffs.addExtraSpawnBorder ? addExtraSpawnEdge(wave, level.map, run.runSeed, nightIndex, waveIndex) : wave.spawnEdges
    const waveSpawns = groups.flatMap((group, groupIndex) => {
      const adjustedCount = Math.max(1, Math.round(group.count * buffs.enemyCountMultiplier))
      const traits = mergeTraits(wave.traits, group.traits, forceTraitId, traitIds)
      traits.forEach((traitId) => previewTraits.add(traitId))
      const eliteChance = Math.max(0, Math.min(1, group.eliteChance ?? wave.eliteChance ?? 0))
      return Array.from({ length: adjustedCount }, (_, groupSpawnIndex) => {
        const spawnIndex = groupSpawnIndex
        const rollSeed = deriveSeed(
          run.runSeed,
          'eliteRoll',
          nightIndex,
          waveIndex,
          groupIndex,
          group.enemyTypeId,
          spawnIndex
        )
        const roll = createSeededRng(rollSeed).nextFloat()
        const isEliteVariant = eliteConfig.enabled
          ? forceElite === true
            ? true
            : forceElite === false
              ? false
              : roll < eliteChance
          : false
        if (isEliteVariant && announceElite) hasEliteWarning = true
        previewEnemyTypes.add(group.enemyTypeId)
        return {
          enemyTypeId: group.enemyTypeId,
          squadSize: group.squadSize,
          traits,
          isEliteVariant,
          eliteRoll: roll
        }
      })
    })

    const waveEdges = ((spawnEdges ?? []) as SpawnEdgeConfig[]).map((entry) => entry.edge)
    waveEdges.forEach((edge) => {
      if (!previewEdges.includes(edge)) previewEdges.push(edge)
    })

    const waveEnemyTypes = Array.from(new Set(waveSpawns.map((spawn) => spawn.enemyTypeId)))
    const waveTraits = Array.from(new Set(waveSpawns.flatMap((spawn) => spawn.traits))).slice(0, 4)
    intel.push({
      id: wave.id,
      spawnEdges: waveEdges,
      enemyTypes: waveEnemyTypes,
      traits: waveTraits,
      hasEliteVariant: announceElite && waveSpawns.some((spawn) => spawn.isEliteVariant)
    })

    return {
      id: wave.id,
      spawnTimeSec: wave.spawnTimeSec,
      spawnEdges,
      spawnPointsPerEdge: wave.spawnPointsPerEdge,
      spawnPadding: wave.spawnPadding,
      spawnSeed: String(deriveSeed(run.runSeed, 'waveSpawn', nightIndex, waveIndex)),
      spawns: waveSpawns,
      legacyEliteId: wave.elite,
      legacyEliteCount: wave.eliteCount
    }
  })

  return {
    nightIndex,
    rewardMultiplierPreview: buffs.rewardMultiplierFromNight,
    spawnEdges: previewEdges,
    enemyTypesDistinct: Array.from(previewEnemyTypes),
    traitIdsDistinct: Array.from(previewTraits),
    hasEliteWarning,
    waves: nightWaves,
    intel
  }
}

const getPerkSelectionCount = (run: RunState) =>
  Object.values(run.perks ?? {}).reduce((sum, entry) => sum + Math.max(0, Math.floor(entry.stacks ?? 0)), 0)

export const getPerkOffersForNight = (level: LevelDefinition, run: RunState, nightIndex: number): PerkDef[] => {
  const defs = getPerkDefs(level)
  const byId = new Map(defs.map((entry) => [entry.id, entry]))
  const maxPerks = Math.max(1, Math.floor(level.perkMaxCount ?? 5))
  const taken = getPerkSelectionCount(run)
  if (taken >= maxPerks) return []

  const poolIds = (level.perkPool && level.perkPool.length > 0 ? level.perkPool : defs.map((entry) => entry.id)).filter((id) => byId.has(id))
  const candidates = poolIds
    .map((id) => byId.get(id)!)
    .filter((def) => {
      const stacks = run.perks?.[def.id]?.stacks ?? 0
      const maxStacks = def.maxStacks ?? 1
      return stacks < maxStacks
    })

  if (candidates.length === 0) return []

  const picksNeeded = Math.max(1, Math.floor(level.perkChoicesPerNight ?? 3))
  const rng = createSeededRng(deriveSeed(run.runSeed, 'perkOffer', nightIndex))
  const forcedPerk = run.debugOverrides?.forcePerkId
    ? candidates.find((entry) => entry.id === run.debugOverrides?.forcePerkId)
    : undefined

  const baseCandidates = forcedPerk ? candidates.filter((entry) => entry.id !== forcedPerk.id) : candidates
  const picks = pickWithoutReplacement(baseCandidates, picksNeeded - (forcedPerk ? 1 : 0), rng)
  const offers = forcedPerk ? [forcedPerk, ...picks] : picks

  if (offers.length >= picksNeeded) return offers.slice(0, picksNeeded)

  const stackable = candidates.filter((entry) => (entry.maxStacks ?? 1) > 1)
  while (offers.length < picksNeeded && stackable.length > 0) {
    const next = stackable[rng.nextInt(stackable.length)]
    offers.push(next)
  }

  return offers.slice(0, picksNeeded)
}
