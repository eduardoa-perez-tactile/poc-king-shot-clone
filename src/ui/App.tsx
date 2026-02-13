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
import { WORLD_MISSIONS } from './worldMapData'
import { applyMissionResult, clearWorldProgression, loadWorldProgression, saveWorldProgression } from './worldProgression'

type Scene = 'mainMenu' | 'worldMap' | 'dashboard' | 'run'

export const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>('mainMenu')
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(null)
  const [runSource, setRunSource] = useState<'normal' | 'dashboard'>('normal')
  const { activeRun, runPhase, startRun, abandonRun, retryRun, clearAll } = useRunStore()
  const dashboardEnabled = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1'

  const handlePlay = () => setScene('worldMap')
  const handleContinue = () => {
    if (!activeRun) return
    setRunSource(isPlaytestReturnEnabled() ? 'dashboard' : 'normal')
    setScene('run')
  }
  const handleReset = () => {
    clearPlaytestLevel()
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
    setCurrentMissionId(null)
    setScene('worldMap')
  }

  if (scene === 'mainMenu') {
    return (
      <MainMenu
        canContinue={Boolean(activeRun)}
        canOpenDashboard={dashboardEnabled}
        onPlay={handlePlay}
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
          setCurrentMissionId(missionId)
          startRun(levelId)
          setScene('run')
        }}
      />
    )
  }

  if (!activeRun) {
    return (
      <MainMenu
        canContinue={false}
        canOpenDashboard={dashboardEnabled}
        onPlay={handlePlay}
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
        setCurrentMissionId(null)
        abandonRun()
        setScene('worldMap')
      }}
      onBackToDashboard={
        runSource === 'dashboard'
          ? () => {
              clearPlaytestLevel()
              setCurrentMissionId(null)
              abandonRun()
              setScene('dashboard')
            }
          : undefined
      }
    />
  )
}
