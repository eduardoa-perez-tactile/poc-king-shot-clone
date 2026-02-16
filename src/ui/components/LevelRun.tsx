import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BuildingId, BUILDING_DEFS } from '../../config/buildings'
import { ELITE_DEFS } from '../../config/elites'
import { HERO_RECRUIT_DEFS, HeroRecruitId } from '../../config/heroes'
import { ENEMY_TRAIT_ICON_LABELS, NightModifierId, PerkId } from '../../config/nightContent'
import { getLevelById, LevelDefinition } from '../../config/levels'
import { UnitType, UNIT_DEFS } from '../../config/units'
import { getHQBonusHp, getIncomeBreakdown, getSquadCap, getUnitCost, getUnitPurchaseCap } from '../../run/economy'
import { getEnemyTraitDefs, getPerkDefs, getPerkOffersForNight, getAllowedNightModifiersForNight, getNightModifierDefs } from '../../run/nightSystems'
import {
  canBuySquadFromBuilding,
  getBuildingUpgradeCostForRun,
  getBuildingLevelCapForStrongholdLevel,
  getBuildingUnlockLevelForLevel,
  getPadUnlockLevelForRunLevel,
  getStrongholdMaxLevelForLevel,
  getStrongholdUnlockDeltaForRun,
  getStrongholdUpgradeCostForLevel,
  getUnlockedBuildingTypesForRunLevel,
  isBuildingUnlockedAtStrongholdForLevel
} from '../../run/runState'
import { useRunStore } from '../../run/store'
import { buildCombatDefinition } from '../../rts/combat'
import { hitTestPad } from '../../rts/pads'
import { CanvasLayer } from './CanvasLayer'
import type { CanvasHandle, CanvasTelemetry } from './CanvasLayer'
import { AppShell } from './hud/AppShell'
import { TopBar } from './hud/TopBar'
import { Panel } from './hud/Panel'
import { NextBattleIntelPanel, type NextBattleIntelEntry, type NextBattleIntelWaveEntry } from './hud/NextBattleIntelPanel'
import { EntityCard } from './hud/EntityCard'
import { BuildOptionCard } from './hud/BuildOptionCard'
import { AbilityButton } from './hud/AbilityButton'
import { DayEndModal } from './hud/DayEndModal'
import { NightSetupModal } from './hud/NightSetupModal'
import { PerkChoiceModal } from './hud/PerkChoiceModal'
import { NightDebugPanel } from './hud/NightDebugPanel'
import { Toasts } from './hud/Toasts'
import { SettingsDialog } from './hud/SettingsDialog'
import { MiniMap } from './hud/MiniMap'
import { Button } from './ui/Button'
import { Tooltip } from './ui/Tooltip'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { uiActions, useUiStore } from '../store/uiStore'
import type { SelectionInfo } from '../store/uiStore'
import { TutorialOverlay } from '../TutorialOverlay'
import { useMotionSettings } from '../hooks/useMotionSettings'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, AlertTriangle, ArrowUp, Building2, Crosshair, Grid3x3, Swords } from 'lucide-react'
import { getStrongholdHqBaseHp } from '../../config/stronghold'
import { isBuildingAllowedOnPad, isUnitProducerBuilding } from '../../game/rules/progression'
import type { CombatResult } from '../../rts/types'
import { TutorialManager } from '../../tutorial/TutorialManager'
import { emitTutorialEvent } from '../../tutorial/tutorialEventBus'
import { isTutorialCompleted } from '../../tutorial/tutorialProgress'
import type { TutorialManagerSnapshot, TutorialScript, TutorialWorldAnchor } from '../../tutorial/tutorialTypes'

const SQUAD_SPAWN_OFFSETS = [
  { x: -90, y: -70 },
  { x: 0, y: -80 },
  { x: 90, y: -70 },
  { x: -110, y: 0 },
  { x: 110, y: 0 },
  { x: -90, y: 70 },
  { x: 0, y: 80 },
  { x: 90, y: 70 }
]
const DAY_END_TO_PERK_TRANSITION_MS = 180

const describeEffects = (id: BuildingId) => {
  const def = BUILDING_DEFS[id]
  const parts: string[] = []
  if (def.income) parts.push(`Income +${def.income.base}/day`)
  if (def.unlocksUnit) parts.push(`Unlocks ${UNIT_DEFS[def.unlocksUnit].name}`)
  if (def.bonuses?.squadCapPerLevel) parts.push(`Squad cap +${def.bonuses.squadCapPerLevel} per level`)
  if (def.bonuses?.hqHpPerLevel) parts.push(`HQ +${def.bonuses.hqHpPerLevel} HP per level`)
  if (def.bonuses?.unitAttackPctPerLevel) parts.push('Squad stats scale with upgrades')
  if (def.heroRecruiter) parts.push(`Summon ${def.heroRecruiter.summonLimit} hero`)
  return parts.join(' · ')
}

const describeLevelEffects = (id: BuildingId, level: number) => {
  const def = BUILDING_DEFS[id]
  const parts: string[] = []
  if (def.income) {
    const amount = def.income.base + def.income.perLevel * (level - 1)
    parts.push(`Income +${amount}/day`)
  }
  if (def.bonuses?.squadCapPerLevel) parts.push(`Squad cap +${def.bonuses.squadCapPerLevel * level}`)
  if (def.bonuses?.hqHpPerLevel) parts.push(`HQ +${def.bonuses.hqHpPerLevel * level} HP`)
  if (def.bonuses?.unitAttackPctPerLevel) parts.push('Squad stats improved')
  return parts.join(' · ')
}

export const LevelRun: React.FC<{
  onExit: () => void
  onBackToDashboard?: () => void
  tutorialReplay?: boolean
  onTutorialSkip?: () => void
}> = ({ onExit, onBackToDashboard, tutorialReplay = false, onTutorialSkip }) => {
  const {
    activeRun,
    runPhase,
    buyBuilding,
    upgradeBuilding,
    buySquad,
    summonHero,
    upgradeStronghold,
    startCombatWithNightModifier,
    resolveCombat,
    selectPerk,
    rerollRunSeed,
    setDebugOverrides,
    startNewDay
  } = useRunStore()

  const selection = useUiStore((state) => state.selection)
  const selectedPadId = useUiStore((state) => state.selectedPadId)
  const panelOpen = useUiStore((state) => state.panelOpen)
  const pauseOpen = useUiStore((state) => state.pauseOpen)
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const showUnitLabels = useUiStore((state) => state.settings.showUnitLabels)
  const reduceMotion = useMotionSettings()

  const [telemetry, setTelemetry] = useState<CanvasTelemetry | null>(null)
  const [eliteWarnings, setEliteWarnings] = useState<Array<{ id: string; message: string }>>([])
  const [intelOpen, setIntelOpen] = useState(false)
  const [nightSetupOpen, setNightSetupOpen] = useState(false)
  const [resolvedPerkDay, setResolvedPerkDay] = useState<number | null>(null)
  const [perkModalStage, setPerkModalStage] = useState<'idle' | 'handoff' | 'open'>('idle')
  const perkHandoffTimeoutRef = useRef<number | null>(null)
  const canvasRef = useRef<CanvasHandle | null>(null)
  const isMobile = useMediaQuery('(max-width: 639px)')

  if (!activeRun) return null
  const level = getLevelById(activeRun.levelId)
  if (!level) return null
  const tutorialScript = (level as LevelDefinition & { tutorialScript?: TutorialScript }).tutorialScript
  const tutorialShouldRun = Boolean(tutorialScript) && (tutorialReplay || !isTutorialCompleted())
  const tutorialManager = useMemo(
    () => (tutorialShouldRun && tutorialScript ? new TutorialManager(tutorialScript, { initialPhase: 'build' }) : null),
    [tutorialScript, tutorialShouldRun]
  )
  const [tutorialSnapshot, setTutorialSnapshot] = useState<TutorialManagerSnapshot | null>(null)

  const combatDefinition = useMemo(() => buildCombatDefinition(activeRun), [activeRun])
  const nextBattlePreview = combatDefinition.nextBattlePreview
  const nightModifierDefs = useMemo(() => getNightModifierDefs(level), [level])
  const allowedNightModifiers = useMemo(
    () => getAllowedNightModifiersForNight(level, activeRun.dayNumber),
    [activeRun.dayNumber, level]
  )
  const perkDefs = useMemo(() => getPerkDefs(level), [level])
  const perkMaxCount = level.perkMaxCount ?? 5
  const perkCount = useMemo(
    () => Object.values(activeRun.perks).reduce((sum, entry) => sum + Math.max(0, entry.stacks ?? 0), 0),
    [activeRun.perks]
  )
  const perkOffers = useMemo(
    () => getPerkOffersForNight(level, activeRun, activeRun.dayNumber),
    [activeRun, level]
  )
  const squadCap = getSquadCap(activeRun)
  const dayIncome = activeRun.lastIncome ?? getIncomeBreakdown(activeRun, 0)
  const strongholdLevel = activeRun.strongholdLevel
  const strongholdMaxLevel = getStrongholdMaxLevelForLevel(level)
  const strongholdUpgradeCost = getStrongholdUpgradeCostForLevel(level, strongholdLevel)
  const unlockedBuildingTypes = getUnlockedBuildingTypesForRunLevel(level, strongholdLevel)
  const strongholdSummary =
    unlockedBuildingTypes.length > 0
      ? `Unlocked: ${unlockedBuildingTypes.map((id) => BUILDING_DEFS[id].name).join(', ')} · Max Lv${getBuildingLevelCapForStrongholdLevel(level, strongholdLevel, 'gold_mine')}`
      : `Stronghold Lv${strongholdLevel}`
  const traitDefs = useMemo(() => getEnemyTraitDefs(level), [level])
  const traitNameById = useMemo(
    () => new Map(traitDefs.map((entry) => [entry.id, ENEMY_TRAIT_ICON_LABELS[entry.id] ?? entry.name])),
    [traitDefs]
  )

  const intelEntries = useMemo<NextBattleIntelEntry[]>(() => {
    const ids = nextBattlePreview?.previewEnemyTypesDistinct ?? []
    return ids
      .map((id) => {
        const unit = UNIT_DEFS[id as UnitType]
        if (unit) {
          return {
            id,
            name: unit.name,
            trait: unit.description,
            kind: 'unit' as const
          }
        }
        const elite = ELITE_DEFS[id as keyof typeof ELITE_DEFS]
        if (elite) {
          return {
            id,
            name: elite.name,
            trait: 'Elite archetype with high durability and burst threat.',
            kind: 'elite' as const
          }
        }
        const catalog = level.enemies.catalog.find((entry) => entry.id === id)
        if (!catalog) return null
        return {
          id,
          name: catalog.name,
          trait: catalog.kind === 'elite' ? 'Elite threat.' : 'Enemy unit archetype.',
          kind: catalog.kind
        }
      })
      .filter((entry): entry is NextBattleIntelEntry => Boolean(entry))
  }, [level.enemies.catalog, nextBattlePreview?.previewEnemyTypesDistinct])

  const intelWaveEntries = useMemo<NextBattleIntelWaveEntry[]>(() => {
    const waves = nextBattlePreview?.previewWaves ?? []
    return waves.map((wave) => ({
      id: wave.id,
      spawnEdges: wave.spawnEdges,
      enemyNames: wave.enemyTypes.map((id) => UNIT_DEFS[id as UnitType]?.name ?? ELITE_DEFS[id as keyof typeof ELITE_DEFS]?.name ?? id),
      traitLabels: wave.traitIds.map((id) => traitNameById.get(id) ?? id),
      hasEliteVariant: (combatDefinition.eliteConfig?.announceInIntel ?? true) ? wave.hasEliteVariant : false
    }))
  }, [combatDefinition.eliteConfig?.announceInIntel, nextBattlePreview?.previewWaves, traitNameById])

  const summaryEnemyTypes = useMemo(() => {
    const ids = nextBattlePreview?.previewEnemyTypesDistinct ?? []
    return Array.from(
      new Set(
        ids
          .map((id) => {
            const unit = UNIT_DEFS[id as UnitType]
            if (unit) return unit.name
            const elite = ELITE_DEFS[id as keyof typeof ELITE_DEFS]
            if (elite) return elite.name
            return level.enemies.catalog.find((entry) => entry.id === id)?.name ?? id
          })
          .filter((name) => Boolean(name))
      )
    )
  }, [level.enemies.catalog, nextBattlePreview?.previewEnemyTypesDistinct])

  const perkChoicePending =
    runPhase === 'day_end' &&
    perkOffers.length > 0 &&
    perkCount < perkMaxCount &&
    resolvedPerkDay !== activeRun.dayNumber
  const dayEndModalVisible = runPhase === 'day_end' && (perkModalStage === 'idle' || !perkChoicePending)
  const perkModalVisible = perkChoicePending && perkModalStage === 'open'

  const buildingByPad = useMemo(() => {
    return new Map(
      activeRun.buildings
        .filter((building) => !(building.id === 'wall' && building.hp <= 0))
        .map((building) => [building.padId, building])
    )
  }, [activeRun.buildings])

  const activePad = selectedPadId ? level.buildingPads.find((pad) => pad.id === selectedPadId) ?? null : null
  const activeBuilding = activePad ? buildingByPad.get(activePad.id) ?? null : null
  const padUnlockLevels = useMemo(() => {
    const mapping: Record<string, number> = {}
    level.buildingPads.forEach((pad) => {
      mapping[pad.id] = getPadUnlockLevelForRunLevel(level, pad.id)
    })
    return mapping
  }, [level])

  useEffect(() => {
    if (isMobile) {
      uiActions.setPanelOpen(false)
    } else {
      uiActions.setPanelOpen(true)
    }
  }, [isMobile])

  useEffect(() => {
    if (runPhase !== 'build') {
      uiActions.setSelectedPad(null)
    }
  }, [runPhase])

  useEffect(() => {
    if (runPhase !== 'build') {
      setIntelOpen(false)
      setNightSetupOpen(false)
    }
  }, [runPhase])

  useEffect(() => {
    if (runPhase !== 'day_end') {
      setResolvedPerkDay(null)
    }
  }, [runPhase])

  useEffect(() => {
    setResolvedPerkDay(null)
  }, [activeRun.dayNumber])

  useEffect(() => {
    if (runPhase !== 'day_end') {
      if (perkHandoffTimeoutRef.current) {
        window.clearTimeout(perkHandoffTimeoutRef.current)
        perkHandoffTimeoutRef.current = null
      }
      setPerkModalStage('idle')
      return
    }
    if (!perkChoicePending) {
      if (perkHandoffTimeoutRef.current) {
        window.clearTimeout(perkHandoffTimeoutRef.current)
        perkHandoffTimeoutRef.current = null
      }
      setPerkModalStage('idle')
    }
  }, [perkChoicePending, runPhase])

  useEffect(() => () => {
    if (perkHandoffTimeoutRef.current) {
      window.clearTimeout(perkHandoffTimeoutRef.current)
      perkHandoffTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!tutorialManager) {
      setTutorialSnapshot(null)
      return
    }
    const unsubscribe = tutorialManager.subscribe((next) => {
      setTutorialSnapshot(next)
    })
    return () => {
      unsubscribe()
      tutorialManager.dispose()
    }
  }, [tutorialManager])

  useEffect(() => {
    emitTutorialEvent('PHASE_CHANGED', { phase: runPhase })
  }, [runPhase])

  const addToast = useCallback((message: string, variant: 'default' | 'danger' | 'success' = 'default') => {
    uiActions.pushToast({ message, variant, duration: 2400 })
  }, [])

  const handlePadClick = useCallback((padId: string) => {
    if (runPhase !== 'build') {
      addToast('Build disabled during combat.', 'danger')
      return
    }
    uiActions.setSelectedPad(padId)
    uiActions.setPanelOpen(true)
    emitTutorialEvent('PAD_SELECTED', { padId })
  }, [addToast, runPhase])

  const handleBuild = (padId: string, buildingId: BuildingId) => {
    const pad = level.buildingPads.find((entry) => entry.id === padId)
    if (!pad) return
    const padUnlock = getPadUnlockLevelForRunLevel(level, padId)
    if (strongholdLevel < padUnlock) {
      addToast(`Unlock this pad at Stronghold Lv${padUnlock}.`, 'danger')
      return
    }
    if (!isBuildingAllowedOnPad(pad, buildingId)) {
      addToast(`${BUILDING_DEFS[buildingId].name} is not allowed on this pad type.`, 'danger')
      return
    }
    if (!isBuildingUnlockedAtStrongholdForLevel(level, strongholdLevel, buildingId)) {
      addToast(
        `Unlock ${BUILDING_DEFS[buildingId].name} at Stronghold Lv${getBuildingUnlockLevelForLevel(level, buildingId)}.`,
        'danger'
      )
      return
    }
    const cost = BUILDING_DEFS[buildingId].baseCost
    if (activeRun.gold < cost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    buyBuilding(buildingId, padId)
    emitTutorialEvent('BUILDING_BUILT', { padId, buildingType: buildingId })
    if (buildingId === 'watchtower') {
      emitTutorialEvent('TOWER_PLACED', { padId })
    }
    if (buildingId === 'wall') {
      emitTutorialEvent('WALL_PLACED', { padId })
    }
    uiActions.setSelectedPad(padId)
  }

  const handleUpgrade = (padId: string) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const cap = getBuildingLevelCapForStrongholdLevel(level, strongholdLevel, building.id)
    if (building.level >= cap) {
      addToast(
        building.id === 'watchtower'
          ? 'Upgrade locked: upgrade Stronghold to increase tower level cap'
          : 'Upgrade Stronghold to increase cap.',
        'default'
      )
      return
    }
    const cost = getBuildingUpgradeCostForRun(activeRun, padId, level)
    if (activeRun.gold < cost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    upgradeBuilding(padId)
    emitTutorialEvent('BUILDING_UPGRADED', { padId, buildingId: building.id, level: building.level + 1 })
    if (building.id === 'watchtower') {
      emitTutorialEvent('TOWER_UPGRADED', { padId, level: building.level + 1 })
    }
  }

  const findSpawnPosition = useCallback((padId: string) => {
    const pad = level.buildingPads.find((entry) => entry.id === padId)
    if (!pad) return null
    const hq = level.map.playerHQ
    const hqRect = {
      x: hq.x - 36,
      y: hq.y - 24,
      w: 72,
      h: 48
    }
    const used = [
      ...activeRun.unitRoster.filter((squad) => squad.spawnPadId === padId && squad.spawnPos).map((squad) => squad.spawnPos!),
      ...activeRun.heroRoster.filter((hero) => hero.spawnPadId === padId && hero.spawnPos).map((hero) => hero.spawnPos!)
    ]
    const next = SQUAD_SPAWN_OFFSETS.find((offset) => {
      const candidate = { x: pad.x + offset.x, y: pad.y + offset.y }
      if (level.buildingPads.some((entry) => hitTestPad(entry, candidate))) return false
      if (
        candidate.x >= hqRect.x &&
        candidate.x <= hqRect.x + hqRect.w &&
        candidate.y >= hqRect.y &&
        candidate.y <= hqRect.y + hqRect.h
      ) {
        return false
      }
      return !used.some((pos) => Math.hypot(pos.x - candidate.x, pos.y - candidate.y) < 10)
    })
    if (!next) return null
    return { x: pad.x + next.x, y: pad.y + next.y }
  }, [activeRun.heroRoster, activeRun.unitRoster, level.buildingPads, level.map.playerHQ])

  const handleRecruit = (padId: string) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const def = BUILDING_DEFS[building.id]
    if (!def.unlocksUnit) return
    if (isUnitProducerBuilding(building.id)) {
      addToast('Barracks and Range auto-spawn squads on build/upgrade.', 'default')
      return
    }
    const purchaseCap = getUnitPurchaseCap(activeRun)
    const purchased = building.purchasedUnitsCount ?? 0
    const unitCost = getUnitCost(def.unlocksUnit)
    if (purchased >= purchaseCap) {
      addToast('Unit limit reached. Upgrade Stronghold to increase cap.', 'danger')
      return
    }
    if (!canBuySquadFromBuilding(activeRun, def.unlocksUnit, padId)) {
      addToast('Squad cap reached or insufficient gold.', 'danger')
      return
    }
    if (activeRun.gold < unitCost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    const spawnPos = findSpawnPosition(padId)
    if (!spawnPos) {
      addToast('No space near this building.', 'danger')
      return
    }
    buySquad(def.unlocksUnit, spawnPos, padId)
  }

  const handleSummonHero = (padId: string, heroId: HeroRecruitId) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const def = BUILDING_DEFS[building.id]
    if (!def.heroRecruiter) return
    const heroDef = HERO_RECRUIT_DEFS[heroId]
    if (!heroDef) return
    const used = building.heroSummonUsed ?? 0
    if (used >= def.heroRecruiter.summonLimit) {
      addToast('Summon already used for this recruiter.', 'danger')
      return
    }
    if (activeRun.gold < heroDef.cost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    const spawnPos = findSpawnPosition(padId)
    if (!spawnPos) {
      addToast('No space near this building.', 'danger')
      return
    }
    summonHero(heroId, spawnPos, padId)
  }

  const objective = level.goals[0]?.label ?? level.description
  const waveLabel =
    runPhase === 'combat' && telemetry
      ? `Wave ${Math.min(telemetry.waveIndex + 1, telemetry.waveCount)}/${telemetry.waveCount}`
      : undefined

  const inputBlocked =
    runPhase === 'day_end' ||
    runPhase === 'battle_cry' ||
    settingsOpen ||
    pauseOpen ||
    nightSetupOpen ||
    perkChoicePending ||
    Boolean(tutorialSnapshot?.blockInput)

  const spawnIndicatorEventKeyRef = useRef<string | null>(null)
  const summaryOpenEventKeyRef = useRef<string | null>(null)
  const summaryEnemyTypesEventKeyRef = useRef<string | null>(null)
  const tutorialCompletionToastRef = useRef(false)

  useEffect(() => {
    if (runPhase !== 'build') return
    const borders = nextBattlePreview?.previewEdges ?? []
    if (borders.length === 0) return
    const key = `${activeRun.dayNumber}:${borders.join(',')}`
    if (spawnIndicatorEventKeyRef.current === key) return
    spawnIndicatorEventKeyRef.current = key
    emitTutorialEvent('WAVE_SPAWN_INDICATOR_SHOWN', { borders })
  }, [activeRun.dayNumber, nextBattlePreview?.previewEdges, runPhase])

  useEffect(() => {
    if (!nightSetupOpen) return
    // Fallback trigger: if the player opened Night Setup via the battle button,
    // mark the battle cry intent even if the click event was missed.
    emitTutorialEvent('UI_BATTLE_CRY_CLICKED', {})
  }, [nightSetupOpen])

  useEffect(() => {
    if (!dayEndModalVisible) return
    const key = `summary:${activeRun.dayNumber}`
    if (summaryOpenEventKeyRef.current !== key) {
      summaryOpenEventKeyRef.current = key
      emitTutorialEvent('DAY_SUMMARY_OPENED', { dayNumber: activeRun.dayNumber })
    }
  }, [activeRun.dayNumber, dayEndModalVisible])

  useEffect(() => {
    if (!dayEndModalVisible || summaryEnemyTypes.length === 0) return
    const key = `next:${activeRun.dayNumber}:${summaryEnemyTypes.join(',')}`
    if (summaryEnemyTypesEventKeyRef.current === key) return
    summaryEnemyTypesEventKeyRef.current = key
    emitTutorialEvent('NEXT_WAVE_ENEMY_TYPES_SHOWN', { enemyTypes: summaryEnemyTypes })
  }, [activeRun.dayNumber, dayEndModalVisible, summaryEnemyTypes])

  useEffect(() => {
    if (!tutorialSnapshot?.completed || tutorialCompletionToastRef.current) return
    tutorialCompletionToastRef.current = true
    addToast('Tutorial completed. You can replay it from Missions.', 'success')
  }, [addToast, tutorialSnapshot?.completed])

  const goal = level.goals[0]
  const goalProgressRaw = goal ? activeRun.goalsProgress[goal.id] : 0
  const progressValue =
    typeof goalProgressRaw === 'boolean' ? (goalProgressRaw ? 1 : 0) : Number(goalProgressRaw || 0)
  const progressTarget = goal ? (typeof goalProgressRaw === 'boolean' ? 1 : goal.target) : 1

  const renderPanelContent = () => {
    if (activePad) {
      if (activeBuilding) {
        const def = BUILDING_DEFS[activeBuilding.id]
        const strongholdCap = getBuildingLevelCapForStrongholdLevel(level, strongholdLevel, activeBuilding.id)
        const isMax = activeBuilding.level >= strongholdCap
        const capLockedMessage =
          activeBuilding.id === 'watchtower'
            ? 'Upgrade locked: upgrade Stronghold to increase tower level cap'
            : 'Upgrade Stronghold or level caps to increase this building.'
        const nextLevel = Math.min(activeBuilding.level + 1, strongholdCap)
        const nextEffects = isMax
          ? capLockedMessage
          : describeLevelEffects(activeBuilding.id, nextLevel) || 'No bonuses.'
        const upgradeCostValue = isMax ? 0 : getBuildingUpgradeCostForRun(activeRun, activePad.id, level)
        const upgradeCostLabel = isMax ? 'Max' : `${upgradeCostValue} gold`
        const upgradeDisabled = runPhase !== 'build' || isMax || activeRun.gold < upgradeCostValue
        const upgradeTooltip = isMax
          ? capLockedMessage
          : runPhase !== 'build'
            ? 'Upgrade available during Build Phase.'
            : activeRun.gold < upgradeCostValue
              ? `Need ${upgradeCostValue - activeRun.gold} more gold.`
              : 'Upgrade building.'

        const unitType = def.unlocksUnit
        const unitDef = unitType ? UNIT_DEFS[unitType] : null
        const unitCost = unitDef ? getUnitCost(unitType as UnitType) : 0
        const purchaseCap = getUnitPurchaseCap(activeRun)
        const purchased = activeBuilding.purchasedUnitsCount ?? 0
        const purchaseLimitReached = purchased >= purchaseCap
        const squadCapReached = activeRun.unitRoster.length >= squadCap
        const recruitDisabled =
          runPhase !== 'build' ||
          purchaseLimitReached ||
          squadCapReached ||
          activeRun.gold < unitCost ||
          !unitType
        const recruitTooltip = purchaseLimitReached
          ? 'Increase cap by upgrading Stronghold.'
          : runPhase !== 'build'
            ? 'Recruit available during Build Phase.'
            : squadCapReached
              ? 'Squad cap reached.'
              : activeRun.gold < unitCost
                ? `Need ${unitCost - activeRun.gold} more gold.`
                : 'Recruit squad.'

        return (
          <div className="space-y-3">
            <EntityCard
              title={`${def.name} · Lv ${activeBuilding.level}`}
              description={describeLevelEffects(activeBuilding.id, activeBuilding.level) || 'No bonuses.'}
              meta={
                <div className="space-y-2 text-xs text-muted">
                  <div>Next Level: {nextEffects}</div>
                  <div>Upgrade Cost: {upgradeCostLabel}</div>
                </div>
              }
              actions={
                <Tooltip content={upgradeTooltip}>
                  <span>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={upgradeDisabled}
                      onClick={() => handleUpgrade(activeBuilding.padId)}
                    >
                      Upgrade
                    </Button>
                  </span>
                </Tooltip>
              }
            />

            {unitDef && !isUnitProducerBuilding(activeBuilding.id) && (
              <div className="rounded-2xl border border-white/10 bg-surface p-3">
                <div className="text-xs font-semibold text-text">Unit Shop</div>
                <div className="mt-2 flex items-center justify-between text-sm text-text">
                  <span>{unitDef.name} Squad</span>
                  <span>{unitCost} gold</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>HP {Math.round(unitDef.stats.hp * unitDef.squadSize)}</div>
                  <div>DMG {Math.round(unitDef.stats.attack * unitDef.squadSize)}</div>
                  <div>Range {Math.round(unitDef.stats.range)}</div>
                  <div>Cooldown {unitDef.stats.cooldown}s</div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>Units bought: {purchased} / {purchaseCap}</span>
                  <Tooltip content={recruitTooltip}>
                    <span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={recruitDisabled}
                        onClick={() => handleRecruit(activeBuilding.padId)}
                      >
                        Recruit
                      </Button>
                    </span>
                  </Tooltip>
                </div>
                {purchaseLimitReached && (
                  <div className="mt-1 text-[11px] text-muted">Increase cap by upgrading Stronghold.</div>
                )}
              </div>
            )}

            {unitDef && isUnitProducerBuilding(activeBuilding.id) && (
              <div className="rounded-2xl border border-white/10 bg-surface p-3">
                <div className="text-xs font-semibold text-text">Auto-Producer</div>
                <div className="mt-1 text-xs text-muted">
                  On build: +{Math.max(0, Math.floor(level.producerDefaults.unitsOnBuild))} squads
                </div>
                <div className="text-xs text-muted">
                  On upgrade: +{Math.max(0, Math.floor(level.producerDefaults.unitsPerUpgradeLevel))} squads per level
                </div>
                <div className="mt-2 text-xs text-muted">
                  Owned squads: {activeRun.unitRoster.filter((squad) => squad.ownerBuildingPadId === activeBuilding.padId).length}
                </div>
              </div>
            )}

            {def.heroRecruiter && (
              <div className="rounded-2xl border border-white/10 bg-surface p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-text">
                  <span>Hero Summons</span>
                  <span className="text-muted">Summon used: {activeBuilding.heroSummonUsed ?? 0}/{def.heroRecruiter.summonLimit}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {Object.values(HERO_RECRUIT_DEFS).map((hero) => {
                    const summonDisabled =
                      runPhase !== 'build' ||
                      (activeBuilding.heroSummonUsed ?? 0) >= def.heroRecruiter!.summonLimit ||
                      activeRun.gold < hero.cost
                    const summonTooltip =
                      (activeBuilding.heroSummonUsed ?? 0) >= def.heroRecruiter!.summonLimit
                        ? 'Summon already used.'
                        : runPhase !== 'build'
                          ? 'Summon available during Build Phase.'
                          : activeRun.gold < hero.cost
                            ? `Need ${hero.cost - activeRun.gold} more gold.`
                            : 'Summon hero.'
                    return (
                      <div key={hero.id} className="rounded-xl border border-white/10 bg-slate-950 p-3">
                        <div className="flex items-center justify-between text-sm text-text">
                          <span>{hero.name}</span>
                          <span>{hero.cost} gold</span>
                        </div>
                        <div className="mt-1 text-xs text-muted">{hero.description}</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted">
                          <div>HP {Math.round(hero.stats.hp)}</div>
                          <div>DMG {Math.round(hero.stats.attack)}</div>
                          <div>Range {Math.round(hero.stats.range)}</div>
                          <div>Cooldown {hero.stats.cooldown}s</div>
                        </div>
                        <div className="mt-2">
                          <Tooltip content={summonTooltip}>
                            <span>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={summonDisabled}
                                onClick={() => handleSummonHero(activeBuilding.padId, hero.id)}
                              >
                                Summon
                              </Button>
                            </span>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      }
      return (
        <div className="grid gap-3">
          {activePad.allowedTypes.filter((id) => isBuildingAllowedOnPad(activePad, id)).map((id) => {
            const cost = BUILDING_DEFS[id].baseCost
            const canAfford = activeRun.gold >= cost
            const padUnlock = padUnlockLevels[activePad.id] ?? 1
            const isPadUnlocked = strongholdLevel >= padUnlock
            const isUnlocked = isBuildingUnlockedAtStrongholdForLevel(level, strongholdLevel, id)
            const unlockLevel = getBuildingUnlockLevelForLevel(level, id)
            const isLocked = !isPadUnlocked || !isUnlocked
            const lockedReason = !isPadUnlocked
              ? `Unlock this pad at Stronghold Lv${padUnlock}`
              : `Unlock by upgrading Stronghold to Lv${unlockLevel}`
            return (
              <BuildOptionCard
                key={id}
                title={BUILDING_DEFS[id].name}
                description={describeEffects(id)}
                cost={cost}
                canAfford={canAfford && runPhase === 'build' && !isLocked}
                locked={isLocked}
                lockedReason={lockedReason}
                testId={`build-option-${id}`}
                onBuild={() => handleBuild(activePad.id, id)}
              />
            )
          })}
        </div>
      )
    }

    if (selection.kind === 'stronghold') {
      const maxHp = getStrongholdHqBaseHp(strongholdLevel) + getHQBonusHp(activeRun)
      const currentHp = runPhase === 'combat' && telemetry ? telemetry.hqHp : maxHp
      const currentMaxHp = runPhase === 'combat' && telemetry ? telemetry.hqMaxHp : maxHp
      const cap = getBuildingLevelCapForStrongholdLevel(level, strongholdLevel, 'gold_mine')
      const unlocks = unlockedBuildingTypes.map((id) => BUILDING_DEFS[id].name)
      const nextUnlock = getStrongholdUnlockDeltaForRun(activeRun, level)
      const nextLevel = Math.min(strongholdLevel + 1, strongholdMaxLevel)
      const nextBuildings = nextUnlock.buildingTypes.map((id) => BUILDING_DEFS[id].name)
      const nextPads = nextUnlock.padIds
      const atMax = strongholdLevel >= strongholdMaxLevel
      const upgradeDisabled = atMax || activeRun.gold < strongholdUpgradeCost || runPhase !== 'build'
      const upgradeLabel = atMax ? 'Max Level' : `Upgrade (${strongholdUpgradeCost} gold)`
      const upgradeTooltip = atMax
        ? 'Stronghold already at max level.'
        : runPhase !== 'build'
          ? 'Upgrade available during Build Phase.'
          : activeRun.gold < strongholdUpgradeCost
            ? `Need ${strongholdUpgradeCost - activeRun.gold} more gold.`
            : 'Upgrade Stronghold.'
      return (
        <EntityCard
          title={`Stronghold · Lv ${strongholdLevel}`}
          description="The Stronghold anchors your defenses and gates new construction."
          hp={{ value: currentHp, max: currentMaxHp }}
          meta={
            <div className="space-y-2 text-xs text-muted">
              <div>Unlocked Buildings: {unlocks.length > 0 ? unlocks.join(', ') : 'None'}</div>
              <div>Building Cap: Lv {cap}</div>
              {!atMax && (
                <div className="space-y-1">
                  <div>Next Level: Lv {nextLevel}</div>
                  <div className="space-y-1">
                    {nextBuildings.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-accent" />
                        <span>New Buildings: {nextBuildings.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-3.5 w-3.5 text-accent" />
                      <span>Max Building Cap: Lv {nextUnlock.maxBuildingCap}</span>
                    </div>
                    {nextPads.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Grid3x3 className="h-3.5 w-3.5 text-accent" />
                        <span>New Pads: {nextPads.map((pad) => pad.toUpperCase()).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          }
          actions={
            <Tooltip content={upgradeTooltip}>
              <span>
                <Button variant="primary" size="sm" disabled={upgradeDisabled} onClick={handleStrongholdUpgrade}>
                  {upgradeLabel}
                </Button>
              </span>
            </Tooltip>
          }
        />
      )
    }

    if (selection.kind === 'hero') {
      const attack = selection.attack ?? combatDefinition.hero.stats.attack
      const range = selection.range ?? combatDefinition.hero.stats.range
      const speed = selection.speed ?? combatDefinition.hero.stats.speed
      const cooldown = selection.cooldown ?? combatDefinition.hero.stats.cooldown
      return (
        <EntityCard
          title={selection.name}
          subtitle="Hero"
          description={selection.description}
          hp={{ value: selection.hp, max: selection.maxHp }}
          meta={
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div className="flex items-center gap-2"><Swords className="h-3 w-3 text-accent" /> Attack {Math.round(attack)}</div>
              <div className="flex items-center gap-2"><Crosshair className="h-3 w-3 text-accent" /> Range {Math.round(range)}</div>
              <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-accent" /> Speed {Math.round(speed)}</div>
              <div className="flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-accent" /> Cooldown {cooldown}s</div>
            </div>
          }
        />
      )
    }

    if (selection.kind === 'unit') {
      return (
        <EntityCard
          title={selection.name}
          subtitle="Squad"
          description={selection.description}
          hp={{ value: selection.hp, max: selection.maxHp }}
        />
      )
    }

    if (selection.kind === 'multi') {
      return (
        <div className="space-y-3">
          <div className="text-xs text-muted">Selected {selection.units.length} squads</div>
          <div className="space-y-2">
            {selection.units.map((unit) => (
              <div key={unit.id} className="rounded-2xl border border-white/10 bg-surface px-3 py-2">
                <div className="flex items-center justify-between text-xs text-text">
                  <span>{unit.name}</span>
                  <span>{Math.round(unit.hp)}/{Math.round(unit.maxHp)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3 text-xs text-muted">
        <div className="rounded-2xl border border-white/10 bg-surface px-3 py-2">
          {objective}
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface px-3 py-2">
          {isMobile ? 'Tap pads to build. Select squads to command.' : 'Hover pads to build. Select squads to issue orders.'}
        </div>
      </div>
    )
  }

  const handleSelectionChange = useCallback((next: SelectionInfo) => {
    uiActions.setSelection(next)
    if (next.kind !== 'none') uiActions.setSelectedPad(null)
    if (next.kind === 'stronghold') {
      emitTutorialEvent('STRONGHOLD_SELECTED', {})
    }
  }, [])

  const handleTelemetry = useCallback((data: CanvasTelemetry) => {
    setTelemetry(data)
  }, [])

  const handleEliteWarning = useCallback((message: string) => {
    const id = `warn_${Date.now()}_${Math.random()}`
    setEliteWarnings((prev) => [...prev, { id, message }])
    window.setTimeout(() => {
      setEliteWarnings((prev) => prev.filter((entry) => entry.id !== id))
    }, 1800)
  }, [])

  const handlePadBlocked = useCallback(() => {
    addToast('Build disabled during combat.', 'danger')
  }, [addToast])

  const handlePadLocked = useCallback((padId: string) => {
    const unlockLevel = padUnlockLevels[padId] ?? 1
    addToast(`Unlock this pad at Stronghold Lv${unlockLevel}.`, 'danger')
  }, [addToast, padUnlockLevels])

  const handleStrongholdUpgrade = () => {
    if (runPhase !== 'build') return
    if (strongholdLevel >= strongholdMaxLevel) {
      addToast('Stronghold already at max level.', 'default')
      return
    }
    if (activeRun.gold < strongholdUpgradeCost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    upgradeStronghold()
  }

  const handleBattleCry = useCallback(() => {
    if (runPhase !== 'build') {
      addToast(runPhase === 'battle_cry' ? 'Battle cry in progress.' : 'Already in combat.', 'default')
      return
    }
    emitTutorialEvent('UI_BATTLE_CRY_CLICKED', {})
    setNightSetupOpen(true)
  }, [addToast, runPhase])

  const handleNightSetupConfirm = useCallback((modifierId?: string) => {
    // Ensure tutorial progression even if the initial battle button event was missed.
    emitTutorialEvent('UI_BATTLE_CRY_CLICKED', {})
    setNightSetupOpen(false)
    startCombatWithNightModifier(modifierId as NightModifierId | undefined)
  }, [startCombatWithNightModifier])

  const handlePerkPick = useCallback((perkId: string) => {
    selectPerk(perkId as PerkId)
    setResolvedPerkDay(activeRun.dayNumber)
  }, [activeRun.dayNumber, selectPerk])

  const handleStartNextDay = useCallback(() => {
    if (perkChoicePending) {
      if (perkModalStage !== 'idle') return
      setPerkModalStage('handoff')
      if (reduceMotion) {
        setPerkModalStage('open')
        return
      }
      if (perkHandoffTimeoutRef.current) {
        window.clearTimeout(perkHandoffTimeoutRef.current)
      }
      perkHandoffTimeoutRef.current = window.setTimeout(() => {
        perkHandoffTimeoutRef.current = null
        setPerkModalStage('open')
      }, DAY_END_TO_PERK_TRANSITION_MS)
      return
    }
    startNewDay()
  }, [perkChoicePending, perkModalStage, reduceMotion, startNewDay])

  const handleComplete = useCallback((result: CombatResult) => {
    resolveCombat({
      victory: result.victory,
      lostSquadIds: result.lostSquadIds,
      lostHeroIds: result.lostHeroIds,
      bossDefeated: result.bossDefeated,
      hqHpPercent: result.hqHpPercent,
      playerPositions: result.playerPositions,
      destroyedWallPadIds: result.destroyedWallPadIds
    })
  }, [resolveCombat])

  const handleHeroMoved = useCallback((payload: { dx: number; dy: number }) => {
    emitTutorialEvent('HERO_MOVED', payload)
  }, [])

  const handleUnitRecallUsed = useCallback(() => {
    emitTutorialEvent('UNIT_RECALL_USED', {})
  }, [])

  const handleWaveStarted = useCallback((payload: { waveIndex: number }) => {
    emitTutorialEvent('ENEMY_WAVE_STARTED', payload)
  }, [])

  const handleTowerAttack = useCallback((payload: { sourceId?: string; targetId?: string }) => {
    emitTutorialEvent('TOWER_ATTACKED', payload)
  }, [])

  const handleTutorialNext = useCallback(() => {
    tutorialManager?.next()
  }, [tutorialManager])

  const handleTutorialSkip = useCallback(() => {
    if (tutorialManager) {
      tutorialManager.skip()
    } else {
      emitTutorialEvent('TUTORIAL_SKIPPED', {})
    }
    addToast('Tutorial skipped. You can replay it from Missions.', 'default')
    if (onTutorialSkip) {
      onTutorialSkip()
      return
    }
    onExit()
  }, [addToast, onExit, onTutorialSkip, tutorialManager])

  const resolveTutorialWorldPoint = useCallback((anchor: TutorialWorldAnchor) => {
    if (anchor.target === 'stronghold') {
      return { x: level.map.playerHQ.x, y: level.map.playerHQ.y }
    }
    if (anchor.target === 'hero') {
      const hero = telemetry?.playerUnits.find((entry) => entry.kind === 'hero')
      if (!hero) return null
      return { x: hero.x, y: hero.y }
    }
    if (anchor.target === 'pad' && anchor.padId) {
      const pad = level.buildingPads.find((entry) => entry.id === anchor.padId)
      return pad ? { x: pad.x, y: pad.y } : null
    }
    return null
  }, [level.buildingPads, level.map.playerHQ.x, level.map.playerHQ.y, telemetry?.playerUnits])

  const projectTutorialWorldToScreen = useCallback((point: { x: number; y: number }) => {
    if (!telemetry) return null
    const { x, y, viewW, viewH } = telemetry.camera
    if (!Number.isFinite(viewW) || !Number.isFinite(viewH) || viewW <= 0 || viewH <= 0) return null
    const nx = (point.x - x) / viewW
    const ny = (point.y - y) / viewH
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null
    return {
      x: nx * window.innerWidth,
      y: ny * window.innerHeight
    }
  }, [telemetry])

  const panelTitle = activePad
    ? activeBuilding
      ? BUILDING_DEFS[activeBuilding.id].name
      : 'Build Options'
    : selection.kind === 'stronghold'
      ? 'Stronghold'
      : selection.kind === 'none'
        ? 'Command Overview'
        : 'Selection'

  const panelSubtitle = activePad
    ? `Pad ${activePad.id.toUpperCase()}`
    : selection.kind === 'stronghold'
      ? 'Main Base'
      : selection.kind === 'none'
        ? 'Select a pad or unit'
        : 'Unit details'

  return (
    <AppShell>
        <CanvasLayer
          ref={canvasRef}
          combat={combatDefinition}
          run={activeRun}
          phase={runPhase === 'combat' ? 'combat' : 'build'}
          resetOnBuild={runPhase === 'day_end'}
          buildingPads={level.buildingPads}
          buildings={activeRun.buildings}
          inputBlocked={inputBlocked}
          selectedPadId={selectedPadId}
          onPadClick={handlePadClick}
          onPadBlocked={handlePadBlocked}
          onPadLocked={handlePadLocked}
          onComplete={handleComplete}
          onSelectionChange={handleSelectionChange}
          onTelemetry={handleTelemetry}
          onPauseToggle={() => uiActions.togglePause()}
          paused={pauseOpen}
          padUnlockLevels={padUnlockLevels}
          showUnitLabels={showUnitLabels}
          onEliteWarning={handleEliteWarning}
          nextBattlePreview={nextBattlePreview}
          onHeroMoved={handleHeroMoved}
          onUnitRecallUsed={handleUnitRecallUsed}
          onWaveStarted={handleWaveStarted}
          onTowerAttack={handleTowerAttack}
        />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="pointer-events-auto px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <TopBar
            mission={level.name}
            day={activeRun.dayNumber}
            phase={
              runPhase === 'combat'
                ? 'combat'
                : runPhase === 'day_end'
                  ? 'day_end'
                  : runPhase === 'battle_cry'
                    ? 'battle_cry'
                    : 'build'
            }
            objective={objective}
            waveLabel={waveLabel}
            gold={activeRun.gold}
            income={dayIncome.buildingTotal + dayIncome.reward}
            strongholdLevel={strongholdLevel}
            strongholdSummary={strongholdSummary}
            onIntel={runPhase === 'build' ? () => setIntelOpen(true) : undefined}
            onSettings={uiActions.openSettings}
            onExit={onExit}
          />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-24 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          <AnimatePresence initial={false}>
            {eliteWarnings.map((warning) => (
              <motion.div
                key={warning.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className="rounded-2xl border border-amber-200/60 bg-amber-400/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow-glow"
              >
                {warning.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="relative flex-1">
          <div className="absolute left-4 top-24 hidden lg:block">
            <Panel
              title={panelTitle}
              subtitle={panelSubtitle}
              open={panelOpen}
              onToggle={() => uiActions.setPanelOpen(!panelOpen)}
              isMobile={false}
            >
              {renderPanelContent()}
            </Panel>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 lg:hidden">
            <Panel
              title={panelTitle}
              subtitle={panelSubtitle}
              open={panelOpen}
              onToggle={() => uiActions.setPanelOpen(!panelOpen)}
              isMobile
            >
              {renderPanelContent()}
            </Panel>
          </div>
        </div>

        {isMobile && !panelOpen && (
          <div className="pointer-events-auto absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4">
            <Button variant="secondary" size="sm" onClick={() => uiActions.setPanelOpen(true)}>
              Open Context
            </Button>
          </div>
        )}

        <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 hidden flex-col gap-4 lg:flex">
          <div className="flex gap-3">
            <AbilityButton
              name={combatDefinition.hero.abilities.q.name}
              description={combatDefinition.hero.abilities.q.description}
              keyHint="Q"
              cooldown={combatDefinition.hero.abilities.q.cooldown}
              readyIn={telemetry?.qReadyIn ?? combatDefinition.hero.abilities.q.cooldown}
              disabled={runPhase !== 'combat'}
              onClick={() => canvasRef.current?.castAbility('q')}
            />
            <AbilityButton
              name={combatDefinition.hero.abilities.e.name}
              description={combatDefinition.hero.abilities.e.description}
              keyHint="E"
              cooldown={combatDefinition.hero.abilities.e.cooldown}
              readyIn={telemetry?.eReadyIn ?? combatDefinition.hero.abilities.e.cooldown}
              disabled={runPhase !== 'combat'}
              onClick={() => canvasRef.current?.castAbility('e')}
            />
            <AbilityButton
              name="Rally"
              description="Call all friendly squads to ring slots around your hero."
              keyHint="T"
              cooldown={0}
              readyIn={0}
              disabled={runPhase !== 'build' && runPhase !== 'combat'}
              testId="ability-rally-button"
              onClick={() => canvasRef.current?.rallyUnits()}
            />
          </div>
        </div>

        <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 hidden sm:block sm:scale-90 lg:right-6 lg:scale-100">
          <MiniMap
            obstacles={level.map.obstacles}
            hq={level.map.playerHQ}
            view={
              telemetry
                ? {
                    mapWidth: level.map.width,
                    mapHeight: level.map.height,
                    viewX: telemetry.camera.x,
                    viewY: telemetry.camera.y,
                    viewW: telemetry.camera.viewW,
                    viewH: telemetry.camera.viewH,
                    viewPolygon: telemetry.camera.viewPolygon
                  }
                : null
            }
            playerUnits={telemetry?.playerUnits}
            enemyUnits={telemetry?.enemyUnits}
            onNavigate={(x, y) => canvasRef.current?.panTo(x, y)}
          />
        </div>

        <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-sm -translate-x-1/2 px-4 sm:w-auto sm:max-w-none sm:px-0">
          <Tooltip
            content={
              runPhase === 'build'
                ? 'Choose a night modifier, then start combat.'
                : runPhase === 'battle_cry'
                  ? 'Battle cry in progress...'
                  : 'Unavailable during combat.'
            }
          >
            <motion.button
              className={[
                'relative w-full overflow-hidden rounded-2xl px-6 py-3 text-base font-semibold',
                runPhase === 'build'
                  ? `bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 text-slate-950 shadow-glow ${reduceMotion ? '' : 'battle-glow battle-shine'}`
                  : 'bg-surface text-muted border border-white/10'
              ].join(' ')}
              onClick={handleBattleCry}
              disabled={runPhase !== 'build'}
              data-testid="battle-cry-button"
              whileHover={reduceMotion ? {} : { scale: 1.02 }}
              whileTap={reduceMotion ? {} : { scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              Prepare Night
            </motion.button>
          </Tooltip>
        </div>
      </div>

      <AnimatePresence>
        {dayEndModalVisible && (
          <DayEndModal
            dayNumber={activeRun.dayNumber}
            breakdown={dayIncome}
            progressLabel={goal?.label ?? 'Mission progress'}
            progressValue={progressValue}
            progressTarget={progressTarget}
            nextEnemyTypes={summaryEnemyTypes}
            ctaLabel={perkChoicePending ? 'Continue to Perk Choice' : 'Start Next Day'}
            onNextDay={handleStartNextDay}
          />
        )}
      </AnimatePresence>

      <NightSetupModal
        open={nightSetupOpen}
        dayNumber={activeRun.dayNumber}
        modifiers={allowedNightModifiers}
        initialSelection={activeRun.activeNightModifier}
        allowNone
        onCancel={() => setNightSetupOpen(false)}
        onConfirm={handleNightSetupConfirm}
      />

      <PerkChoiceModal
        open={perkModalVisible}
        dayNumber={activeRun.dayNumber}
        offers={perkOffers}
        perkCount={perkCount}
        perkMaxCount={perkMaxCount}
        onPick={handlePerkPick}
      />

      <NextBattleIntelPanel
        open={intelOpen}
        dayNumber={activeRun.dayNumber}
        previewEdges={nextBattlePreview?.previewEdges ?? []}
        enemies={intelEntries}
        waves={intelWaveEntries}
        hasEliteWarning={(combatDefinition.eliteConfig?.announceInIntel ?? true) ? nextBattlePreview?.hasEliteVariantWarning : false}
        onOpenChange={setIntelOpen}
      />

      {tutorialSnapshot?.active && (
        <TutorialOverlay
          snapshot={tutorialSnapshot}
          resolveWorldPoint={resolveTutorialWorldPoint}
          projectWorldToScreen={projectTutorialWorldToScreen}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
        />
      )}

      {(runPhase === 'build' || runPhase === 'day_end') && (
        <NightDebugPanel
          runSeed={activeRun.runSeed}
          modifierIds={nightModifierDefs.map((entry) => entry.id)}
          perkIds={perkDefs.map((entry) => entry.id)}
          traitIds={traitDefs.map((entry) => entry.id)}
          forceNightModifierId={activeRun.debugOverrides?.forceNightModifierId}
          forcePerkId={activeRun.debugOverrides?.forcePerkId}
          forceEnemyTraitId={activeRun.debugOverrides?.forceEnemyTraitId}
          forceEliteVariant={activeRun.debugOverrides?.forceEliteVariant}
          onRerollSeed={rerollRunSeed}
          onSetOverride={setDebugOverrides}
        />
      )}

      {pauseOpen && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface p-5 shadow-soft">
            <div className="text-lg font-semibold text-text">Paused</div>
            <div className="mt-2 text-sm text-muted">Resume or adjust your plan.</div>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" onClick={() => uiActions.togglePause(false)}>Resume</Button>
              <Button variant="secondary" onClick={() => canvasRef.current?.resetDay()}>Restart Day</Button>
              {onBackToDashboard && (
                <Button variant="secondary" onClick={onBackToDashboard}>Back to Dashboard</Button>
              )}
              <Button variant="danger" onClick={onExit}>Quit to Level Select</Button>
            </div>
          </div>
        </div>
      )}

      <SettingsDialog />
      <Toasts />
    </AppShell>
  )
}
