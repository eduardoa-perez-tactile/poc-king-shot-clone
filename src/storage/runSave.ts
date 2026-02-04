import { MetaState, RunPhase, RunState } from '../run/types'
import { createInitialMeta } from '../run/runState'

const STORAGE_KEY = 'roguelike3d-daycycle-save-v1'
const SAVE_VERSION = 1

interface SaveFile {
  version: number
  meta: MetaState
  activeRun: RunState | null
  runPhase: RunPhase
}

export const loadSave = (): SaveFile | null => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SaveFile
    if (!parsed.meta) {
      return { version: SAVE_VERSION, meta: createInitialMeta(), activeRun: null, runPhase: 'build' }
    }
    return parsed
  } catch (error) {
    console.warn('Failed to load save', error)
    return null
  }
}

export const saveGame = (payload: { meta: MetaState; activeRun: RunState | null; runPhase: RunPhase }) => {
  const file: SaveFile = {
    version: SAVE_VERSION,
    meta: payload.meta,
    activeRun: payload.activeRun,
    runPhase: payload.runPhase
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(file))
}

export const clearSave = () => {
  localStorage.removeItem(STORAGE_KEY)
}
