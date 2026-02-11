import {
  LevelDefinition,
  LevelValidationResult,
  migrateLevelDefinition,
  validateLevelDefinition
} from '../types/LevelDefinition'

const TUNING_STORAGE_KEY = 'kingshot:tuningLevels:v1'
const TUNING_SAVE_VERSION = 1

interface TuningOverridesFile {
  version: number
  savedAt: string
  overrides: Record<string, unknown>
}

export interface TuningImportResult {
  imported: number
  rejected: Array<{ id: string; reason: string }>
  validation: Record<string, LevelValidationResult>
}

let hydrated = false
let overrides: Record<string, LevelDefinition> = {}
const listeners = new Set<() => void>()

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const emit = () => {
  listeners.forEach((listener) => listener())
}

const toValidLevel = (raw: unknown): { level: LevelDefinition | null; validation: LevelValidationResult } => {
  const level = migrateLevelDefinition(raw)
  const validation = validateLevelDefinition(level)
  if (!validation.isValid) {
    return { level: null, validation }
  }
  return { level, validation }
}

const parseFile = (raw: string | null): Record<string, LevelDefinition> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as TuningOverridesFile | Record<string, unknown>
    const source = (parsed as TuningOverridesFile).overrides ?? parsed
    const candidate = source && typeof source === 'object' ? (source as Record<string, unknown>) : {}
    const next: Record<string, LevelDefinition> = {}
    Object.keys(candidate).forEach((id) => {
      const result = toValidLevel(candidate[id])
      if (result.level) {
        next[result.level.id] = result.level
      } else {
        console.warn(`Skipping invalid tuning override "${id}".`, result.validation.errors)
      }
    })
    return next
  } catch (error) {
    console.warn('Failed to parse tuning overrides.', error)
    return {}
  }
}

const ensureHydrated = () => {
  if (hydrated || !isBrowser()) return
  hydrated = true
  overrides = parseFile(localStorage.getItem(TUNING_STORAGE_KEY))
}

const writeToStorage = () => {
  if (!isBrowser()) return
  const payload: TuningOverridesFile = {
    version: TUNING_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    overrides
  }
  localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(payload))
}

export const subscribeTuningStore = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getTuningOverrides = (): Record<string, LevelDefinition> => {
  ensureHydrated()
  return { ...overrides }
}

export const getTuningOverrideById = (id: string): LevelDefinition | undefined => {
  ensureHydrated()
  return overrides[id]
}

export const setTuningOverride = (levelInput: unknown): { ok: boolean; validation: LevelValidationResult } => {
  ensureHydrated()
  const result = toValidLevel(levelInput)
  if (!result.level) {
    return { ok: false, validation: result.validation }
  }
  overrides = { ...overrides, [result.level.id]: result.level }
  emit()
  return { ok: true, validation: result.validation }
}

export const replaceTuningOverrides = (next: Record<string, unknown>): TuningImportResult => {
  ensureHydrated()
  const imported: Record<string, LevelDefinition> = {}
  const rejected: Array<{ id: string; reason: string }> = []
  const validation: Record<string, LevelValidationResult> = {}
  Object.keys(next).forEach((id) => {
    const result = toValidLevel(next[id])
    validation[id] = result.validation
    if (result.level) {
      imported[result.level.id] = result.level
      return
    }
    const reason = result.validation.errors[0]?.message ?? 'Invalid level data.'
    rejected.push({ id, reason })
  })
  overrides = imported
  emit()
  return { imported: Object.keys(imported).length, rejected, validation }
}

export const removeTuningOverride = (id: string) => {
  ensureHydrated()
  if (!overrides[id]) return
  const next = { ...overrides }
  delete next[id]
  overrides = next
  emit()
}

export const clearTuningOverridesInMemory = () => {
  ensureHydrated()
  overrides = {}
  emit()
}

export const saveTuningOverrides = () => {
  ensureHydrated()
  writeToStorage()
}

export const revertAllTuningOverrides = () => {
  ensureHydrated()
  overrides = {}
  if (isBrowser()) localStorage.removeItem(TUNING_STORAGE_KEY)
  emit()
}

export const loadTuningOverridesFromStorage = () => {
  hydrated = false
  ensureHydrated()
  emit()
}

export const exportTuningOverridesJson = () => {
  ensureHydrated()
  const payload: TuningOverridesFile = {
    version: TUNING_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    overrides
  }
  return JSON.stringify(payload, null, 2)
}

export const importTuningOverridesJson = (rawJson: string, merge = true): TuningImportResult => {
  ensureHydrated()
  let parsed: Record<string, unknown> = {}
  try {
    const payload = JSON.parse(rawJson) as TuningOverridesFile | Record<string, unknown>
    parsed = ((payload as TuningOverridesFile).overrides ?? payload) as Record<string, unknown>
  } catch (error) {
    return {
      imported: 0,
      rejected: [{ id: 'file', reason: error instanceof Error ? error.message : 'Invalid JSON.' }],
      validation: {}
    }
  }

  const target = merge ? { ...overrides, ...parsed } : parsed
  const result = replaceTuningOverrides(target)
  return result
}

export const getTuningStorageKey = () => TUNING_STORAGE_KEY
