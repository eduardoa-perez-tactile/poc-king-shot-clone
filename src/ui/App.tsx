import React, { useState } from 'react'
import { useRunStore } from '../run/store'
import { MainMenu } from './components/MainMenu'
import { LevelSelect } from './components/LevelSelect'
import { LevelRun } from './components/LevelRun'
import { WinScreen } from './components/WinScreen'
import { LoseScreen } from './components/LoseScreen'
import { Dashboard } from './screens/Dashboard/Dashboard'
import { clearPlaytestLevel, isPlaytestReturnEnabled, setPlaytestLevel } from '../game/runtime/playtest'
import { validateLevelDefinition } from '../game/types/LevelDefinition'

type Scene = 'mainMenu' | 'levelSelect' | 'dashboard' | 'run'

export const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>('mainMenu')
  const [runSource, setRunSource] = useState<'normal' | 'dashboard'>('normal')
  const { activeRun, runPhase, startRun, abandonRun, retryRun, clearAll } = useRunStore()
  const dashboardEnabled = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1'

  const handlePlay = () => setScene('levelSelect')
  const handleContinue = () => {
    if (!activeRun) return
    setRunSource(isPlaytestReturnEnabled() ? 'dashboard' : 'normal')
    setScene('run')
  }
  const handleReset = () => {
    clearPlaytestLevel()
    clearAll()
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
          startRun(level.id)
          setScene('run')
        }}
      />
    )
  }

  if (scene === 'levelSelect') {
    return (
      <LevelSelect
        onBack={() => setScene('mainMenu')}
        onStart={(levelId) => {
          clearPlaytestLevel()
          setRunSource('normal')
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
          abandonRun()
          if (runSource === 'dashboard') {
            clearPlaytestLevel()
            setScene('dashboard')
            return
          }
          setScene('levelSelect')
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
          abandonRun()
          if (runSource === 'dashboard') {
            clearPlaytestLevel()
            setScene('dashboard')
            return
          }
          setScene('levelSelect')
        }}
      />
    )
  }

  return (
    <LevelRun
      onExit={() => {
        clearPlaytestLevel()
        setRunSource('normal')
        abandonRun()
        setScene('levelSelect')
      }}
      onBackToDashboard={
        runSource === 'dashboard'
          ? () => {
              clearPlaytestLevel()
              abandonRun()
              setScene('dashboard')
            }
          : undefined
      }
    />
  )
}
