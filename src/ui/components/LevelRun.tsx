import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BuildingId, BUILDING_DEFS } from '../../config/buildings'
import { LEVELS } from '../../config/levels'
import { UNIT_DEFS } from '../../config/units'
import { getBuildingUpgradeCost, getIncomeBreakdown, getSquadCap, getUnitCost } from '../../run/economy'
import { canUpgradeBuilding, canBuySquad } from '../../run/runState'
import { useRunStore } from '../../run/store'
import { buildCombatDefinition } from '../../rts/combat'
import { hitTestPad } from '../../rts/pads'
import { CanvasLayer } from './CanvasLayer'
import type { CanvasHandle, CanvasTelemetry } from './CanvasLayer'
import { AppShell } from './hud/AppShell'
import { TopBar } from './hud/TopBar'
import { Panel } from './hud/Panel'
import { EntityCard } from './hud/EntityCard'
import { BuildOptionCard } from './hud/BuildOptionCard'
import { AbilityButton } from './hud/AbilityButton'
import { DayEndModal } from './hud/DayEndModal'
import { Toasts } from './hud/Toasts'
import { SettingsDialog } from './hud/SettingsDialog'
import { MiniMap } from './hud/MiniMap'
import { Button } from './ui/Button'
import { Tooltip } from './ui/Tooltip'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { uiActions, useUiStore } from '../store/uiStore'
import type { SelectionInfo } from '../store/uiStore'
import { useMotionSettings } from '../hooks/useMotionSettings'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, Crosshair, Swords } from 'lucide-react'

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

const describeEffects = (id: BuildingId) => {
  const def = BUILDING_DEFS[id]
  const parts: string[] = []
  if (def.income) parts.push(`Income +${def.income.base}/day`)
  if (def.unlocksUnit) parts.push(`Unlocks ${UNIT_DEFS[def.unlocksUnit].name}`)
  if (def.bonuses?.squadCapPerLevel) parts.push(`Squad cap +${def.bonuses.squadCapPerLevel} per level`)
  if (def.bonuses?.hqHpPerLevel) parts.push(`HQ +${def.bonuses.hqHpPerLevel} HP per level`)
  if (def.bonuses?.unitAttackPctPerLevel) parts.push('Squad stats scale with upgrades')
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

export const LevelRun: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const {
    activeRun,
    runPhase,
    buyBuilding,
    upgradeBuilding,
    buySquad,
    startCombat,
    resolveCombat,
    startNewDay
  } = useRunStore()

  const selection = useUiStore((state) => state.selection)
  const selectedPadId = useUiStore((state) => state.selectedPadId)
  const panelOpen = useUiStore((state) => state.panelOpen)
  const pauseOpen = useUiStore((state) => state.pauseOpen)
  const settingsOpen = useUiStore((state) => state.settingsOpen)
  const reduceMotion = useMotionSettings()

  const [telemetry, setTelemetry] = useState<CanvasTelemetry | null>(null)
  const canvasRef = useRef<CanvasHandle | null>(null)
  const isMobile = useMediaQuery('(max-width: 639px)')

  if (!activeRun) return null
  const level = LEVELS.find((entry) => entry.id === activeRun.levelId)
  if (!level) return null

  const combatDefinition = buildCombatDefinition(activeRun)
  const squadCap = getSquadCap(activeRun)
  const dayIncome = activeRun.lastIncome ?? getIncomeBreakdown(activeRun, 0)

  const buildingByPad = useMemo(() => {
    return new Map(activeRun.buildings.map((building) => [building.padId, building]))
  }, [activeRun.buildings])

  const activePad = selectedPadId ? level.buildingPads.find((pad) => pad.id === selectedPadId) ?? null : null
  const activeBuilding = activePad ? buildingByPad.get(activePad.id) ?? null : null

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
  }, [addToast, runPhase])

  const handleBuild = (padId: string, buildingId: BuildingId) => {
    const cost = BUILDING_DEFS[buildingId].baseCost
    if (activeRun.gold < cost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    buyBuilding(buildingId, padId)
    uiActions.setSelectedPad(padId)
  }

  const handleUpgrade = (padId: string) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const def = BUILDING_DEFS[building.id]
    if (building.level >= def.maxLevel) {
      addToast('Building already at max level.', 'default')
      return
    }
    const cost = getBuildingUpgradeCost(building.id, building.level + 1)
    if (activeRun.gold < cost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    upgradeBuilding(padId)
  }

  const handleRecruit = (padId: string) => {
    const building = buildingByPad.get(padId)
    if (!building) return
    const def = BUILDING_DEFS[building.id]
    if (!def.unlocksUnit) return
    if (!canBuySquad(activeRun, def.unlocksUnit)) {
      addToast('Squad cap reached or insufficient gold.', 'danger')
      return
    }
    const unitCost = getUnitCost(def.unlocksUnit)
    if (activeRun.gold < unitCost) {
      addToast('Not enough gold.', 'danger')
      return
    }
    const pad = level.buildingPads.find((entry) => entry.id === padId)
    if (!pad) {
      buySquad(def.unlocksUnit)
      return
    }
    const hq = level.map.playerHQ
    const hqRect = {
      x: hq.x - 36,
      y: hq.y - 24,
      w: 72,
      h: 48
    }
    const used = activeRun.unitRoster
      .filter((squad) => squad.spawnPadId === padId && squad.spawnPos)
      .map((squad) => squad.spawnPos as { x: number; y: number })
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
    if (!next) {
      addToast('No space near this building.', 'danger')
      return
    }
    buySquad(def.unlocksUnit, { x: pad.x + next.x, y: pad.y + next.y }, padId)
  }

  const objective = level.goals[0]?.label ?? level.description
  const waveLabel =
    runPhase === 'combat' && telemetry
      ? `Wave ${Math.min(telemetry.waveIndex + 1, telemetry.waveCount)}/${telemetry.waveCount}`
      : undefined

  const inputBlocked = runPhase === 'day_end' || settingsOpen || pauseOpen

  const goal = level.goals[0]
  const goalProgressRaw = goal ? activeRun.goalsProgress[goal.id] : 0
  const progressValue =
    typeof goalProgressRaw === 'boolean' ? (goalProgressRaw ? 1 : 0) : Number(goalProgressRaw || 0)
  const progressTarget = goal ? (typeof goalProgressRaw === 'boolean' ? 1 : goal.target) : 1

  const renderPanelContent = () => {
    if (activePad) {
      if (activeBuilding) {
        const def = BUILDING_DEFS[activeBuilding.id]
        const isMax = activeBuilding.level >= def.maxLevel
        const nextLevel = Math.min(activeBuilding.level + 1, def.maxLevel)
        const nextEffects = isMax ? 'Max level reached.' : describeLevelEffects(activeBuilding.id, nextLevel) || 'No bonuses.'
        const upgradeCost = isMax ? 'Max' : `${getBuildingUpgradeCost(activeBuilding.id, activeBuilding.level + 1)} gold`
        return (
          <EntityCard
            title={`${def.name} · Lv ${activeBuilding.level}`}
            description={describeLevelEffects(activeBuilding.id, activeBuilding.level) || 'No bonuses.'}
            meta={
              <div className="space-y-2 text-xs text-muted">
                <div>Next Level: {nextEffects}</div>
                <div>Upgrade Cost: {upgradeCost}</div>
              </div>
            }
            actions={
              <>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canUpgradeBuilding(activeRun, activeBuilding.padId) || runPhase !== 'build'}
                  onClick={() => handleUpgrade(activeBuilding.padId)}
                >
                  Upgrade
                </Button>
                {def.unlocksUnit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canBuySquad(activeRun, def.unlocksUnit) || runPhase !== 'build'}
                    onClick={() => handleRecruit(activeBuilding.padId)}
                  >
                    Recruit
                  </Button>
                )}
              </>
            }
          />
        )
      }
      return (
        <div className="grid gap-3">
          {activePad.allowedTypes.map((id) => {
            const cost = BUILDING_DEFS[id].baseCost
            const canAfford = activeRun.gold >= cost
            return (
              <BuildOptionCard
                key={id}
                title={BUILDING_DEFS[id].name}
                description={describeEffects(id)}
                cost={cost}
                canAfford={canAfford && runPhase === 'build'}
                onBuild={() => handleBuild(activePad.id, id)}
              />
            )
          })}
        </div>
      )
    }

    if (selection.kind === 'hero') {
      return (
        <EntityCard
          title={selection.name}
          subtitle="Hero"
          description={selection.description}
          hp={{ value: selection.hp, max: selection.maxHp }}
          meta={
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div className="flex items-center gap-2"><Swords className="h-3 w-3 text-accent" /> Attack {Math.round(combatDefinition.hero.stats.attack)}</div>
              <div className="flex items-center gap-2"><Crosshair className="h-3 w-3 text-accent" /> Range {Math.round(combatDefinition.hero.stats.range)}</div>
              <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-accent" /> Speed {Math.round(combatDefinition.hero.stats.speed)}</div>
              <div className="flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-accent" /> Cooldown {combatDefinition.hero.stats.cooldown}s</div>
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
              <div key={unit.id} className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
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
        <div className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
          {objective}
        </div>
        <div className="rounded-2xl border border-white/10 bg-surface/70 px-3 py-2">
          {isMobile ? 'Tap pads to build. Select squads to command.' : 'Hover pads to build. Select squads to issue orders.'}
        </div>
      </div>
    )
  }

  const handleSelectionChange = useCallback((next: SelectionInfo) => {
    uiActions.setSelection(next)
    if (next.kind !== 'none') uiActions.setSelectedPad(null)
  }, [])

  const handleTelemetry = useCallback((data: CanvasTelemetry) => {
    setTelemetry(data)
  }, [])

  const handlePadBlocked = useCallback(() => {
    addToast('Build disabled during combat.', 'danger')
  }, [addToast])

  const handleComplete = useCallback((result: { victory: boolean; lostSquadIds: string[]; bossDefeated: boolean; hqHpPercent: number }) => {
    resolveCombat({
      victory: result.victory,
      lostSquadIds: result.lostSquadIds,
      bossDefeated: result.bossDefeated,
      hqHpPercent: result.hqHpPercent
    })
  }, [resolveCombat])

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
        onComplete={handleComplete}
        onSelectionChange={handleSelectionChange}
        onTelemetry={handleTelemetry}
        onPauseToggle={() => uiActions.togglePause()}
        paused={pauseOpen}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="pointer-events-auto px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <TopBar
            mission={level.name}
            day={activeRun.dayNumber}
            phase={runPhase === 'combat' ? 'combat' : runPhase === 'day_end' ? 'day_end' : 'build'}
            objective={objective}
            waveLabel={waveLabel}
            gold={activeRun.gold}
            income={dayIncome.buildingTotal + dayIncome.reward}
            onSettings={uiActions.openSettings}
            onExit={onExit}
          />
        </div>

        <div className="relative flex-1">
          <div className="absolute left-4 top-24 hidden lg:block">
            <Panel
              title={activePad ? (activeBuilding ? BUILDING_DEFS[activeBuilding.id].name : 'Build Options') : selection.kind === 'none' ? 'Command Overview' : 'Selection'}
              subtitle={activePad ? `Pad ${activePad.id.toUpperCase()}` : selection.kind === 'none' ? 'Select a pad or unit' : 'Unit details'}
              open={panelOpen}
              onToggle={() => uiActions.setPanelOpen(!panelOpen)}
              isMobile={false}
            >
              {renderPanelContent()}
            </Panel>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 lg:hidden">
            <Panel
              title={activePad ? (activeBuilding ? BUILDING_DEFS[activeBuilding.id].name : 'Build Options') : selection.kind === 'none' ? 'Command Overview' : 'Selection'}
              subtitle={activePad ? `Pad ${activePad.id.toUpperCase()}` : selection.kind === 'none' ? 'Select a pad or unit' : 'Unit details'}
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
                    viewH: telemetry.camera.viewH
                  }
                : null
            }
            onNavigate={(x, y) => canvasRef.current?.panTo(x, y)}
          />
        </div>

        <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-sm -translate-x-1/2 px-4 sm:w-auto sm:max-w-none sm:px-0">
          <Tooltip content={runPhase === 'build' ? 'Start the combat wave.' : 'Unavailable during combat.'}>
            <motion.button
              className={[
                'relative w-full overflow-hidden rounded-2xl px-6 py-3 text-base font-semibold',
                runPhase === 'build'
                  ? `bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 text-slate-950 shadow-glow ${reduceMotion ? '' : 'battle-glow battle-shine'}`
                  : 'bg-surface/80 text-muted border border-white/10'
              ].join(' ')}
              onClick={() => (runPhase === 'build' ? startCombat() : addToast('Already in combat.', 'default'))}
              disabled={runPhase !== 'build'}
              whileHover={reduceMotion ? {} : { scale: 1.02 }}
              whileTap={reduceMotion ? {} : { scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              Battle Cry
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {runPhase === 'day_end' && (
        <DayEndModal
          dayNumber={activeRun.dayNumber}
          breakdown={dayIncome}
          progressLabel={goal?.label ?? 'Mission progress'}
          progressValue={progressValue}
          progressTarget={progressTarget}
          onNextDay={startNewDay}
        />
      )}

      {pauseOpen && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface/95 p-5 shadow-soft">
            <div className="text-lg font-semibold text-text">Paused</div>
            <div className="mt-2 text-sm text-muted">Resume or adjust your plan.</div>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" onClick={() => uiActions.togglePause(false)}>Resume</Button>
              <Button variant="secondary" onClick={() => canvasRef.current?.resetDay()}>Restart Day</Button>
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
