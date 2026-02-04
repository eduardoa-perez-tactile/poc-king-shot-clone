import React, { useEffect, useState } from 'react'
import { createInitialState, tickState, applyTutorial } from '../game/logic'
import { clearSave, hasSave, loadGame, saveGame } from '../storage/save'
import { GameState } from '../game/types'
import { MISSIONS } from '../rts/missions'
import { MissionDefinition, MissionResult } from '../rts/types'
import { MetaHub } from './MetaHub'
import { MainMenu } from './components/MainMenu'
import { MissionSelect } from './components/MissionSelect'
import { RTSGame } from '../rts/RTSGame'
import { EndScreen } from './components/EndScreen'
import { SettingsScreen } from './components/SettingsScreen'

export type Scene = 'mainMenu' | 'missionSelect' | 'gameplay' | 'end' | 'settlement' | 'settings'

export const App: React.FC = () => {
  const [state, setState] = useState<GameState>(() => tickState(loadGame(), Date.now()))
  const [scene, setScene] = useState<Scene>('mainMenu')
  const [selectedMission, setSelectedMission] = useState<MissionDefinition | null>(null)
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null)
  const [selectedHeroId, setSelectedHeroId] = useState<string | undefined>(state.heroes[0]?.id)

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => tickState(prev, Date.now()))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    saveGame(state)
  }, [state])

  useEffect(() => {
    if (!selectedHeroId && state.heroes.length > 0) {
      setSelectedHeroId(state.heroes[0].id)
    }
  }, [state.heroes, selectedHeroId])

  const canContinue = hasSave()

  const handleReset = () => {
    const confirmReset = window.confirm('Reset all progress?')
    if (!confirmReset) return
    clearSave()
    setState(createInitialState())
    setScene('mainMenu')
  }

  const handleLaunch = (mission: MissionDefinition) => {
    setSelectedMission(mission)
    setScene('gameplay')
  }

  const handleMissionComplete = (result: MissionResult, casualties: { infantry: number; archer: number; cavalry: number }) => {
    setMissionResult(result)
    if (result.victory && selectedMission) {
      setState((prev) => {
        const updated = {
          ...prev,
          resources: {
            food: prev.resources.food + result.rewards.resources.food,
            wood: prev.resources.wood + result.rewards.resources.wood,
            stone: prev.resources.stone + result.rewards.resources.stone,
            gold: prev.resources.gold + result.rewards.resources.gold
          },
          inventory: {
            ...prev.inventory,
            xpItems: prev.inventory.xpItems + result.rewards.xpItems,
            keys: {
              gold: prev.inventory.keys.gold + result.rewards.keys.gold,
              platinum: prev.inventory.keys.platinum + result.rewards.keys.platinum
            }
          },
          troops: {
            infantry: Math.max(0, prev.troops.infantry - casualties.infantry),
            archer: Math.max(0, prev.troops.archer - casualties.archer),
            cavalry: Math.max(0, prev.troops.cavalry - casualties.cavalry)
          },
          missions: {
            unlocked: prev.missions.unlocked,
            completed: prev.missions.completed.includes(selectedMission.id)
              ? prev.missions.completed
              : [...prev.missions.completed, selectedMission.id],
            lastPlayed: selectedMission.id
          }
        }
        const index = MISSIONS.findIndex((m) => m.id === selectedMission.id)
        if (index >= 0) {
          updated.missions.unlocked = Math.max(updated.missions.unlocked, index + 2)
        }
        return applyTutorial(updated, 'raid')
      })
    } else {
      setState((prev) => ({
        ...prev,
        troops: {
          infantry: Math.max(0, prev.troops.infantry - casualties.infantry),
          archer: Math.max(0, prev.troops.archer - casualties.archer),
          cavalry: Math.max(0, prev.troops.cavalry - casualties.cavalry)
        }
      }))
    }
    setScene('end')
  }

  const handleReplay = () => {
    if (!selectedMission) return
    setScene('gameplay')
  }

  const handleNextMission = () => {
    if (!selectedMission) return
    const index = MISSIONS.findIndex((m) => m.id === selectedMission.id)
    const next = MISSIONS[index + 1]
    if (next) {
      setSelectedMission(next)
      setScene('gameplay')
    }
  }

  if (scene === 'mainMenu') {
    return (
      <MainMenu
        canContinue={canContinue}
        onPlay={() => setScene('missionSelect')}
        onContinue={() => setScene('missionSelect')}
        onSettlement={() => setScene('settlement')}
        onSettings={() => setScene('settings')}
        onReset={handleReset}
      />
    )
  }

  if (scene === 'settings') {
    return (
      <div className="screen">
        <button className="btn" onClick={() => setScene('mainMenu')}>Back</button>
        <SettingsScreen state={state} onToggleSound={() => setState((prev) => ({ ...prev, settings: { ...prev.settings, sound: !prev.settings.sound } }))} onReset={handleReset} />
      </div>
    )
  }

  if (scene === 'missionSelect') {
    return (
      <MissionSelect
        state={state}
        selectedHeroId={selectedHeroId}
        onSelectHero={(id) => setSelectedHeroId(id || undefined)}
        onLaunch={handleLaunch}
        onBack={() => setScene('mainMenu')}
        onSettlement={() => setScene('settlement')}
      />
    )
  }

  if (scene === 'gameplay' && selectedMission) {
    return (
      <RTSGame
        mission={selectedMission}
        meta={state}
        leaderHeroId={selectedHeroId}
        onComplete={handleMissionComplete}
        onExit={() => setScene('missionSelect')}
      />
    )
  }

  if (scene === 'end' && missionResult && selectedMission) {
    const index = MISSIONS.findIndex((m) => m.id === selectedMission.id)
    const canNext = missionResult.victory && index + 1 < MISSIONS.length && state.missions.unlocked >= index + 2
    return (
      <EndScreen
        mission={selectedMission}
        result={missionResult}
        onMainMenu={() => setScene('mainMenu')}
        onReplay={handleReplay}
        onNext={handleNextMission}
        canNext={canNext}
      />
    )
  }

  if (scene === 'settlement') {
    return (
      <MetaHub
        state={state}
        setState={setState}
        onBackToMenu={() => setScene('mainMenu')}
        onOpenMissions={() => setScene('missionSelect')}
        onResetSave={handleReset}
      />
    )
  }

  return null
}
