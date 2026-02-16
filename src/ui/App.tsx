import React, { useState } from 'react'
import { useRunStore } from '../run/store'
import { MainMenu } from './components/MainMenu'
import { WorldMapMissionSelect } from './components/WorldMapMissionSelect'
import { LevelRun } from './components/LevelRun'
import { WinScreen } from './components/WinScreen'
import { LoseScreen } from './components/LoseScreen'
import { Dashboard } from './screens/Dashboard/Dashboard'
import { clearPlaytestLevel, isPlaytestReturnEnabled, setPlaytestLevel } from '../game/runtime/playtest'
import { validateLevelDefinition } from '../game/types/LevelDefinition'
import { isTutorialCompleted } from '../tutorial/tutorialProgress'
import { WORLD_MISSIONS } from './worldMapData'
import { applyMissionResult, clearWorldProgression, loadWorldProgression, saveWorldProgression } from './worldProgression'

type Scene = 'mainMenu' | 'worldMap' | 'dashboard' | 'run'

export const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>('mainMenu')
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(null)
  const [runSource, setRunSource] = useState<'normal' | 'dashboard'>('normal')
  const [tutorialReplayRequested, setTutorialReplayRequested] = useState(false)
  const { activeRun, runPhase, startRun, abandonRun, retryRun, clearAll } = useRunStore()
  const dashboardEnabled = true

  const startTutorialRun = (replay: boolean) => {
    clearPlaytestLevel()
    setRunSource('normal')
    setTutorialReplayRequested(replay)
    setCurrentMissionId(null)
    startRun('tutorial_01')
    setScene('run')
  }

  const handlePlay = () => {
    if (!isTutorialCompleted()) {
      startTutorialRun(false)
      return
    }
    setTutorialReplayRequested(false)
    setScene('worldMap')
  }

  const handleReplayTutorial = () => {
    startTutorialRun(true)
  }

  const handleContinue = () => {
    if (!activeRun) return
    setRunSource(isPlaytestReturnEnabled() ? 'dashboard' : 'normal')
    setTutorialReplayRequested((prev) => (activeRun.levelId === 'tutorial_01' ? prev : false))
    setScene('run')
  }
  const handleReset = () => {
    clearPlaytestLevel()
    setTutorialReplayRequested(false)
    clearAll()
    clearWorldProgression()
    setCurrentMissionId(null)
  }

  const returnToWorldMap = (completed: boolean) => {
    if (activeRun && runSource === 'normal') {
      const missionId = currentMissionId ?? WORLD_MISSIONS.find((mission) => mission.levelId === activeRun.levelId)?.id
      if (missionId) {
        const nextProgression = applyMissionResult(loadWorldProgression(), WORLD_MISSIONS, {
          missionId,
          completed,
          score: activeRun.daysSurvived
        })
        saveWorldProgression(nextProgression)
      }
    }

    abandonRun()
    setTutorialReplayRequested(false)
    setCurrentMissionId(null)
    setScene('worldMap')
  }

  if (scene === 'mainMenu') {
    return (
      <MainMenu
        canContinue={Boolean(activeRun)}
        canOpenDashboard={dashboardEnabled}
        onPlay={handlePlay}
        onReplayTutorial={handleReplayTutorial}
        onContinue={handleContinue}
        onDashboard={() => setScene('dashboard')}
        onReset={handleReset}
      />
    )
  }

  if (scene === 'dashboard') {
    return (
      <Dashboard
        onBack={() => setScene('mainMenu')}
        onPlaytest={(level, force) => {
          const validation = validateLevelDefinition(level)
          if (!validation.isValid && !force) return
          setPlaytestLevel(level, true)
          setRunSource('dashboard')
          setTutorialReplayRequested(false)
          setCurrentMissionId(null)
          startRun(level.id)
          setScene('run')
        }}
      />
    )
  }

  if (scene === 'worldMap') {
    return (
      <WorldMapMissionSelect
        onBack={() => setScene('mainMenu')}
        onStart={(missionId, levelId) => {
          clearPlaytestLevel()
          setRunSource('normal')
          setTutorialReplayRequested(false)
          setCurrentMissionId(missionId)
          startRun(levelId)
          setScene('run')
        }}
        onReplayTutorial={handleReplayTutorial}
      />
    )
  }

  if (!activeRun) {
    return (
      <MainMenu
        canContinue={false}
        canOpenDashboard={dashboardEnabled}
        onPlay={handlePlay}
        onReplayTutorial={handleReplayTutorial}
        onContinue={() => {}}
        onDashboard={() => setScene('dashboard')}
        onReset={handleReset}
      />
    )
  }

  if (runPhase === 'win') {
    return (
      <WinScreen
        onLevelSelect={() => {
          if (runSource === 'dashboard') {
            clearPlaytestLevel()
            setTutorialReplayRequested(false)
            setCurrentMissionId(null)
            abandonRun()
            setScene('dashboard')
            return
          }
          returnToWorldMap(true)
        }}
      />
    )
  }

  if (runPhase === 'lose') {
    return (
      <LoseScreen
        onRetry={() => {
          retryRun()
          setScene('run')
        }}
        onLevelSelect={() => {
          if (runSource === 'dashboard') {
            clearPlaytestLevel()
            setTutorialReplayRequested(false)
            setCurrentMissionId(null)
            abandonRun()
            setScene('dashboard')
            return
          }
          returnToWorldMap(false)
        }}
      />
    )
  }

  return (
    <LevelRun
      onExit={() => {
        clearPlaytestLevel()
        setRunSource('normal')
        setTutorialReplayRequested(false)
        setCurrentMissionId(null)
        abandonRun()
        setScene('worldMap')
      }}
      tutorialReplay={tutorialReplayRequested}
      onTutorialSkip={() => {
        clearPlaytestLevel()
        setRunSource('normal')
        setTutorialReplayRequested(false)
        setCurrentMissionId(null)
        abandonRun()
        setScene('worldMap')
      }}
      onBackToDashboard={
        runSource === 'dashboard'
          ? () => {
              clearPlaytestLevel()
              setTutorialReplayRequested(false)
              setCurrentMissionId(null)
              abandonRun()
              setScene('dashboard')
            }
          : undefined
      }
    />
  )
}
