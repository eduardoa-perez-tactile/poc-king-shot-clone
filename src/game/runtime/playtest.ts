import type { LevelDefinition } from '../types/LevelDefinition'

let playtestLevel: LevelDefinition | null = null
let returnToDashboard = false

export const setPlaytestLevel = (level: LevelDefinition | null, shouldReturnToDashboard = false) => {
  playtestLevel = level
  returnToDashboard = Boolean(level) && shouldReturnToDashboard
}

export const getPlaytestLevel = () => playtestLevel

export const clearPlaytestLevel = () => {
  playtestLevel = null
  returnToDashboard = false
}

export const isPlaytestReturnEnabled = () => returnToDashboard
