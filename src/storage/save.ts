import { createInitialState } from '../game/logic'
import { GameState } from '../game/types'

const STORAGE_KEY = 'kingshot-prototype-save-v1'
const SAVE_VERSION = 2

interface SaveFile {
  version: number
  state: GameState
}

export const loadGame = (): GameState => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createInitialState()
  try {
    const parsed = JSON.parse(raw) as GameState | SaveFile
    if ('state' in parsed && typeof parsed.version === 'number') {
      return migrateSave(parsed.state, parsed.version)
    }
    return migrateSave(parsed as GameState, (parsed as GameState).saveVersion ?? 1)
  } catch (error) {
    console.warn('Failed to load save, starting fresh', error)
    return createInitialState()
  }
}

export const saveGame = (state: GameState) => {
  const payload: SaveFile = { version: SAVE_VERSION, state: { ...state, saveVersion: SAVE_VERSION } }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const clearSave = () => {
  localStorage.removeItem(STORAGE_KEY)
}

export const hasSave = () => Boolean(localStorage.getItem(STORAGE_KEY))

const migrateSave = (state: GameState, version: number): GameState => {
  const base = { ...state }
  if (!base.saveVersion) base.saveVersion = version
  if (!base.missions) {
    base.missions = { unlocked: 1, completed: [] }
  }
  if (version < SAVE_VERSION) {
    base.saveVersion = SAVE_VERSION
  }
  return base
}
