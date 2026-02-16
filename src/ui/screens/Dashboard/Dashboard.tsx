import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BUILDING_DEFS } from '../../../config/buildings'
import { ELITE_DEFS } from '../../../config/elites'
import { DEFAULT_ELITE_CONFIG, DEFAULT_ENEMY_TRAITS, DEFAULT_NIGHT_MODIFIERS, DEFAULT_PERKS, EnemyTraitId, NightModifierId, PerkId } from '../../../config/nightContent'
import { UNIT_DEFS, UnitType } from '../../../config/units'
import { DayWave, LevelDefinition, validateLevelDefinition } from '../../../game/types/LevelDefinition'
import {
  PadType,
  buildPadUnlockLevelsFromByLevel,
  buildPadUnlocksByLevelFromLevels,
  getAllowedBuildingTypesForPadType
} from '../../../game/rules/progression'
import {
  DashboardTab,
  applySelectedLevelJson,
  createDashboardLevel,
  deleteSelectedOverrideOnly,
  duplicateSelectedDashboardLevel,
  exportDashboardOverridesJson,
  importDashboardOverridesJson,
  markLevelPreviewUpToDate,
  patchSelectedLevel,
  redoSelectedDashboardLevel,
  revertAllDashboardOverrides,
  revertSelectedLevelToBase,
  saveDashboardOverrides,
  selectDashboardLevel,
  setDashboardSearch,
  setDashboardTab,
  undoSelectedDashboardLevel,
  useDashboardEditorState
} from './dashboardEditorStore'
import { LevelPreviewModal } from './LevelPreviewModal'

type DashboardProps = {
  onBack: () => void
  onPlaytest: (level: LevelDefinition, force?: boolean) => void
}

interface DiffEntry {
  path: string
  before: string
  after: string
}

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'economy', label: 'Economy' },
  { id: 'stronghold', label: 'Stronghold & Gates' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'units', label: 'Units' },
  { id: 'pads', label: 'Pads & Build Slots' },
  { id: 'waves', label: 'Waves & Enemies' },
  { id: 'night_meta', label: 'Night Meta' },
  { id: 'enemies', label: 'Enemy Catalog' },
  { id: 'bosses', label: 'Boss Rules' },
  { id: 'validation', label: 'Validation & Diff' },
  { id: 'raw', label: 'Raw JSON' }
]

const MAX_DIFF_ROWS = 250
const PAD_TYPES: PadType[] = ['TOWER_ONLY', 'UNIT_PRODUCER', 'HERO']

const serializeValue = (value: unknown) => {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const collectDiff = (before: unknown, after: unknown, path = ''): DiffEntry[] => {
  if (deepEqual(before, after)) return []
  const beforeIsObject = before !== null && typeof before === 'object'
  const afterIsObject = after !== null && typeof after === 'object'
  if (!beforeIsObject || !afterIsObject) {
    return [{ path: path || '(root)', before: serializeValue(before), after: serializeValue(after) }]
  }
  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])
  const rows: DiffEntry[] = []
  keys.forEach((key) => {
    const nextPath = path ? `${path}.${key}` : key
    rows.push(...collectDiff(beforeRecord[key], afterRecord[key], nextPath))
  })
  return rows
}

const parseNumberInput = (value: string, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

const parseOptionalNumberInput = (value: string): number | undefined => {
  const normalized = value.trim()
  if (!normalized) return undefined
  const next = Number(normalized)
  return Number.isFinite(next) ? next : undefined
}

const parseCsvList = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  )

const normalizeWaveGroups = (wave: DayWave) =>
  (wave.groups && wave.groups.length > 0
    ? wave.groups
    : wave.units.map((group) => ({
        enemyTypeId: group.type,
        count: group.squads
      })))
    .map((group) => ({
      enemyTypeId: group.enemyTypeId,
      count: Math.max(1, Math.floor(group.count)),
      traits: group.traits ?? [],
      eliteChance: group.eliteChance
    }))

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const Dashboard: React.FC<DashboardProps> = ({ onBack, onPlaytest }) => {
  const snapshot = useDashboardEditorState((state) => state)
  const { order, levelsById, baseLevelsById, selectedLevelId, search, activeTab, historyById } = snapshot

  const selectedLevel = selectedLevelId ? levelsById[selectedLevelId] ?? null : null
  const selectedBaseLevel = useMemo(
    () => (selectedLevelId ? baseLevelsById[selectedLevelId] ?? null : null),
    [baseLevelsById, selectedLevelId]
  )
  const selectedValidation = useMemo(
    () => (selectedLevel ? validateLevelDefinition(selectedLevel) : { errors: [], warnings: [], isValid: false }),
    [selectedLevel]
  )
  const diffRows = useMemo(
    () => (selectedLevel && selectedBaseLevel ? collectDiff(selectedBaseLevel, selectedLevel).slice(0, MAX_DIFF_ROWS) : []),
    [selectedLevel, selectedBaseLevel]
  )

  const filteredIds = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return order
    return order.filter((id) => {
      const level = levelsById[id]
      if (!level) return false
      return level.id.toLowerCase().includes(query) || level.name.toLowerCase().includes(query)
    })
  }, [order, levelsById, search])

  const selectedHistory = selectedLevelId ? historyById[selectedLevelId] : undefined
  const canUndo = Boolean(selectedHistory && selectedHistory.past.length > 0)
  const canRedo = Boolean(selectedHistory && selectedHistory.future.length > 0)
  const selectedDraftRevision = selectedLevelId ? snapshot.draftRevisionById[selectedLevelId] ?? 0 : 0
  const lastPreviewRevision = selectedLevelId ? snapshot.lastPreviewRevisionById[selectedLevelId] : undefined
  const previewIsUpToDate = typeof lastPreviewRevision === 'number' && lastPreviewRevision === selectedDraftRevision

  const [waveDayIndex, setWaveDayIndex] = useState(0)
  const [rawJson, setRawJson] = useState('')
  const [rawStatus, setRawStatus] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!selectedLevel) {
      setRawJson('')
      return
    }
    setRawJson(JSON.stringify(selectedLevel, null, 2))
    setWaveDayIndex(0)
    setRawStatus(null)
  }, [selectedLevelId])

  useEffect(() => {
    if (!selectedLevel) return
    if (waveDayIndex >= selectedLevel.days.length) {
      setWaveDayIndex(Math.max(0, selectedLevel.days.length - 1))
    }
  }, [selectedLevel, waveDayIndex])

  useEffect(() => {
    setPreviewOpen(false)
  }, [selectedLevelId])

  const handleSaveOverrides = () => {
    const result = saveDashboardOverrides()
    if (result.rejected.length > 0) {
      setRawStatus(`Saved with ${result.imported} level(s). ${result.rejected.length} rejected.`)
      return
    }
    setRawStatus(`Saved ${result.imported} override level(s) to localStorage.`)
  }

  const handleImportOverrides = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const content = await file.text()
    const result = importDashboardOverridesJson(content, true)
    if (result.rejected.length > 0) {
      setRawStatus(`Imported ${result.imported}, rejected ${result.rejected.length}.`)
      return
    }
    setRawStatus(`Imported ${result.imported} override level(s).`)
  }

  const handleApplyRawJson = () => {
    const result = applySelectedLevelJson(rawJson)
    if (!result.ok) {
      setRawStatus(result.parseError ?? 'Invalid JSON.')
      return
    }
    if (result.validation.errors.length > 0) {
      setRawStatus(`Applied JSON with ${result.validation.errors.length} error(s).`)
      return
    }
    setRawStatus('Applied JSON.')
  }

  const updateLevelNumber = (
    path: 'economy.startingGold' | 'economy.endOfDayGoldBonus' | 'economy.endOfDayGoldScale' | 'economy.goldPerKill' | 'economy.buildPhaseDurationSec',
    value: number
  ) => {
    patchSelectedLevel((level) => {
      const next = { ...level, economy: { ...level.economy } }
      if (path === 'economy.startingGold') {
        next.economy.startingGold = value
        next.startGold = value
      } else if (path === 'economy.endOfDayGoldBonus') {
        next.economy.endOfDayGoldBonus = value
        next.dayRewardGold = value
      } else if (path === 'economy.endOfDayGoldScale') {
        next.economy.endOfDayGoldScale = value
        next.dayRewardScale = value
      } else if (path === 'economy.goldPerKill') {
        next.economy.goldPerKill = value
      } else {
        next.economy.buildPhaseDurationSec = value
      }
      return next
    })
  }

  const updateStrongholdUnlocksByLevel = (nextByLevel: Record<string, string[]>) => {
    patchSelectedLevel((level) => {
      const normalizedByLevel: Record<string, string[]> = {}
      Object.keys(nextByLevel).forEach((levelKey) => {
        const ids = nextByLevel[levelKey] ?? []
        normalizedByLevel[levelKey] = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)))
      })
      return {
        ...level,
        stronghold: {
          ...level.stronghold,
          padUnlocksByLevel: normalizedByLevel,
          padUnlockLevels: buildPadUnlockLevelsFromByLevel(normalizedByLevel)
        }
      }
    })
  }

  if (!selectedLevel) {
    return (
      <div className="screen dashboard-screen">
        <div className="top-bar">
          <h2>Dashboard</h2>
          <button className="btn" onClick={onBack}>Back</button>
        </div>
        <div className="panel">No levels available.</div>
      </div>
    )
  }

  const currentDay = selectedLevel.days[waveDayIndex]
  const nightModifiers = selectedLevel.nightModifiers ?? []
  const perks = selectedLevel.perks ?? []
  const enemyTraits = selectedLevel.enemyTraits ?? []
  const nightModifierIds = nightModifiers.map((entry) => entry.id)
  const perkIds = perks.map((entry) => entry.id)
  const enemyTraitIds = enemyTraits.map((entry) => entry.id)
  const availableNightIndices = Array.from(
    new Set(selectedLevel.days.map((day) => Math.max(1, Math.floor(day.day))))
  ).sort((a, b) => a - b)

  return (
    <div className="screen dashboard-screen">
      <div className="top-bar">
        <div>
          <h2>Game Dashboard</h2>
          <div className="muted">Dev tuning workspace (local edits until Save Overrides).</div>
        </div>
        <div className="button-row">
          <button className="btn" onClick={onBack}>Back</button>
        </div>
      </div>

      <div className="dashboard-layout">
        <aside className="panel dashboard-sidebar">
          <div className="dashboard-sidebar-actions">
            <input
              value={search}
              onChange={(event) => setDashboardSearch(event.target.value)}
              placeholder="Search levels"
            />
            <div className="button-row">
              <button className="btn success" onClick={createDashboardLevel}>New</button>
              <button className="btn" onClick={duplicateSelectedDashboardLevel}>Duplicate</button>
              <button className="btn ghost" onClick={deleteSelectedOverrideOnly}>Delete/Revert</button>
            </div>
          </div>
          <div className="dashboard-level-list">
            {filteredIds.map((id) => {
              const level = levelsById[id]
              if (!level) return null
              const active = id === selectedLevelId
              const base = baseLevelsById[id]
              const dirty = !base || !deepEqual(level, base)
              return (
                <button
                  key={id}
                  className={`dashboard-level-item ${active ? 'active' : ''}`}
                  onClick={() => selectDashboardLevel(id)}
                >
                  <span>{level.name}</span>
                  <span className="muted">{level.id}{dirty ? ' *' : ''}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="panel dashboard-main">
          <div className="dashboard-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`btn ${activeTab === tab.id ? 'primary' : ''}`}
                onClick={() => setDashboardTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="dashboard-section-grid">
              <label>
                <span className="muted">Level ID</span>
                <input
                  value={selectedLevel.id}
                  onChange={(event) => {
                    const id = event.target.value.trim()
                    patchSelectedLevel((level) => ({
                      ...level,
                      id,
                      metadata: { ...level.metadata, id }
                    }))
                  }}
                />
              </label>
              <label>
                <span className="muted">Name</span>
                <input
                  value={selectedLevel.name}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      name: event.target.value,
                      metadata: { ...level.metadata, name: event.target.value }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Difficulty</span>
                <input
                  value={selectedLevel.metadata.difficulty}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      metadata: { ...level.metadata, difficulty: event.target.value }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Biome</span>
                <input
                  value={selectedLevel.metadata.biome}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      metadata: { ...level.metadata, biome: event.target.value }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Theme</span>
                <input
                  value={selectedLevel.metadata.theme}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      metadata: { ...level.metadata, theme: event.target.value }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Seed</span>
                <input
                  value={selectedLevel.metadata.seed ?? ''}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      metadata: { ...level.metadata, seed: event.target.value ? parseNumberInput(event.target.value, 0) : undefined }
                    }))
                  }
                />
              </label>
              <label className="dashboard-full-width">
                <span className="muted">Description</span>
                <textarea
                  value={selectedLevel.description}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      description: event.target.value,
                      metadata: { ...level.metadata, description: event.target.value }
                    }))
                  }
                />
              </label>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="dashboard-section-grid">
              <label>
                <span className="muted">Starting Gold</span>
                <input
                  value={selectedLevel.economy.startingGold}
                  onChange={(event) => updateLevelNumber('economy.startingGold', parseNumberInput(event.target.value, selectedLevel.economy.startingGold))}
                />
              </label>
              <label>
                <span className="muted">Gold Per Kill</span>
                <input
                  value={selectedLevel.economy.goldPerKill}
                  onChange={(event) => updateLevelNumber('economy.goldPerKill', parseNumberInput(event.target.value, selectedLevel.economy.goldPerKill))}
                />
              </label>
              <label>
                <span className="muted">End of Day Gold</span>
                <input
                  value={selectedLevel.economy.endOfDayGoldBonus}
                  onChange={(event) =>
                    updateLevelNumber('economy.endOfDayGoldBonus', parseNumberInput(event.target.value, selectedLevel.economy.endOfDayGoldBonus))
                  }
                />
              </label>
              <label>
                <span className="muted">End of Day Scale</span>
                <input
                  value={selectedLevel.economy.endOfDayGoldScale}
                  onChange={(event) =>
                    updateLevelNumber('economy.endOfDayGoldScale', parseNumberInput(event.target.value, selectedLevel.economy.endOfDayGoldScale))
                  }
                />
              </label>
              <label>
                <span className="muted">Build Phase Duration (sec)</span>
                <input
                  value={selectedLevel.economy.buildPhaseDurationSec}
                  onChange={(event) =>
                    updateLevelNumber('economy.buildPhaseDurationSec', parseNumberInput(event.target.value, selectedLevel.economy.buildPhaseDurationSec))
                  }
                />
              </label>
            </div>
          )}

          {activeTab === 'stronghold' && (
            <div className="dashboard-section-grid">
              <label>
                <span className="muted">Starting Stronghold Level</span>
                <input
                  value={selectedLevel.stronghold.startingLevel}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      stronghold: { ...level.stronghold, startingLevel: parseNumberInput(event.target.value, level.stronghold.startingLevel) }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Stronghold Max Level</span>
                <input
                  value={selectedLevel.stronghold.maxLevel}
                  onChange={(event) =>
                    patchSelectedLevel((level) => {
                      const nextMaxLevel = Math.max(1, parseNumberInput(event.target.value, level.stronghold.maxLevel))
                      const nextByLevel: Record<string, string[]> = {}
                      for (let lv = 1; lv <= nextMaxLevel; lv += 1) {
                        const key = String(lv)
                        nextByLevel[key] = (level.stronghold.padUnlocksByLevel[key] ?? []).slice()
                      }
                      return {
                        ...level,
                        stronghold: {
                          ...level.stronghold,
                          maxLevel: nextMaxLevel,
                          padUnlocksByLevel: nextByLevel,
                          padUnlockLevels: buildPadUnlockLevelsFromByLevel(nextByLevel)
                        }
                      }
                    })
                  }
                />
              </label>
              <label>
                <span className="muted">Global Building Level Cap</span>
                <input
                  value={selectedLevel.stronghold.globalMaxBuildingLevelCap}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      stronghold: {
                        ...level.stronghold,
                        globalMaxBuildingLevelCap: parseNumberInput(event.target.value, level.stronghold.globalMaxBuildingLevelCap)
                      }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Producer Unit Cap per Stronghold Level</span>
                <input
                  value={selectedLevel.stronghold.producerUnitCapPerStrongholdLevel}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      stronghold: {
                        ...level.stronghold,
                        producerUnitCapPerStrongholdLevel: parseNumberInput(
                          event.target.value,
                          level.stronghold.producerUnitCapPerStrongholdLevel
                        )
                      }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Recruiter Unlock Level</span>
                <input
                  value={selectedLevel.stronghold.recruiterUnlockLevel}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      stronghold: {
                        ...level.stronghold,
                        recruiterUnlockLevel: parseNumberInput(event.target.value, level.stronghold.recruiterUnlockLevel)
                      }
                    }))
                  }
                />
              </label>
              <div className="dashboard-full-width dashboard-row-card">
                <h3>Pad Unlocks by Stronghold Level</h3>
                <div className="dashboard-stack">
                  {Array.from({ length: Math.max(1, selectedLevel.stronghold.maxLevel) }, (_, idx) => {
                    const unlockLevel = idx + 1
                    const levelKey = String(unlockLevel)
                    const ids = selectedLevel.stronghold.padUnlocksByLevel[levelKey] ?? []
                    return (
                      <label key={levelKey}>
                        <span className="muted">Lv {unlockLevel} unlock pad IDs (comma separated)</span>
                        <input
                          value={ids.join(',')}
                          onChange={(event) => {
                            const nextByLevel = { ...selectedLevel.stronghold.padUnlocksByLevel }
                            nextByLevel[levelKey] = event.target.value
                              .split(',')
                              .map((value) => value.trim())
                              .filter((value) => value.length > 0)
                            updateStrongholdUnlocksByLevel(nextByLevel)
                          }}
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'buildings' && (
            <div className="dashboard-stack">
              {Object.values(selectedLevel.buildings).map((building) => (
                <div key={building.id} className="dashboard-row-card">
                  <div className="dashboard-inline-grid">
                    <label>
                      <span className="muted">{building.id} Base Cost</span>
                      <input
                        value={building.baseCost}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            buildings: {
                              ...level.buildings,
                              [building.id]: {
                                ...level.buildings[building.id],
                                baseCost: parseNumberInput(event.target.value, building.baseCost)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Upgrade Base</span>
                      <input
                        value={building.upgradeBase}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            buildings: {
                              ...level.buildings,
                              [building.id]: {
                                ...level.buildings[building.id],
                                upgradeBase: parseNumberInput(event.target.value, building.upgradeBase)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Upgrade Scale</span>
                      <input
                        value={building.upgradeScale}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            buildings: {
                              ...level.buildings,
                              [building.id]: {
                                ...level.buildings[building.id],
                                upgradeScale: parseNumberInput(event.target.value, building.upgradeScale)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Max Level</span>
                      <input
                        value={building.maxLevel}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            buildings: {
                              ...level.buildings,
                              [building.id]: {
                                ...level.buildings[building.id],
                                maxLevel: parseNumberInput(event.target.value, building.maxLevel)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      patchSelectedLevel((level) => {
                        const base = selectedBaseLevel?.buildings[building.id]
                        if (!base) return level
                        return {
                          ...level,
                          buildings: {
                            ...level.buildings,
                            [building.id]: { ...base }
                          }
                        }
                      })
                    }
                  >
                    Reset Row to Base
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'units' && (
            <div className="dashboard-stack">
              <div className="dashboard-row-card">
                <h3>Producer Defaults</h3>
                <div className="dashboard-inline-grid">
                  <label>
                    <span className="muted">Units on Build</span>
                    <input
                      value={selectedLevel.producerDefaults.unitsOnBuild}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          producerDefaults: {
                            ...level.producerDefaults,
                            unitsOnBuild: parseNumberInput(event.target.value, level.producerDefaults.unitsOnBuild)
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Units per Upgrade Level</span>
                    <input
                      value={selectedLevel.producerDefaults.unitsPerUpgradeLevel}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          producerDefaults: {
                            ...level.producerDefaults,
                            unitsPerUpgradeLevel: parseNumberInput(event.target.value, level.producerDefaults.unitsPerUpgradeLevel)
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Health Mult/Level</span>
                    <input
                      value={selectedLevel.producerDefaults.unitStatScalingPerLevel.healthMultPerLevel}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          producerDefaults: {
                            ...level.producerDefaults,
                            unitStatScalingPerLevel: {
                              ...level.producerDefaults.unitStatScalingPerLevel,
                              healthMultPerLevel: parseNumberInput(
                                event.target.value,
                                level.producerDefaults.unitStatScalingPerLevel.healthMultPerLevel
                              )
                            }
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Damage Mult/Level</span>
                    <input
                      value={selectedLevel.producerDefaults.unitStatScalingPerLevel.damageMultPerLevel}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          producerDefaults: {
                            ...level.producerDefaults,
                            unitStatScalingPerLevel: {
                              ...level.producerDefaults.unitStatScalingPerLevel,
                              damageMultPerLevel: parseNumberInput(
                                event.target.value,
                                level.producerDefaults.unitStatScalingPerLevel.damageMultPerLevel
                              )
                            }
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Attack Speed Mult/Level</span>
                    <input
                      value={selectedLevel.producerDefaults.unitStatScalingPerLevel.attackSpeedMultPerLevel}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          producerDefaults: {
                            ...level.producerDefaults,
                            unitStatScalingPerLevel: {
                              ...level.producerDefaults.unitStatScalingPerLevel,
                              attackSpeedMultPerLevel: parseNumberInput(
                                event.target.value,
                                level.producerDefaults.unitStatScalingPerLevel.attackSpeedMultPerLevel
                              )
                            }
                          }
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
              {Object.values(selectedLevel.units).map((unit) => (
                <div key={unit.type} className="dashboard-row-card">
                  <div className="dashboard-inline-grid">
                    <label>
                      <span className="muted">{unit.type} Cost</span>
                      <input
                        value={unit.baseCost}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            units: {
                              ...level.units,
                              [unit.type]: {
                                ...level.units[unit.type],
                                baseCost: parseNumberInput(event.target.value, unit.baseCost)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Squad Size</span>
                      <input
                        value={unit.squadSize}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            units: {
                              ...level.units,
                              [unit.type]: {
                                ...level.units[unit.type],
                                squadSize: parseNumberInput(event.target.value, unit.squadSize)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Production Time</span>
                      <input
                        value={unit.productionTimeSec}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            units: {
                              ...level.units,
                              [unit.type]: {
                                ...level.units[unit.type],
                                productionTimeSec: parseNumberInput(event.target.value, unit.productionTimeSec)
                              }
                            }
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Cap per Producer per Stronghold Lv</span>
                      <input
                        value={unit.capPerProducerPerStrongholdLevel}
                        onChange={(event) =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            units: {
                              ...level.units,
                              [unit.type]: {
                                ...level.units[unit.type],
                                capPerProducerPerStrongholdLevel: parseNumberInput(
                                  event.target.value,
                                  unit.capPerProducerPerStrongholdLevel
                                )
                              }
                            }
                          }))
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      patchSelectedLevel((level) => {
                        const base = selectedBaseLevel?.units[unit.type]
                        if (!base) return level
                        return {
                          ...level,
                          units: {
                            ...level.units,
                            [unit.type]: { ...base }
                          }
                        }
                      })
                    }
                  >
                    Reset Row to Base
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'pads' && (
            <div className="dashboard-stack">
              <div className="dashboard-row-card">
                <h3>Pad Constraints</h3>
                <div className="dashboard-inline-grid">
                  <label>
                    <span className="muted">Min Tower Pads</span>
                    <input
                      value={selectedLevel.padConstraints.minTowerPads}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          padConstraints: {
                            ...level.padConstraints,
                            minTowerPads: parseNumberInput(event.target.value, level.padConstraints.minTowerPads)
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Max Unit Producer Pads</span>
                    <input
                      value={selectedLevel.padConstraints.maxUnitProducerPads}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          padConstraints: {
                            ...level.padConstraints,
                            maxUnitProducerPads: parseNumberInput(event.target.value, level.padConstraints.maxUnitProducerPads)
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">Max Hero Pads</span>
                    <input
                      value={selectedLevel.padConstraints.maxHeroPads}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          padConstraints: {
                            ...level.padConstraints,
                            maxHeroPads: parseNumberInput(event.target.value, level.padConstraints.maxHeroPads)
                          }
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="button-row">
                <button
                  className="btn success"
                  onClick={() =>
                    patchSelectedLevel((level) => {
                      const nextId = `pad_${level.buildingPads.length + 1}`
                      const nextPadUnlockLevels = { ...level.stronghold.padUnlockLevels, [nextId]: 1 }
                      return {
                        ...level,
                        buildingPads: [
                          ...level.buildingPads,
                          {
                            id: nextId,
                            x: 0,
                            y: 0,
                            padType: 'TOWER_ONLY',
                            allowedTypes: getAllowedBuildingTypesForPadType('TOWER_ONLY')
                          }
                        ],
                        stronghold: {
                          ...level.stronghold,
                          padUnlockLevels: nextPadUnlockLevels,
                          padUnlocksByLevel: buildPadUnlocksByLevelFromLevels(nextPadUnlockLevels)
                        }
                      }
                    })
                  }
                >
                  Add Pad
                </button>
                <button className="btn primary" onClick={() => setPreviewOpen(true)}>Generate Preview</button>
                <span className={`dashboard-preview-status ${previewIsUpToDate ? 'up' : 'out'}`}>
                  {previewIsUpToDate ? 'Preview up to date' : 'Preview out of date'}
                </span>
              </div>
              {selectedLevel.buildingPads.map((pad, index) => (
                <div key={`${pad.id}_${index}`} className="dashboard-row-card">
                  <div className="dashboard-inline-grid">
                    <label>
                      <span className="muted">Pad ID</span>
                      <input
                        value={pad.id}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const nextPads = level.buildingPads.slice()
                            const previousId = nextPads[index].id
                            const nextId = event.target.value
                            nextPads[index] = { ...nextPads[index], id: nextId }
                            const nextPadUnlockLevels = { ...level.stronghold.padUnlockLevels }
                            if (previousId !== nextId && nextPadUnlockLevels[previousId] !== undefined) {
                              nextPadUnlockLevels[nextId] = nextPadUnlockLevels[previousId]
                              delete nextPadUnlockLevels[previousId]
                            }
                            return {
                              ...level,
                              buildingPads: nextPads,
                              stronghold: {
                                ...level.stronghold,
                                padUnlockLevels: nextPadUnlockLevels,
                                padUnlocksByLevel: buildPadUnlocksByLevelFromLevels(nextPadUnlockLevels)
                              }
                            }
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">X</span>
                      <input
                        value={pad.x}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const nextPads = level.buildingPads.slice()
                            nextPads[index] = { ...nextPads[index], x: parseNumberInput(event.target.value, pad.x) }
                            return { ...level, buildingPads: nextPads }
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Y</span>
                      <input
                        value={pad.y}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const nextPads = level.buildingPads.slice()
                            nextPads[index] = { ...nextPads[index], y: parseNumberInput(event.target.value, pad.y) }
                            return { ...level, buildingPads: nextPads }
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Pad Type</span>
                      <select
                        value={pad.padType}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const nextPads = level.buildingPads.slice()
                            const nextPadType = event.target.value as PadType
                            nextPads[index] = {
                              ...nextPads[index],
                              padType: nextPadType,
                              allowedTypes: getAllowedBuildingTypesForPadType(nextPadType)
                            }
                            return { ...level, buildingPads: nextPads }
                          })
                        }
                      >
                        {PAD_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="muted">Unlock at Stronghold Lv</span>
                      <input
                        value={selectedLevel.stronghold.padUnlockLevels[pad.id] ?? 1}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const unlockLevel = Math.max(1, parseNumberInput(event.target.value, 1))
                            const nextPadUnlockLevels = { ...level.stronghold.padUnlockLevels, [pad.id]: unlockLevel }
                            return {
                              ...level,
                              stronghold: {
                                ...level.stronghold,
                                padUnlockLevels: nextPadUnlockLevels,
                                padUnlocksByLevel: buildPadUnlocksByLevelFromLevels(nextPadUnlockLevels)
                              }
                            }
                          })
                        }
                      />
                    </label>
                    <label className="dashboard-full-width">
                      <span className="muted">Allowed Building Types (comma separated)</span>
                      <input
                        value={pad.allowedTypes.join(',')}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const nextPads = level.buildingPads.slice()
                            const allowedTypes = event.target.value
                              .split(',')
                              .map((value) => value.trim())
                              .filter((value): value is keyof typeof BUILDING_DEFS => Boolean(BUILDING_DEFS[value as keyof typeof BUILDING_DEFS]))
                              .filter((value) =>
                                getAllowedBuildingTypesForPadType(nextPads[index].padType).includes(value as keyof typeof BUILDING_DEFS)
                              )
                            nextPads[index] = { ...nextPads[index], allowedTypes }
                            return { ...level, buildingPads: nextPads }
                          })
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      patchSelectedLevel((level) => {
                        const nextPads = level.buildingPads.filter((_, padIndex) => padIndex !== index)
                        const removedPadId = level.buildingPads[index]?.id
                        const nextPadUnlockLevels = { ...level.stronghold.padUnlockLevels }
                        if (removedPadId) delete nextPadUnlockLevels[removedPadId]
                        return {
                          ...level,
                          buildingPads: nextPads,
                          stronghold: {
                            ...level.stronghold,
                            padUnlockLevels: nextPadUnlockLevels,
                            padUnlocksByLevel: buildPadUnlocksByLevelFromLevels(nextPadUnlockLevels)
                          }
                        }
                      })
                    }
                  >
                    Remove Pad
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'waves' && (
            <div className="dashboard-stack">
              <div className="button-row">
                <label>
                  <span className="muted">Day</span>
                  <select value={waveDayIndex} onChange={(event) => setWaveDayIndex(Number(event.target.value))}>
                    {selectedLevel.days.map((day, index) => (
                      <option key={day.day} value={index}>
                        Day {day.day}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn"
                  onClick={() =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      days: [
                        ...level.days,
                        {
                          day: level.days.length + 1,
                          waveMode: 'sequential',
                          waveDelaySec: 6,
                          enemyModifiers: { hpMultiplier: 1, attackMultiplier: 1 },
                          miniBossAfterWave: 2,
                          waves: [{ id: `d${level.days.length + 1}_w1`, units: [{ type: 'infantry', squads: 2 }] }]
                        }
                      ]
                    }))
                  }
                >
                  Add Day
                </button>
                <button
                  className="btn ghost"
                  onClick={() =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      days: level.days.length > 1 ? level.days.filter((_, index) => index !== waveDayIndex) : level.days
                    }))
                  }
                >
                  Remove Day
                </button>
              </div>

              {currentDay && (
                <div className="dashboard-row-card">
                  <div className="dashboard-inline-grid">
                    <label>
                      <span className="muted">Wave Delay (sec)</span>
                      <input
                        value={currentDay.waveDelaySec ?? 6}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const days = level.days.slice()
                            days[waveDayIndex] = {
                              ...days[waveDayIndex],
                              waveDelaySec: parseNumberInput(event.target.value, currentDay.waveDelaySec ?? 6)
                            }
                            return { ...level, days }
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Mini-boss After Wave</span>
                      <input
                        value={currentDay.day === 1 ? 'disabled (day 1 override)' : (currentDay.miniBossAfterWave ?? 2)}
                        disabled={currentDay.day === 1}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const days = level.days.slice()
                            days[waveDayIndex] = {
                              ...days[waveDayIndex],
                              miniBossAfterWave: parseNumberInput(event.target.value, currentDay.miniBossAfterWave ?? 2)
                            }
                            return { ...level, days }
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}

              {currentDay?.waves.map((wave, waveIndex) => {
                const normalizedGroups = normalizeWaveGroups(wave)
                const usingAdvancedGroups = Array.isArray(wave.groups) && wave.groups.length > 0
                return (
                  <div key={`${wave.id}_${waveIndex}`} className="dashboard-row-card">
                    <div className="button-row">
                      <input
                        value={wave.id}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const days = level.days.slice()
                            const waves = days[waveDayIndex].waves.slice()
                            waves[waveIndex] = { ...waves[waveIndex], id: event.target.value }
                            days[waveDayIndex] = { ...days[waveDayIndex], waves }
                            return { ...level, days }
                          })
                        }
                      />
                      <button
                        className="btn"
                        onClick={() =>
                          patchSelectedLevel((level) => {
                            const days = level.days.slice()
                            const waves = days[waveDayIndex].waves.slice()
                            waves.splice(waveIndex + 1, 0, {
                              ...waves[waveIndex],
                              id: `${waves[waveIndex].id}_copy`
                            })
                            days[waveDayIndex] = { ...days[waveDayIndex], waves }
                            return { ...level, days }
                          })
                        }
                      >
                        Duplicate Wave
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          patchSelectedLevel((level) => {
                            const days = level.days.slice()
                            const waves = days[waveDayIndex].waves.filter((_, index) => index !== waveIndex)
                            days[waveDayIndex] = { ...days[waveDayIndex], waves }
                            return { ...level, days }
                          })
                        }
                      >
                        Remove Wave
                      </button>
                    </div>

                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">Wave Traits (comma separated IDs)</span>
                        <input
                          value={(wave.traits ?? []).join(',')}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const days = level.days.slice()
                              const waves = days[waveDayIndex].waves.slice()
                              waves[waveIndex] = {
                                ...waves[waveIndex],
                                traits: parseCsvList(event.target.value).filter((id): id is EnemyTraitId => enemyTraitIds.includes(id))
                              }
                              days[waveDayIndex] = { ...days[waveDayIndex], waves }
                              return { ...level, days }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Wave Elite Chance (0..1)</span>
                        <input
                          value={wave.eliteChance ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const days = level.days.slice()
                              const waves = days[waveDayIndex].waves.slice()
                              waves[waveIndex] = {
                                ...waves[waveIndex],
                                eliteChance: parseOptionalNumberInput(event.target.value)
                              }
                              days[waveDayIndex] = { ...days[waveDayIndex], waves }
                              return { ...level, days }
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="dashboard-row-card">
                      <h3>Legacy Spawn Units</h3>
                      <div className="muted">Used when advanced groups are empty.</div>
                      {wave.units.map((group, groupIndex) => (
                        <div key={`${wave.id}_${groupIndex}`} className="dashboard-inline-grid">
                          <label>
                            <span className="muted">Enemy Type</span>
                            <select
                              value={group.type}
                              onChange={(event) =>
                                patchSelectedLevel((level) => {
                                  const days = level.days.slice()
                                  const waves = days[waveDayIndex].waves.slice()
                                  const units = waves[waveIndex].units.slice()
                                  units[groupIndex] = { ...units[groupIndex], type: event.target.value as UnitType }
                                  waves[waveIndex] = { ...waves[waveIndex], units }
                                  days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                  return { ...level, days }
                                })
                              }
                            >
                              {Object.keys(UNIT_DEFS).map((unitType) => (
                                <option key={unitType} value={unitType}>{unitType}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="muted">Count</span>
                            <input
                              value={group.squads}
                              onChange={(event) =>
                                patchSelectedLevel((level) => {
                                  const days = level.days.slice()
                                  const waves = days[waveDayIndex].waves.slice()
                                  const units = waves[waveIndex].units.slice()
                                  units[groupIndex] = { ...units[groupIndex], squads: parseNumberInput(event.target.value, group.squads) }
                                  waves[waveIndex] = { ...waves[waveIndex], units }
                                  days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                  return { ...level, days }
                                })
                              }
                            />
                          </label>
                          <button
                            className="btn ghost"
                            onClick={() =>
                              patchSelectedLevel((level) => {
                                const days = level.days.slice()
                                const waves = days[waveDayIndex].waves.slice()
                                const units = waves[waveIndex].units.filter((_, index) => index !== groupIndex)
                                waves[waveIndex] = { ...waves[waveIndex], units }
                                days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                return { ...level, days }
                              })
                            }
                          >
                            Remove Legacy Group
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn"
                        onClick={() =>
                          patchSelectedLevel((level) => {
                            const days = level.days.slice()
                            const waves = days[waveDayIndex].waves.slice()
                            waves[waveIndex] = {
                              ...waves[waveIndex],
                              units: [...waves[waveIndex].units, { type: 'infantry', squads: 1 }]
                            }
                            days[waveDayIndex] = { ...days[waveDayIndex], waves }
                            return { ...level, days }
                          })
                        }
                      >
                        Add Legacy Group
                      </button>
                    </div>

                    <div className="dashboard-row-card">
                      <h3>Advanced Spawn Groups</h3>
                      <div className="muted">
                        These groups support traits and elite chance per enemy group.
                        {usingAdvancedGroups ? '' : ' Currently using legacy groups as fallback preview.'}
                      </div>
                      <div className="button-row">
                        <button
                          className="btn"
                          onClick={() =>
                            patchSelectedLevel((level) => {
                              const days = level.days.slice()
                              const waves = days[waveDayIndex].waves.slice()
                              waves[waveIndex] = {
                                ...waves[waveIndex],
                                groups: normalizeWaveGroups(waves[waveIndex])
                              }
                              days[waveDayIndex] = { ...days[waveDayIndex], waves }
                              return { ...level, days }
                            })
                          }
                        >
                          Copy Legacy Units to Groups
                        </button>
                        <button
                          className="btn"
                          onClick={() =>
                            patchSelectedLevel((level) => {
                              const days = level.days.slice()
                              const waves = days[waveDayIndex].waves.slice()
                              const groups = normalizeWaveGroups(waves[waveIndex])
                              groups.push({ enemyTypeId: 'infantry', count: 1, traits: [], eliteChance: undefined })
                              waves[waveIndex] = { ...waves[waveIndex], groups }
                              days[waveDayIndex] = { ...days[waveDayIndex], waves }
                              return { ...level, days }
                            })
                          }
                        >
                          Add Advanced Group
                        </button>
                      </div>

                      {normalizedGroups.map((group, groupIndex) => (
                        <div key={`${wave.id}_advanced_${groupIndex}`} className="dashboard-inline-grid">
                          <label>
                            <span className="muted">Enemy Type</span>
                            <select
                              value={group.enemyTypeId}
                              onChange={(event) =>
                                patchSelectedLevel((level) => {
                                  const days = level.days.slice()
                                  const waves = days[waveDayIndex].waves.slice()
                                  const groups = normalizeWaveGroups(waves[waveIndex])
                                  groups[groupIndex] = { ...groups[groupIndex], enemyTypeId: event.target.value as UnitType }
                                  waves[waveIndex] = { ...waves[waveIndex], groups }
                                  days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                  return { ...level, days }
                                })
                              }
                            >
                              {Object.keys(UNIT_DEFS).map((unitType) => (
                                <option key={unitType} value={unitType}>{unitType}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span className="muted">Count</span>
                            <input
                              value={group.count}
                              onChange={(event) =>
                                patchSelectedLevel((level) => {
                                  const days = level.days.slice()
                                  const waves = days[waveDayIndex].waves.slice()
                                  const groups = normalizeWaveGroups(waves[waveIndex])
                                  groups[groupIndex] = {
                                    ...groups[groupIndex],
                                    count: Math.max(1, parseNumberInput(event.target.value, group.count))
                                  }
                                  waves[waveIndex] = { ...waves[waveIndex], groups }
                                  days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                  return { ...level, days }
                                })
                              }
                            />
                          </label>
                          <label>
                            <span className="muted">Traits (comma separated IDs)</span>
                            <input
                              value={(group.traits ?? []).join(',')}
                              onChange={(event) =>
                                patchSelectedLevel((level) => {
                                  const days = level.days.slice()
                                  const waves = days[waveDayIndex].waves.slice()
                                  const groups = normalizeWaveGroups(waves[waveIndex])
                                  groups[groupIndex] = {
                                    ...groups[groupIndex],
                                    traits: parseCsvList(event.target.value).filter((id): id is EnemyTraitId => enemyTraitIds.includes(id))
                                  }
                                  waves[waveIndex] = { ...waves[waveIndex], groups }
                                  days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                  return { ...level, days }
                                })
                              }
                            />
                          </label>
                          <label>
                            <span className="muted">Elite Chance (0..1)</span>
                            <input
                              value={group.eliteChance ?? ''}
                              onChange={(event) =>
                                patchSelectedLevel((level) => {
                                  const days = level.days.slice()
                                  const waves = days[waveDayIndex].waves.slice()
                                  const groups = normalizeWaveGroups(waves[waveIndex])
                                  groups[groupIndex] = {
                                    ...groups[groupIndex],
                                    eliteChance: parseOptionalNumberInput(event.target.value)
                                  }
                                  waves[waveIndex] = { ...waves[waveIndex], groups }
                                  days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                  return { ...level, days }
                                })
                              }
                            />
                          </label>
                          <button
                            className="btn ghost"
                            onClick={() =>
                              patchSelectedLevel((level) => {
                                const days = level.days.slice()
                                const waves = days[waveDayIndex].waves.slice()
                                const groups = normalizeWaveGroups(waves[waveIndex]).filter((_, idx) => idx !== groupIndex)
                                waves[waveIndex] = { ...waves[waveIndex], groups: groups.length > 0 ? groups : undefined }
                                days[waveDayIndex] = { ...days[waveDayIndex], waves }
                                return { ...level, days }
                              })
                            }
                          >
                            Remove Advanced Group
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <button
                className="btn success"
                onClick={() =>
                  patchSelectedLevel((level) => {
                    const days = level.days.slice()
                    const day = days[waveDayIndex]
                    days[waveDayIndex] = {
                      ...day,
                      waves: [...day.waves, { id: `d${day.day}_w${day.waves.length + 1}`, units: [{ type: 'infantry', squads: 2 }] }]
                    }
                    return { ...level, days }
                  })
                }
              >
                Add Wave
              </button>
            </div>
          )}

          {activeTab === 'night_meta' && (
            <div className="dashboard-stack">
              <div className="dashboard-row-card">
                <h3>Night Modifier Pools</h3>
                <div className="button-row">
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        nightModifiers: DEFAULT_NIGHT_MODIFIERS.map((entry) => ({ ...entry, effects: { ...entry.effects } }))
                      }))
                    }
                  >
                    Reset Night Modifiers to Defaults
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        nightModifiers: [
                          ...(level.nightModifiers ?? []),
                          {
                            id: `modifier_${(level.nightModifiers ?? []).length + 1}`,
                            name: 'New Modifier',
                            description: 'Custom night modifier.',
                            rewardMultiplier: 1,
                            effects: {}
                          }
                        ]
                      }))
                    }
                  >
                    Add Night Modifier
                  </button>
                </div>
                {(nightModifiers ?? []).map((modifier, modifierIndex) => (
                  <div key={`${modifier.id}_${modifierIndex}`} className="dashboard-row-card">
                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">ID</span>
                        <input
                          value={modifier.id}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              next[modifierIndex] = { ...next[modifierIndex], id: event.target.value }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Name</span>
                        <input
                          value={modifier.name}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              next[modifierIndex] = { ...next[modifierIndex], name: event.target.value }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Reward Multiplier</span>
                        <input
                          value={modifier.rewardMultiplier}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              next[modifierIndex] = {
                                ...next[modifierIndex],
                                rewardMultiplier: parseNumberInput(event.target.value, modifier.rewardMultiplier)
                              }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Icon Key</span>
                        <input
                          value={modifier.icon ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              next[modifierIndex] = {
                                ...next[modifierIndex],
                                icon: event.target.value.trim() || undefined
                              }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label className="dashboard-full-width">
                        <span className="muted">Description</span>
                        <input
                          value={modifier.description}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              next[modifierIndex] = { ...next[modifierIndex], description: event.target.value }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">enemyCountMultiplier (delta)</span>
                        <input
                          value={modifier.effects.enemyCountMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              const effects = { ...next[modifierIndex].effects, enemyCountMultiplier: parseOptionalNumberInput(event.target.value) }
                              next[modifierIndex] = { ...next[modifierIndex], effects }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">enemyMoveSpeedMultiplier (delta)</span>
                        <input
                          value={modifier.effects.enemyMoveSpeedMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              const effects = {
                                ...next[modifierIndex].effects,
                                enemyMoveSpeedMultiplier: parseOptionalNumberInput(event.target.value)
                              }
                              next[modifierIndex] = { ...next[modifierIndex], effects }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">enemyHpMultiplier (delta)</span>
                        <input
                          value={modifier.effects.enemyHpMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              const effects = { ...next[modifierIndex].effects, enemyHpMultiplier: parseOptionalNumberInput(event.target.value) }
                              next[modifierIndex] = { ...next[modifierIndex], effects }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">goldStartPenalty</span>
                        <input
                          value={modifier.effects.goldStartPenalty ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              const effects = { ...next[modifierIndex].effects, goldStartPenalty: parseOptionalNumberInput(event.target.value) }
                              next[modifierIndex] = { ...next[modifierIndex], effects }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">towersDisabled</span>
                        <select
                          value={modifier.effects.towersDisabled ? 'true' : 'false'}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              const effects = { ...next[modifierIndex].effects, towersDisabled: event.target.value === 'true' }
                              next[modifierIndex] = { ...next[modifierIndex], effects }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      </label>
                      <label>
                        <span className="muted">addExtraSpawnBorder</span>
                        <select
                          value={modifier.effects.addExtraSpawnBorder ? 'true' : 'false'}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.nightModifiers ?? []).slice()
                              const effects = { ...next[modifierIndex].effects, addExtraSpawnBorder: event.target.value === 'true' }
                              next[modifierIndex] = { ...next[modifierIndex], effects }
                              return { ...level, nightModifiers: next }
                            })
                          }
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      </label>
                    </div>
                    <button
                      className="btn ghost"
                      onClick={() =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          nightModifiers: (level.nightModifiers ?? []).filter((_, index) => index !== modifierIndex),
                          allowedNightModifiersByNight: Object.entries(level.allowedNightModifiersByNight ?? {}).reduce<Record<number, NightModifierId[]>>(
                            (acc, [nightKey, ids]) => {
                              const nightIndex = Number(nightKey)
                              const nextIds = ids.filter((id) => id !== modifier.id)
                              acc[nightIndex] = nextIds
                              return acc
                            },
                            {}
                          )
                        }))
                      }
                    >
                      Remove Night Modifier
                    </button>
                  </div>
                ))}
              </div>

              <div className="dashboard-row-card">
                <h3>Allowed Night Modifiers by Night Index</h3>
                <div className="muted">Configure which modifier IDs can appear each night.</div>
                {(availableNightIndices.length > 0 ? availableNightIndices : [1]).map((nightIndex) => {
                  const allowedForNight = selectedLevel.allowedNightModifiersByNight?.[nightIndex] ?? []
                  return (
                    <div key={`allowed_night_${nightIndex}`} className="dashboard-row-card">
                      <h3>Night {nightIndex}</h3>
                      <div className="dashboard-inline-grid">
                        {nightModifierIds.map((modifierId) => {
                          const checked = allowedForNight.includes(modifierId)
                          return (
                            <label key={`allowed_${nightIndex}_${modifierId}`}>
                              <span className="muted">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    patchSelectedLevel((level) => {
                                      const nextMap = { ...(level.allowedNightModifiersByNight ?? {}) }
                                      const previousIds = nextMap[nightIndex] ?? []
                                      nextMap[nightIndex] = event.target.checked
                                        ? Array.from(new Set([...previousIds, modifierId]))
                                        : previousIds.filter((id) => id !== modifierId)
                                      return { ...level, allowedNightModifiersByNight: nextMap }
                                    })
                                  }
                                />
                                {' '}
                                {modifierId}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="dashboard-row-card">
                <h3>Perks</h3>
                <div className="dashboard-inline-grid">
                  <label>
                    <span className="muted">perkChoicesPerNight</span>
                    <input
                      value={selectedLevel.perkChoicesPerNight ?? 3}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          perkChoicesPerNight: Math.max(1, parseNumberInput(event.target.value, level.perkChoicesPerNight ?? 3))
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">perkMaxCount</span>
                    <input
                      value={selectedLevel.perkMaxCount ?? 5}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          perkMaxCount: Math.max(1, parseNumberInput(event.target.value, level.perkMaxCount ?? 5))
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        perks: DEFAULT_PERKS.map((entry) => ({ ...entry, effects: { ...entry.effects } })),
                        perkPool: DEFAULT_PERKS.map((entry) => entry.id)
                      }))
                    }
                  >
                    Reset Perks to Defaults
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        perks: [
                          ...(level.perks ?? []),
                          {
                            id: `perk_${(level.perks ?? []).length + 1}`,
                            name: 'New Perk',
                            description: 'Custom run perk.',
                            effects: {}
                          }
                        ]
                      }))
                    }
                  >
                    Add Perk
                  </button>
                </div>
                <div className="dashboard-row-card">
                  <h3>Perk Pool</h3>
                  <div className="dashboard-inline-grid">
                    {perkIds.map((perkId) => (
                      <label key={`perk_pool_${perkId}`}>
                        <span className="muted">
                          <input
                            type="checkbox"
                            checked={(selectedLevel.perkPool ?? []).includes(perkId)}
                            onChange={(event) =>
                              patchSelectedLevel((level) => {
                                const pool = level.perkPool ?? []
                                const nextPool = event.target.checked
                                  ? Array.from(new Set([...pool, perkId]))
                                  : pool.filter((id) => id !== perkId)
                                return { ...level, perkPool: nextPool as PerkId[] }
                              })
                            }
                          />
                          {' '}
                          {perkId}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {(perks ?? []).map((perk, perkIndex) => (
                  <div key={`${perk.id}_${perkIndex}`} className="dashboard-row-card">
                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">ID</span>
                        <input
                          value={perk.id}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = { ...next[perkIndex], id: event.target.value }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Name</span>
                        <input
                          value={perk.name}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = { ...next[perkIndex], name: event.target.value }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">maxStacks</span>
                        <input
                          value={perk.maxStacks ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = { ...next[perkIndex], maxStacks: parseOptionalNumberInput(event.target.value) }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Icon Key</span>
                        <input
                          value={perk.icon ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                icon: event.target.value.trim() || undefined
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label className="dashboard-full-width">
                        <span className="muted">Description</span>
                        <input
                          value={perk.description}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = { ...next[perkIndex], description: event.target.value }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">towerRangeMultiplier (delta)</span>
                        <input
                          value={perk.effects.towerRangeMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  towerRangeMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">towerDamageMultiplier (delta)</span>
                        <input
                          value={perk.effects.towerDamageMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  towerDamageMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">goldRewardMultiplier (delta)</span>
                        <input
                          value={perk.effects.goldRewardMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  goldRewardMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">buildingUpgradeCostMultiplier (delta)</span>
                        <input
                          value={perk.effects.buildingUpgradeCostMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  buildingUpgradeCostMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">rangedUnitsDamageMultiplier (delta)</span>
                        <input
                          value={perk.effects.rangedUnitsDamageMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  rangedUnitsDamageMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">wallHpMultiplier (delta)</span>
                        <input
                          value={perk.effects.wallHpMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  wallHpMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">endOfNightBonusGoldPerStrongholdLevel</span>
                        <input
                          value={perk.effects.endOfNightBonusGoldPerStrongholdLevel ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.perks ?? []).slice()
                              next[perkIndex] = {
                                ...next[perkIndex],
                                effects: {
                                  ...next[perkIndex].effects,
                                  endOfNightBonusGoldPerStrongholdLevel: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, perks: next }
                            })
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="btn ghost"
                      onClick={() =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          perks: (level.perks ?? []).filter((_, index) => index !== perkIndex),
                          perkPool: (level.perkPool ?? []).filter((id) => id !== perk.id)
                        }))
                      }
                    >
                      Remove Perk
                    </button>
                  </div>
                ))}
              </div>

              <div className="dashboard-row-card">
                <h3>Enemy Traits</h3>
                <div className="button-row">
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        enemyTraits: DEFAULT_ENEMY_TRAITS.map((entry) => ({
                          ...entry,
                          effects: {
                            ...entry.effects,
                            onDeathExplosion: entry.effects.onDeathExplosion ? { ...entry.effects.onDeathExplosion } : undefined
                          }
                        }))
                      }))
                    }
                  >
                    Reset Traits to Defaults
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        enemyTraits: [
                          ...(level.enemyTraits ?? []),
                          {
                            id: `trait_${(level.enemyTraits ?? []).length + 1}`,
                            name: 'New Trait',
                            description: 'Custom enemy trait.',
                            effects: {}
                          }
                        ]
                      }))
                    }
                  >
                    Add Enemy Trait
                  </button>
                </div>
                {(enemyTraits ?? []).map((trait, traitIndex) => (
                  <div key={`${trait.id}_${traitIndex}`} className="dashboard-row-card">
                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">ID</span>
                        <input
                          value={trait.id}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = { ...next[traitIndex], id: event.target.value }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Name</span>
                        <input
                          value={trait.name}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = { ...next[traitIndex], name: event.target.value }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">Icon Key</span>
                        <input
                          value={trait.icon ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = {
                                ...next[traitIndex],
                                icon: event.target.value.trim() || undefined
                              }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                      <label className="dashboard-full-width">
                        <span className="muted">Description</span>
                        <input
                          value={trait.description}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = { ...next[traitIndex], description: event.target.value }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className="dashboard-inline-grid">
                      <label>
                        <span className="muted">rangedDamageTakenMultiplier</span>
                        <input
                          value={trait.effects.rangedDamageTakenMultiplier ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = {
                                ...next[traitIndex],
                                effects: {
                                  ...next[traitIndex].effects,
                                  rangedDamageTakenMultiplier: parseOptionalNumberInput(event.target.value)
                                }
                              }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">onDeathExplosion.radius</span>
                        <input
                          value={trait.effects.onDeathExplosion?.radius ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              const existing = next[traitIndex].effects.onDeathExplosion ?? { radius: 0, damage: 0 }
                              next[traitIndex] = {
                                ...next[traitIndex],
                                effects: {
                                  ...next[traitIndex].effects,
                                  onDeathExplosion: {
                                    ...existing,
                                    radius: parseNumberInput(event.target.value, existing.radius)
                                  }
                                }
                              }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">onDeathExplosion.damage</span>
                        <input
                          value={trait.effects.onDeathExplosion?.damage ?? ''}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              const existing = next[traitIndex].effects.onDeathExplosion ?? { radius: 0, damage: 0 }
                              next[traitIndex] = {
                                ...next[traitIndex],
                                effects: {
                                  ...next[traitIndex].effects,
                                  onDeathExplosion: {
                                    ...existing,
                                    damage: parseNumberInput(event.target.value, existing.damage)
                                  }
                                }
                              }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted">targetingPriority</span>
                        <select
                          value={trait.effects.targetingPriority ?? 'DEFAULT'}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = {
                                ...next[traitIndex],
                                effects: {
                                  ...next[traitIndex].effects,
                                  targetingPriority: event.target.value === 'TOWERS_FIRST' ? 'TOWERS_FIRST' : 'DEFAULT'
                                }
                              }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        >
                          <option value="DEFAULT">DEFAULT</option>
                          <option value="TOWERS_FIRST">TOWERS_FIRST</option>
                        </select>
                      </label>
                      <label>
                        <span className="muted">ignoresWalls</span>
                        <select
                          value={trait.effects.ignoresWalls ? 'true' : 'false'}
                          onChange={(event) =>
                            patchSelectedLevel((level) => {
                              const next = (level.enemyTraits ?? []).slice()
                              next[traitIndex] = {
                                ...next[traitIndex],
                                effects: {
                                  ...next[traitIndex].effects,
                                  ignoresWalls: event.target.value === 'true'
                                }
                              }
                              return { ...level, enemyTraits: next }
                            })
                          }
                        >
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      </label>
                    </div>
                    <div className="button-row">
                      <button
                        className="btn ghost"
                        onClick={() =>
                          patchSelectedLevel((level) => {
                            const next = (level.enemyTraits ?? []).slice()
                            next[traitIndex] = {
                              ...next[traitIndex],
                              effects: {
                                ...next[traitIndex].effects,
                                onDeathExplosion: undefined
                              }
                            }
                            return { ...level, enemyTraits: next }
                          })
                        }
                      >
                        Clear Explosion Effect
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() =>
                          patchSelectedLevel((level) => ({
                            ...level,
                            enemyTraits: (level.enemyTraits ?? []).filter((_, index) => index !== traitIndex)
                          }))
                        }
                      >
                        Remove Trait
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-row-card">
                <h3>Elite Variant Config</h3>
                <div className="button-row">
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        eliteConfig: {
                          ...DEFAULT_ELITE_CONFIG,
                          outline: { ...DEFAULT_ELITE_CONFIG.outline }
                        }
                      }))
                    }
                  >
                    Reset Elite Config to Defaults
                  </button>
                </div>
                <div className="dashboard-inline-grid">
                  <label>
                    <span className="muted">enabled</span>
                    <select
                      value={(selectedLevel.eliteConfig?.enabled ?? DEFAULT_ELITE_CONFIG.enabled) ? 'true' : 'false'}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            enabled: event.target.value === 'true'
                          }
                        }))
                      }
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  </label>
                  <label>
                    <span className="muted">hpMultiplier</span>
                    <input
                      value={selectedLevel.eliteConfig?.hpMultiplier ?? DEFAULT_ELITE_CONFIG.hpMultiplier}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            hpMultiplier: parseNumberInput(event.target.value, level.eliteConfig?.hpMultiplier ?? DEFAULT_ELITE_CONFIG.hpMultiplier)
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">damageMultiplier</span>
                    <input
                      value={selectedLevel.eliteConfig?.damageMultiplier ?? DEFAULT_ELITE_CONFIG.damageMultiplier}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            damageMultiplier: parseNumberInput(
                              event.target.value,
                              level.eliteConfig?.damageMultiplier ?? DEFAULT_ELITE_CONFIG.damageMultiplier
                            )
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">moveSpeedMultiplier</span>
                    <input
                      value={selectedLevel.eliteConfig?.moveSpeedMultiplier ?? ''}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            moveSpeedMultiplier: parseOptionalNumberInput(event.target.value)
                          }
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="muted">outline.enabled</span>
                    <select
                      value={(selectedLevel.eliteConfig?.outline?.enabled ?? DEFAULT_ELITE_CONFIG.outline.enabled) ? 'true' : 'false'}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            outline: {
                              ...(level.eliteConfig?.outline ?? DEFAULT_ELITE_CONFIG.outline),
                              enabled: event.target.value === 'true'
                            }
                          }
                        }))
                      }
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  </label>
                  <label>
                    <span className="muted">outline.color</span>
                    <select
                      value={selectedLevel.eliteConfig?.outline?.color ?? DEFAULT_ELITE_CONFIG.outline.color ?? 'YELLOW'}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            outline: {
                              ...(level.eliteConfig?.outline ?? DEFAULT_ELITE_CONFIG.outline),
                              color: event.target.value === 'YELLOW' ? 'YELLOW' : undefined
                            }
                          }
                        }))
                      }
                    >
                      <option value="YELLOW">YELLOW</option>
                    </select>
                  </label>
                  <label>
                    <span className="muted">announceInIntel</span>
                    <select
                      value={(selectedLevel.eliteConfig?.announceInIntel ?? DEFAULT_ELITE_CONFIG.announceInIntel) ? 'true' : 'false'}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            announceInIntel: event.target.value === 'true'
                          }
                        }))
                      }
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  </label>
                  <label>
                    <span className="muted">icon</span>
                    <input
                      value={selectedLevel.eliteConfig?.icon ?? ''}
                      onChange={(event) =>
                        patchSelectedLevel((level) => ({
                          ...level,
                          eliteConfig: {
                            ...(level.eliteConfig ?? DEFAULT_ELITE_CONFIG),
                            icon: event.target.value.trim() || undefined
                          }
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enemies' && (
            <div className="dashboard-stack">
              <button
                className="btn success"
                onClick={() =>
                  patchSelectedLevel((level) => ({
                    ...level,
                    enemies: {
                      ...level.enemies,
                      catalog: [
                        ...level.enemies.catalog,
                        { id: `enemy_${level.enemies.catalog.length + 1}`, name: 'New Enemy', kind: 'unit' }
                      ]
                    }
                  }))
                }
              >
                Add Enemy Entry
              </button>
              {selectedLevel.enemies.catalog.map((enemy, index) => (
                <div key={`${enemy.id}_${index}`} className="dashboard-row-card">
                  <div className="dashboard-inline-grid">
                    <label>
                      <span className="muted">ID</span>
                      <input
                        value={enemy.id}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const catalog = level.enemies.catalog.slice()
                            catalog[index] = { ...catalog[index], id: event.target.value }
                            return { ...level, enemies: { ...level.enemies, catalog } }
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Name</span>
                      <input
                        value={enemy.name}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const catalog = level.enemies.catalog.slice()
                            catalog[index] = { ...catalog[index], name: event.target.value }
                            return { ...level, enemies: { ...level.enemies, catalog } }
                          })
                        }
                      />
                    </label>
                    <label>
                      <span className="muted">Kind</span>
                      <select
                        value={enemy.kind}
                        onChange={(event) =>
                          patchSelectedLevel((level) => {
                            const catalog = level.enemies.catalog.slice()
                            catalog[index] = { ...catalog[index], kind: event.target.value === 'elite' ? 'elite' : 'unit' }
                            return { ...level, enemies: { ...level.enemies, catalog } }
                          })
                        }
                      >
                        <option value="unit">unit</option>
                        <option value="elite">elite</option>
                      </select>
                    </label>
                  </div>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        enemies: { ...level.enemies, catalog: level.enemies.catalog.filter((_, i) => i !== index) }
                      }))
                    }
                  >
                    Remove Entry
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'bosses' && (
            <div className="dashboard-section-grid">
              <label>
                <span className="muted">Final Boss ID</span>
                <select
                  value={selectedLevel.bossId ?? 'boss'}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      bossId: event.target.value as keyof typeof ELITE_DEFS
                    }))
                  }
                >
                  {Object.keys(ELITE_DEFS).map((eliteId) => (
                    <option key={eliteId} value={eliteId}>{eliteId}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="muted">Mini-boss Default After Wave</span>
                <input
                  value={selectedLevel.waves.miniBossAfterWave}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      waves: {
                        ...level.waves,
                        miniBossAfterWave: parseNumberInput(event.target.value, level.waves.miniBossAfterWave)
                      }
                    }))
                  }
                />
              </label>
              <label>
                <span className="muted">Force Final Boss on Last Day</span>
                <select
                  value={selectedLevel.waves.enforceFinalBossOnLastDay ? 'true' : 'false'}
                  onChange={(event) =>
                    patchSelectedLevel((level) => ({
                      ...level,
                      waves: {
                        ...level.waves,
                        enforceFinalBossOnLastDay: event.target.value === 'true'
                      }
                    }))
                  }
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <div className="dashboard-full-width dashboard-row-card">
                <h3>Miniboss Override</h3>
                <div className="muted">Day 1 miniboss is forced off by runtime rule.</div>
                <label>
                  <span className="muted">suppressDay1MiniBoss (locked)</span>
                  <select value={selectedLevel.minibossRules.suppressDay1MiniBoss ? 'true' : 'false'} disabled>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                {!selectedLevel.minibossRules.suppressDay1MiniBoss && (
                  <button
                    className="btn"
                    onClick={() =>
                      patchSelectedLevel((level) => ({
                        ...level,
                        minibossRules: { ...level.minibossRules, suppressDay1MiniBoss: true }
                      }))
                    }
                  >
                    Enforce Rule
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="dashboard-stack">
              <div className="dashboard-row-card">
                <h3>Errors ({selectedValidation.errors.length})</h3>
                {selectedValidation.errors.length === 0 ? <div className="muted">No errors.</div> : (
                  <div className="dashboard-issues">
                    {selectedValidation.errors.map((issue, index) => (
                      <div key={`${issue.path}_${index}`} className="muted">{issue.path}: {issue.message}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="dashboard-row-card">
                <h3>Warnings ({selectedValidation.warnings.length})</h3>
                {selectedValidation.warnings.length === 0 ? <div className="muted">No warnings.</div> : (
                  <div className="dashboard-issues">
                    {selectedValidation.warnings.map((issue, index) => (
                      <div key={`${issue.path}_${index}`} className="muted">{issue.path}: {issue.message}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="dashboard-row-card">
                <h3>Diff vs Base ({diffRows.length})</h3>
                {diffRows.length === 0 ? <div className="muted">No changes from base.</div> : (
                  <div className="dashboard-diff">
                    {diffRows.map((row, index) => (
                      <div key={`${row.path}_${index}`} className="dashboard-diff-row">
                        <code>{row.path}</code>
                        <div className="muted">Base: {row.before}</div>
                        <div className="muted">Edited: {row.after}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="dashboard-stack">
              <textarea
                className="dashboard-json"
                value={rawJson}
                onChange={(event) => setRawJson(event.target.value)}
              />
              <div className="button-row">
                <button className="btn primary" onClick={handleApplyRawJson}>Apply JSON</button>
                <button className="btn" onClick={() => setRawJson(JSON.stringify(selectedLevel, null, 2))}>Reset JSON</button>
              </div>
            </div>
          )}
        </main>

        <aside className="panel dashboard-actions">
          <div className="dashboard-stack">
            <div className="button-row">
              <button className="btn" onClick={undoSelectedDashboardLevel} disabled={!canUndo}>Undo</button>
              <button className="btn" onClick={redoSelectedDashboardLevel} disabled={!canRedo}>Redo</button>
            </div>
            <button className="btn success" onClick={handleSaveOverrides}>Save Overrides</button>
            <button className="btn" onClick={revertSelectedLevelToBase}>Revert Level to Base</button>
            <button className="btn ghost" onClick={revertAllDashboardOverrides}>Revert All Overrides</button>
            <button
              className="btn"
              onClick={() => downloadJson('tuning-overrides.json', exportDashboardOverridesJson())}
            >
              Export Overrides JSON
            </button>
            <button className="btn" onClick={() => importInputRef.current?.click()}>Import Overrides JSON</button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="dashboard-file-input"
              onChange={handleImportOverrides}
            />
            <button
              className="btn primary"
              disabled={!selectedValidation.isValid}
              onClick={() => onPlaytest(selectedLevel)}
            >
              Playtest Level
            </button>
            {!selectedValidation.isValid && (
              <button
                className="btn ghost"
                onClick={() => {
                  const confirmed = window.confirm('This level has validation errors. Force playtest anyway?')
                  if (confirmed) onPlaytest(selectedLevel, true)
                }}
              >
                Force Playtest
              </button>
            )}
            <div className="muted">
              {selectedValidation.isValid
                ? 'Runtime validation: valid.'
                : `Runtime validation: ${selectedValidation.errors.length} error(s).`}
            </div>
            {rawStatus && <div className="muted">{rawStatus}</div>}
          </div>
        </aside>
      </div>
      <LevelPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        levelDraft={selectedLevel}
        revision={selectedDraftRevision}
        onGenerated={() => markLevelPreviewUpToDate(selectedLevel.id)}
      />
    </div>
  )
}
