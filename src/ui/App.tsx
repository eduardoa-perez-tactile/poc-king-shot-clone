import React, { useState } from 'react'
import { useRunStore } from '../run/store'
import { MainMenu } from './components/MainMenu'
import { LevelSelect } from './components/LevelSelect'
import { LevelRun } from './components/LevelRun'
import { WinScreen } from './components/WinScreen'
import { LoseScreen } from './components/LoseScreen'

type Scene = 'mainMenu' | 'levelSelect' | 'run'

export const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>('mainMenu')
  const { activeRun, runPhase, startRun, abandonRun, retryRun, clearAll } = useRunStore()

  const handlePlay = () => setScene('levelSelect')
  const handleContinue = () => activeRun && setScene('run')

  if (scene === 'mainMenu') {
    return (
      <MainMenu
        canContinue={Boolean(activeRun)}
        onPlay={handlePlay}
        onContinue={handleContinue}
        onReset={clearAll}
      />
    )
  }

  if (scene === 'levelSelect') {
    return (
      <LevelSelect
        onBack={() => setScene('mainMenu')}
        onStart={(levelId) => {
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
        onPlay={handlePlay}
        onContinue={() => {}}
        onReset={clearAll}
      />
    )
  }

  if (runPhase === 'win') {
    return (
      <WinScreen
        onLevelSelect={() => {
          abandonRun()
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
          setScene('levelSelect')
        }}
      />
    )
  }

  return (
    <LevelRun
      onExit={() => {
        abandonRun()
        setScene('levelSelect')
      }}
    />
  )
}
