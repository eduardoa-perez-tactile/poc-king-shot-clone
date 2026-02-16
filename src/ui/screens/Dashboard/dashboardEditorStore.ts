import { useSyncExternalStore } from 'react'
import { getBaseLevels, getLevels } from '../../../config/levels'
import {
  LevelDefinition,
  LevelValidationResult,
  createDefaultLevelDefinition,
  migrateLevelDefinition,
  parseLevelDefinitionJson,
  validateLevelDefinition
} from '../../../game/types/LevelDefinition'
import { replaceTuningOverrides, saveTuningOverrides } from '../../../game/tuning/tuningStore'

export type DashboardTab =
  | 'overview'
  | 'economy'
  | 'stronghold'
  | 'buildings'
  | 'units'
  | 'pads'
  | 'waves'
  | 'night_meta'
  | 'enemies'
  | 'bosses'
  | 'validation'
  | 'raw'

interface LevelHistory {
  past: LevelDefinition[]
  future: LevelDefinition[]
}

interface DashboardEditorState {
  ready: boolean
  levelsById: Record<string, LevelDefinition>
  baseLevelsById: Record<string, LevelDefinition>
  order: string[]
  selectedLevelId: string | null
  search: string
  activeTab: DashboardTab
  historyById: Record<string, LevelHistory>
  draftRevisionById: Record<string, number>
  lastPreviewRevisionById: Record<string, number>
}

const MAX_HISTORY = 50
const listeners = new Set<() => void>()

const clone = (value: LevelDefinition) => JSON.parse(JSON.stringify(value)) as LevelDefinition

const sortIds = (ids: string[], baseOrder: string[]) => {
  const baseIndex = new Map(baseOrder.map((id, index) => [id, index]))
  return ids.slice().sort((a, b) => {
    const ai = baseIndex.get(a)
    const bi = baseIndex.get(b)
    if (typeof ai === 'number' && typeof bi === 'number') return ai - bi
    if (typeof ai === 'number') return -1
    if (typeof bi === 'number') return 1
    return a.localeCompare(b)
  })
}

const toMap = (levels: LevelDefinition[]) =>
  levels.reduce((acc, level) => {
    acc[level.id] = clone(level)
    return acc
  }, {} as Record<string, LevelDefinition>)

const createRevisionMap = (ids: string[]) =>
  ids.reduce((acc, id) => {
    acc[id] = 0
    return acc
  }, {} as Record<string, number>)

const pruneRevisionMap = (map: Record<string, number>, validIds: Set<string>) =>
  Object.keys(map).reduce((acc, id) => {
    if (validIds.has(id)) acc[id] = map[id]
    return acc
  }, {} as Record<string, number>)

const buildInitialState = (): DashboardEditorState => {
  const baseLevels = getBaseLevels()
  const resolvedLevels = getLevels()
  const baseLevelsById = toMap(baseLevels)
  const levelsById = toMap(resolvedLevels)
  const ids = new Set<string>([...Object.keys(baseLevelsById), ...Object.keys(levelsById)])
  const order = sortIds(Array.from(ids), baseLevels.map((level) => level.id))
  return {
    ready: true,
    levelsById,
    baseLevelsById,
    order,
    selectedLevelId: order[0] ?? null,
    search: '',
    activeTab: 'overview',
    historyById: {},
    draftRevisionById: createRevisionMap(order),
    lastPreviewRevisionById: {}
  }
}

let state: DashboardEditorState = buildInitialState()

const emit = () => {
  listeners.forEach((listener) => listener())
}

const setState = (updater: (prev: DashboardEditorState) => DashboardEditorState) => {
  state = updater(state)
  emit()
}

const serializeLevel = (level: LevelDefinition) => JSON.stringify(level)

const appendHistory = (history: LevelHistory, snapshot: LevelDefinition): LevelHistory => ({
  past: [...history.past, clone(snapshot)].slice(-MAX_HISTORY),
  future: []
})

const ensureSelected = (next: DashboardEditorState): DashboardEditorState => {
  if (next.selectedLevelId && next.levelsById[next.selectedLevelId]) return next
  return { ...next, selectedLevelId: next.order[0] ?? null }
}

const updateLevel = (levelId: string, updater: (level: LevelDefinition) => LevelDefinition, trackHistory = true) => {
  setState((prev) => {
    const current = prev.levelsById[levelId]
    if (!current) return prev
    const nextLevel = migrateLevelDefinition(updater(clone(current)))
    if (serializeLevel(current) === serializeLevel(nextLevel)) return prev
    const nextHistory = { ...prev.historyById }
    if (trackHistory) {
      const history = nextHistory[levelId] ?? { past: [], future: [] }
      nextHistory[levelId] = appendHistory(history, current)
    }
    const nextLevelsById = { ...prev.levelsById }
    if (nextLevel.id !== levelId) {
      delete nextLevelsById[levelId]
    }
    nextLevelsById[nextLevel.id] = nextLevel
    const nextOrder =
      nextLevel.id === levelId
        ? prev.order
        : sortIds(
            prev.order.map((id) => (id === levelId ? nextLevel.id : id)),
            Object.keys(prev.baseLevelsById)
          )
    const nextDraftRevisionById = { ...prev.draftRevisionById }
    const currentRevision = nextDraftRevisionById[levelId] ?? 0
    if (nextLevel.id !== levelId) {
      delete nextDraftRevisionById[levelId]
    }
    nextDraftRevisionById[nextLevel.id] = currentRevision + 1
    const nextLastPreviewRevisionById = { ...prev.lastPreviewRevisionById }
    if (nextLevel.id !== levelId) {
      delete nextLastPreviewRevisionById[levelId]
    }
    return {
      ...prev,
      levelsById: nextLevelsById,
      historyById: nextHistory,
      order: nextOrder,
      selectedLevelId: prev.selectedLevelId === levelId ? nextLevel.id : prev.selectedLevelId,
      draftRevisionById: nextDraftRevisionById,
      lastPreviewRevisionById: nextLastPreviewRevisionById
    }
  })
}

const getOverridesFromState = (snapshot: DashboardEditorState): Record<string, LevelDefinition> => {
  const overrides: Record<string, LevelDefinition> = {}
  const baseIds = new Set(Object.keys(snapshot.baseLevelsById))
  Object.keys(snapshot.levelsById).forEach((id) => {
    const level = snapshot.levelsById[id]
    const base = snapshot.baseLevelsById[id]
    if (!base) {
      overrides[id] = clone(level)
      return
    }
    if (serializeLevel(level) !== serializeLevel(base)) {
      overrides[id] = clone(level)
    }
  })
  Object.keys(snapshot.baseLevelsById).forEach((id) => {
    if (!snapshot.levelsById[id] && baseIds.has(id)) {
      // no-op: "missing" base levels are represented by absence of override
    }
  })
  return overrides
}

export const resetDashboardEditor = () => {
  state = buildInitialState()
  emit()
}

export const subscribeDashboardEditor = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useDashboardEditorState = <T>(selector: (snapshot: DashboardEditorState) => T): T =>
  selector(
    useSyncExternalStore(
      subscribeDashboardEditor,
      () => state,
      () => state
    )
  )

export const getDashboardEditorState = () => state

export const setDashboardSearch = (search: string) => {
  setState((prev) => ({ ...prev, search }))
}

export const setDashboardTab = (activeTab: DashboardTab) => {
  setState((prev) => ({ ...prev, activeTab }))
}

export const selectDashboardLevel = (levelId: string) => {
  setState((prev) => ({ ...prev, selectedLevelId: prev.levelsById[levelId] ? levelId : prev.selectedLevelId }))
}

export const patchSelectedLevel = (updater: (level: LevelDefinition) => LevelDefinition, trackHistory = true) => {
  const selectedId = state.selectedLevelId
  if (!selectedId) return
  updateLevel(selectedId, updater, trackHistory)
}

export const setSelectedLevel = (level: LevelDefinition, trackHistory = true) => {
  const selectedId = state.selectedLevelId
  if (!selectedId) return
  const normalized = migrateLevelDefinition(level)
  updateLevel(selectedId, () => normalized, trackHistory)
}

export const createDashboardLevel = () => {
  setState((prev) => {
    const existing = new Set(Object.keys(prev.levelsById))
    let index = 1
    let id = `custom_level_${index}`
    while (existing.has(id)) {
      index += 1
      id = `custom_level_${index}`
    }
    const nextLevel = createDefaultLevelDefinition(id)
    const next = {
      ...prev,
      levelsById: { ...prev.levelsById, [id]: nextLevel },
      order: sortIds([...prev.order, id], Object.keys(prev.baseLevelsById)),
      selectedLevelId: id,
      activeTab: 'overview' as DashboardTab,
      draftRevisionById: { ...prev.draftRevisionById, [id]: 0 }
    }
    return ensureSelected(next)
  })
}

export const duplicateSelectedDashboardLevel = () => {
  const selected = state.selectedLevelId ? state.levelsById[state.selectedLevelId] : null
  if (!selected) return
  setState((prev) => {
    const existing = new Set(Object.keys(prev.levelsById))
    let index = 1
    let id = `${selected.id}_copy_${index}`
    while (existing.has(id)) {
      index += 1
      id = `${selected.id}_copy_${index}`
    }
    const duplicate = migrateLevelDefinition({
      ...clone(selected),
      id,
      name: `${selected.name} (Copy)`,
      metadata: { ...selected.metadata, id, name: `${selected.metadata.name} (Copy)` }
    })
    const next = {
      ...prev,
      levelsById: { ...prev.levelsById, [id]: duplicate },
      order: sortIds([...prev.order, id], Object.keys(prev.baseLevelsById)),
      selectedLevelId: id,
      activeTab: 'overview' as DashboardTab,
      draftRevisionById: { ...prev.draftRevisionById, [id]: 0 }
    }
    return ensureSelected(next)
  })
}

export const revertSelectedLevelToBase = () => {
  const selected = state.selectedLevelId
  if (!selected) return
  setState((prev) => {
    const base = prev.baseLevelsById[selected]
    if (base) {
      const current = prev.levelsById[selected]
      const changed = !current || serializeLevel(current) !== serializeLevel(base)
      const nextDraftRevisionById = changed
        ? {
            ...prev.draftRevisionById,
            [selected]: (prev.draftRevisionById[selected] ?? 0) + 1
          }
        : prev.draftRevisionById
      return {
        ...prev,
        levelsById: { ...prev.levelsById, [selected]: clone(base) },
        historyById: { ...prev.historyById, [selected]: { past: [], future: [] } },
        draftRevisionById: nextDraftRevisionById
      }
    }
    const nextLevels = { ...prev.levelsById }
    delete nextLevels[selected]
    const nextHistory = { ...prev.historyById }
    delete nextHistory[selected]
    const nextOrder = prev.order.filter((id) => id !== selected)
    const nextDraftRevisionById = { ...prev.draftRevisionById }
    delete nextDraftRevisionById[selected]
    const nextLastPreviewRevisionById = { ...prev.lastPreviewRevisionById }
    delete nextLastPreviewRevisionById[selected]
    return ensureSelected({
      ...prev,
      levelsById: nextLevels,
      historyById: nextHistory,
      order: nextOrder,
      draftRevisionById: nextDraftRevisionById,
      lastPreviewRevisionById: nextLastPreviewRevisionById
    })
  })
}

export const revertAllDashboardOverrides = () => {
  setState((prev) => {
    const baseLevelsById = toMap(getBaseLevels())
    const ids = Object.keys(baseLevelsById)
    return {
      ...prev,
      levelsById: baseLevelsById,
      baseLevelsById,
      order: ids,
      selectedLevelId: ids[0] ?? null,
      historyById: {},
      draftRevisionById: createRevisionMap(ids),
      lastPreviewRevisionById: {}
    }
  })
}

export const deleteSelectedOverrideOnly = () => {
  revertSelectedLevelToBase()
}

export const undoSelectedDashboardLevel = () => {
  const selected = state.selectedLevelId
  if (!selected) return
  setState((prev) => {
    const history = prev.historyById[selected]
    const current = prev.levelsById[selected]
    if (!history || history.past.length === 0 || !current) return prev
    const past = history.past.slice()
    const previous = past.pop()
    if (!previous) return prev
    return {
      ...prev,
      levelsById: { ...prev.levelsById, [selected]: clone(previous) },
      historyById: {
        ...prev.historyById,
        [selected]: {
          past,
          future: [clone(current), ...history.future].slice(0, MAX_HISTORY)
        }
      },
      draftRevisionById: {
        ...prev.draftRevisionById,
        [selected]: (prev.draftRevisionById[selected] ?? 0) + 1
      }
    }
  })
}

export const redoSelectedDashboardLevel = () => {
  const selected = state.selectedLevelId
  if (!selected) return
  setState((prev) => {
    const history = prev.historyById[selected]
    const current = prev.levelsById[selected]
    if (!history || history.future.length === 0 || !current) return prev
    const [next, ...future] = history.future
    return {
      ...prev,
      levelsById: { ...prev.levelsById, [selected]: clone(next) },
      historyById: {
        ...prev.historyById,
        [selected]: {
          past: [...history.past, clone(current)].slice(-MAX_HISTORY),
          future
        }
      },
      draftRevisionById: {
        ...prev.draftRevisionById,
        [selected]: (prev.draftRevisionById[selected] ?? 0) + 1
      }
    }
  })
}

export const getSelectedDashboardLevel = () => {
  const selected = state.selectedLevelId
  if (!selected) return null
  return state.levelsById[selected] ?? null
}

export const getSelectedDashboardBaseLevel = () => {
  const selected = state.selectedLevelId
  if (!selected) return null
  return state.baseLevelsById[selected] ?? null
}

export const validateSelectedDashboardLevel = (): LevelValidationResult => {
  const selected = getSelectedDashboardLevel()
  if (!selected) {
    return { errors: [], warnings: [], isValid: false }
  }
  return validateLevelDefinition(selected)
}

export const applySelectedLevelJson = (json: string) => {
  const selected = state.selectedLevelId
  if (!selected) {
    return { ok: false, parseError: 'No level selected.', validation: { errors: [], warnings: [], isValid: false } }
  }
  const parsed = parseLevelDefinitionJson(json)
  if (!parsed.level) return { ok: false, parseError: parsed.parseError ?? 'Invalid JSON.', validation: parsed.validation }
  setSelectedLevel(parsed.level, true)
  return { ok: true, validation: parsed.validation }
}

export const getEditorOverrides = () => getOverridesFromState(state)

export const saveDashboardOverrides = () => {
  const overrides = getOverridesFromState(state)
  const result = replaceTuningOverrides(overrides)
  saveTuningOverrides()
  return result
}

export const exportDashboardOverridesJson = () => {
  const overrides = getOverridesFromState(state)
  return JSON.stringify(
    {
      version: 1,
      savedAt: new Date().toISOString(),
      overrides
    },
    null,
    2
  )
}

export const importDashboardOverridesJson = (json: string, merge = true) => {
  let payload = {} as Record<string, unknown>
  try {
    const parsed = JSON.parse(json) as { overrides?: Record<string, unknown> } | Record<string, unknown>
    payload = parsed.overrides ?? parsed
  } catch (error) {
    return {
      imported: 0,
      rejected: [{ id: 'file', reason: error instanceof Error ? error.message : 'Invalid JSON.' }],
      validation: {} as Record<string, LevelValidationResult>
    }
  }

  const validation: Record<string, LevelValidationResult> = {}
  const rejected: Array<{ id: string; reason: string }> = []
  const imported: Record<string, LevelDefinition> = {}
  Object.keys(payload).forEach((id) => {
    const next = migrateLevelDefinition(payload[id])
    const result = validateLevelDefinition(next)
    validation[id] = result
    if (!result.isValid) {
      rejected.push({ id, reason: result.errors[0]?.message ?? 'Invalid level data.' })
      return
    }
    imported[next.id] = next
  })

  setState((prev) => {
    const currentOverrides = getOverridesFromState(prev)
    const mergedOverrides = merge ? { ...currentOverrides, ...imported } : imported
    const levelsById: Record<string, LevelDefinition> = {}
    Object.keys(prev.baseLevelsById).forEach((id) => {
      levelsById[id] = clone(mergedOverrides[id] ?? prev.baseLevelsById[id])
    })
    Object.keys(mergedOverrides).forEach((id) => {
      if (!levelsById[id]) levelsById[id] = clone(mergedOverrides[id])
    })
    const order = sortIds(Object.keys(levelsById), Object.keys(prev.baseLevelsById))
    const ids = new Set(Object.keys(levelsById))
    const nextDraftRevisionById = Object.keys(levelsById).reduce((acc, id) => {
      const previous = prev.levelsById[id]
      const changed = !previous || serializeLevel(previous) !== serializeLevel(levelsById[id])
      acc[id] = changed ? (prev.draftRevisionById[id] ?? 0) + 1 : (prev.draftRevisionById[id] ?? 0)
      return acc
    }, {} as Record<string, number>)
    return ensureSelected({
      ...prev,
      levelsById,
      order,
      historyById: {},
      draftRevisionById: nextDraftRevisionById,
      lastPreviewRevisionById: pruneRevisionMap(prev.lastPreviewRevisionById, ids)
    })
  })

  return {
    imported: Object.keys(imported).length,
    rejected,
    validation
  }
}

export const markLevelPreviewUpToDate = (levelId: string) => {
  setState((prev) => {
    if (!prev.levelsById[levelId]) return prev
    const revision = prev.draftRevisionById[levelId] ?? 0
    if (prev.lastPreviewRevisionById[levelId] === revision) return prev
    return {
      ...prev,
      lastPreviewRevisionById: {
        ...prev.lastPreviewRevisionById,
        [levelId]: revision
      }
    }
  })
}

export const markSelectedLevelPreviewUpToDate = () => {
  const selected = state.selectedLevelId
  if (!selected) return
  markLevelPreviewUpToDate(selected)
}

export const isSelectedLevelDirty = () => {
  const selected = state.selectedLevelId
  if (!selected) return false
  const current = state.levelsById[selected]
  const base = state.baseLevelsById[selected]
  if (!base) return true
  return serializeLevel(current) !== serializeLevel(base)
}
