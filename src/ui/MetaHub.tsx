import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ResourceBar } from './components/ResourceBar'
import { TownScreen } from './components/TownScreen'
import { HeroesScreen } from './components/HeroesScreen'
import { TroopsScreen } from './components/TroopsScreen'
import { QuestsScreen } from './components/QuestsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { Modal } from './components/Modal'
import { ObjectiveBanner } from './components/ObjectiveBanner'
import { ToastStack, Toast } from './components/ToastStack'
import { TutorialOverlay } from './components/TutorialOverlay'
import { OngoingTasks } from './components/OngoingTasks'
import {
  applyTutorial,
  canAfford,
  claimEventMilestone,
  claimQuestReward,
  collectBanked,
  getBuildingLevel,
  getTrainingCost,
  getTroopCap,
  getUpgradeCost,
  restartEvent,
  startTraining,
  startUpgrade,
  summonHero,
  updateSquad,
  levelUpHero,
  equipGear
} from '../game/logic'
import { BUILDING_DEFS, EVENT_CONFIG } from '../config/balance'
import { BuildingId, GameState, TownTile, TroopType } from '../game/types'

const TABS = ['Town', 'Heroes', 'Troops', 'Quests', 'Settings'] as const

type Tab = typeof TABS[number]

export const MetaHub: React.FC<{
  state: GameState
  setState: React.Dispatch<React.SetStateAction<GameState>>
  onBackToMenu: () => void
  onOpenMissions: () => void
  onResetSave: () => void
}> = ({ state, setState, onBackToMenu, onOpenMissions, onResetSave }) => {
  const [tab, setTab] = useState<Tab>('Town')
  const [modal, setModal] = useState<{ title: string; body: React.ReactNode } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevRef = useRef<typeof state | null>(null)

  const navItems = useMemo(() => TABS, [])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { ...toast, id }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleCollect = () => {
    setState((prev) => collectBanked(prev))
  }

  const handleUpgrade = (id: BuildingId) => {
    if (state.upgradeQueue) {
      setModal({ title: 'Upgrade Queue Busy', body: <div>Only one upgrade can run at a time.</div> })
      return
    }
    const level = getBuildingLevel(state, id)
    if (level >= BUILDING_DEFS[id].maxLevel) {
      setModal({ title: 'Max Level', body: <div>This building is already at max level.</div> })
      return
    }
    const cost = getUpgradeCost(id, level + 1)
    if (!canAfford(state.resources, cost)) {
      setModal({ title: 'Insufficient Resources', body: <div>Collect more resources before upgrading.</div> })
      return
    }
    const next = startUpgrade(state, id, Date.now())
    if (next !== state) {
      setState(applyTutorial(next, 'upgrade'))
      setModal({ title: 'Upgrade Started', body: <div>{id} is upgrading now.</div> })
      addToast({ message: `${BUILDING_DEFS[id].name} upgrade started.` })
    }
  }

  const handleUpgradeAt = (id: BuildingId, tile: TownTile) => {
    if (state.upgradeQueue) {
      setModal({ title: 'Upgrade Queue Busy', body: <div>Only one upgrade can run at a time.</div> })
      return
    }
    if (tile.buildingId) {
      handleUpgrade(tile.buildingId)
      return
    }
    const cost = getUpgradeCost(id, 1)
    if (!canAfford(state.resources, cost)) {
      setModal({ title: 'Insufficient Resources', body: <div>Collect more resources before building.</div> })
      return
    }
    const next = startUpgrade(state, id, Date.now(), { x: tile.x, y: tile.y })
    if (next !== state) {
      setState(applyTutorial(next, 'upgrade'))
      setModal({ title: 'Construction Started', body: <div>{BUILDING_DEFS[id].name} is under construction.</div> })
      addToast({ message: `${BUILDING_DEFS[id].name} construction started.` })
    }
  }

  const handleSummon = (type: 'gold' | 'platinum') => {
    if (state.inventory.keys[type] <= 0) {
      setModal({ title: 'No Keys', body: <div>You need a {type} key to summon.</div> })
      return
    }
    const result = summonHero(state, type)
    if (result.state !== state) {
      setState(result.state)
      setModal({
        title: 'Summon Results',
        body: (
          <div>
            {result.heroes.map((hero) => (
              <div key={hero.id}>{hero.id} joined your roster.</div>
            ))}
          </div>
        )
      })
      addToast({ message: `Summoned ${result.heroes.length} hero(s).` })
    }
  }

  const handleTraining = (type: TroopType, amount: number) => {
    if (state.trainingQueue) {
      setModal({ title: 'Training Queue Busy', body: <div>Wait for current training to finish.</div> })
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setModal({ title: 'Invalid Amount', body: <div>Choose a valid troop amount.</div> })
      return
    }
    const cap = getTroopCap(state)
    const current = state.troops.infantry + state.troops.archer + state.troops.cavalry
    if (current + amount > cap) {
      setModal({ title: 'Troop Cap Reached', body: <div>Upgrade Barracks to increase capacity.</div> })
      return
    }
    const cost = getTrainingCost(type, amount)
    if (!canAfford(state.resources, cost)) {
      setModal({ title: 'Insufficient Resources', body: <div>Collect more resources to train troops.</div> })
      return
    }
    const next = startTraining(state, type, amount, Date.now())
    if (next !== state) {
      setState(applyTutorial(next, 'train'))
      setModal({ title: 'Training Started', body: <div>{amount} {type} in training.</div> })
      addToast({ message: `Training ${amount} ${type}.` })
    }
  }

  const handleClaimQuest = (questId: string, group: 'daily' | 'chapter') => {
    setState((prev) => claimQuestReward(prev, questId, group))
  }

  const handleClaimMilestone = (index: number) => {
    setState((prev) => claimEventMilestone(prev, index))
  }

  const handleRestartEvent = () => {
    setState((prev) => restartEvent(prev, Date.now()))
  }

  const handleToggleSound = () => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, sound: !prev.settings.sound } }))
  }

  const handleLevelUp = (heroId: string) => {
    setState((prev) => levelUpHero(prev, heroId, 1))
    addToast({ message: 'Hero leveled up.' })
  }

  const handleEquip = (heroId: string, gearId: string) => {
    setState((prev) => equipGear(prev, heroId, gearId))
    addToast({ message: 'Gear equipped.' })
  }

  const handleUpdateSquad = (payload: { leaderId?: string; supportIds: string[]; composition: { infantry: number; archer: number; cavalry: number } }) => {
    setState((prev) => updateSquad(prev, {
      leaderId: payload.leaderId,
      supportIds: payload.supportIds,
      composition: payload.composition
    }))
    addToast({ message: 'Squad updated.' })
  }

  const tutorialSteps = [
    { id: 'collect', label: 'Collect resources', description: 'Gather your first income from buildings.', tab: 'Town', cta: 'Collect All', action: handleCollect },
    { id: 'upgrade', label: 'Upgrade a building', description: 'Boost production by upgrading a building.', tab: 'Town', cta: 'Upgrade Farm', action: () => handleUpgrade('farm') },
    { id: 'summon', label: 'Summon a hero', description: 'Use your gold keys to summon heroes.', tab: 'Heroes', cta: 'Summon (Gold)', action: () => handleSummon('gold') },
    { id: 'train', label: 'Train troops', description: 'Build an army at the Barracks.', tab: 'Troops', cta: 'Train 20 Infantry', action: () => handleTraining('infantry', 20) },
    { id: 'raid', label: 'Win a mission', description: 'Launch and complete a mission from the main menu.', tab: 'Town', cta: 'Go to Missions', action: onOpenMissions }
  ] as const

  const currentStep = tutorialSteps.find((step) => !state.tutorial.steps[step.id]) ?? null

  const objective = currentStep
    ? {
        title: 'Next Objective',
        description: currentStep.description,
        ctaLabel: tab === currentStep.tab ? currentStep.cta : `Go to ${currentStep.tab}`,
        onAction: () => {
          if (tab !== currentStep.tab) {
            setTab(currentStep.tab as Tab)
            return
          }
          currentStep.action()
        }
      }
    : {
        title: 'Objective Complete',
        description: 'You are ready to tackle missions.',
        ctaLabel: 'Go to Missions',
        onAction: onOpenMissions
      }

  useEffect(() => {
    const prev = prevRef.current
    if (prev) {
      if (prev.upgradeQueue && !state.upgradeQueue) {
        addToast({ message: 'Upgrade complete. Collect your improved output.' })
      }
      if (prev.trainingQueue && !state.trainingQueue) {
        addToast({ message: 'Training complete. Troops added.' })
      }
      state.quests.daily.forEach((quest, index) => {
        const prevQuest = prev.quests.daily[index]
        if (!prevQuest?.completed && quest.completed && !quest.claimed) {
          addToast({
            message: `Daily quest complete: ${quest.title}`,
            actionLabel: 'Claim',
            onAction: () => handleClaimQuest(quest.id, 'daily')
          })
        }
      })
      state.quests.chapters.forEach((quest, index) => {
        const prevQuest = prev.quests.chapters[index]
        if (!prevQuest?.completed && quest.completed && !quest.claimed) {
          addToast({
            message: `Chapter quest complete: ${quest.title}`,
            actionLabel: 'Claim',
            onAction: () => handleClaimQuest(quest.id, 'chapter')
          })
        }
      })
      EVENT_CONFIG.milestones.forEach((milestone, index) => {
        const crossed = prev.event.points < milestone.points && state.event.points >= milestone.points
        if (crossed && !state.event.claimedMilestones.includes(index)) {
          addToast({
            message: `Event milestone reached: ${milestone.points} pts`,
            actionLabel: 'Claim',
            onAction: () => handleClaimMilestone(index)
          })
        }
      })
    }
    prevRef.current = state
  }, [state])

  return (
    <div className="app">
      <ResourceBar resources={state.resources} banked={state.banked} onCollect={handleCollect} />
      <div className="layout">
        <nav className="sidebar">
          <h2>Settlement</h2>
          {navItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${tab === item ? 'active' : ''}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
          <button className="nav-item" onClick={onOpenMissions}>Missions</button>
          <button className="nav-item" onClick={onBackToMenu}>Main Menu</button>
        </nav>
        <main className="content">
          <ObjectiveBanner objective={objective} />
          <OngoingTasks state={state} />
          {tab === 'Town' && <TownScreen state={state} onUpgrade={handleUpgrade} onBuildAt={handleUpgradeAt} />}
          {tab === 'Heroes' && (
            <HeroesScreen state={state} onSummon={handleSummon} onLevelUp={handleLevelUp} onEquip={handleEquip} />
          )}
          {tab === 'Troops' && (
            <TroopsScreen state={state} onTrain={handleTraining} onUpdateSquad={handleUpdateSquad} />
          )}
          {tab === 'Quests' && (
            <QuestsScreen
              state={state}
              onClaimQuest={handleClaimQuest}
              onClaimMilestone={handleClaimMilestone}
              onRestartEvent={handleRestartEvent}
            />
          )}
          {tab === 'Settings' && (
            <SettingsScreen
              state={state}
              onToggleSound={handleToggleSound}
              onReset={onResetSave}
            />
          )}
        </main>
      </div>
      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          {modal.body}
        </Modal>
      )}
      <TutorialOverlay
        steps={state.tutorial.steps}
        dismissed={state.tutorial.dismissed}
        currentStep={currentStep ? { id: currentStep.id, label: currentStep.label, description: currentStep.description, ctaLabel: currentStep.cta } : null}
        onAction={() => {
          if (!currentStep) return
          if (tab !== currentStep.tab) {
            setTab(currentStep.tab as Tab)
            return
          }
          currentStep.action()
        }}
        onDismiss={() => setState((prev) => ({ ...prev, tutorial: { ...prev.tutorial, dismissed: true } }))}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
